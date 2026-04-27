# AUTH-UX: Arena Login System Overhaul

**Authority:** MMOS-SAFE  
**Date:** 2026-04-27  
**Status:** Architecture Spec + Implementation Plan  
**Constraint:** MMOS core MUST NOT be modified

---

## 1. ROOT CAUSE ANALYSIS

### What happens today

When an unauthenticated user visits `/arena`:

1. `arena-bypass.php` allows them through WordPress's `template_redirect` without requiring a WP session. The CDN HTML loads successfully.

2. The boot sequence fires at **line 9380** of `arena.html`:
   ```
   boot() -> enforceAuthOrRedirect() -> readSupabaseUserViaExchangeBootstrap()
             -> ensureSupabaseSessionViaWordPress() -> runAuthExchange()
   ```

3. `runAuthExchange()` (line 6661) POSTs to `/api/auth/exchange` with `credentials: 'include'`. Since the user has no WordPress `logged_in` cookie, the Railway endpoint returns a non-OK response.

4. The fallback path (`requiresWordPressToken`) calls `fetchWordPressExchangeToken()`, which hits `/wp-json/missionmed-command-center/v1/auth/token/`. This also fails because there's no authenticated WordPress session.

5. `ensureSupabaseSessionViaWordPress()` returns `false`.

6. `enforceAuthOrRedirect()` (line 7269) catches the failure and calls `showArenaAuthRequiredState()` (line 9258), which:
   - Sets `ArenaUser.authenticated = false`
   - Locks the "Enter Arena" button to read "Sign In Required"
   - Unhides `#entryAuthPanel`
   - Renders the WP login form HTML injected by `arena-route-proxy.php` into `#entryAuthForm`

7. **The redirect trigger:** When the user clicks the locked "Enter Arena" button (line 9362), or clicks the "Open Login" link (`#entryAuthLoginLink`), they are navigated to:
   ```
   /my-account/?redirect_to=https://missionmedinstitute.com/arena
   ```
   This URL is built by `buildArenaLoginUrl()` (line 5937) using `MM_ARENA_AUTH_CONFIG.loginUrl`, which the PHP proxy sets to the WooCommerce My Account login page.

8. The `/my-account/` page either renders WooCommerce's login form OR, if WooCommerce redirects further, the user ends up at `wp-login.php`. Either way, they leave Arena entirely.

### The two redirect vectors

**Vector A (primary):** The "Enter Arena" button click handler (line 9362-9371) executes `window.location.href = loginUrl` when `ArenaUser.authenticated` is false.

**Vector B (secondary):** The `#entryAuthLoginLink` anchor (line 4732) has its `href` set to the WP login URL at render time by `renderArenaAuthFormIntoPanel()` (line 9219).

### Why the WP form injection doesn't solve it

The PHP proxy injects `wp_login_form()` HTML into `MM_ARENA_AUTH_CONFIG.loginFormHtml` (line 118-131 of `arena-route-proxy.php`). This form IS rendered inside Arena's `#entryAuthForm` div. However, the native WP login form's `action` attribute points to `wp-login.php`, so submitting it STILL navigates the user away from Arena. The form submission is a standard HTML POST to WordPress's login handler, which processes the auth, sets the cookie, and redirects back to `/arena?redirected=1`. The round-trip breaks immersion completely.

### Root cause summary

The auth check itself is correct and well-designed. The problem is exclusively in the **failure UX path**: when `enforceAuthOrRedirect()` returns false, the only recovery options exposed to the user all involve leaving Arena. There is no mechanism to authenticate inline.

---

## 2. MMOS-SAFE ARCHITECTURE

### What MMOS owns (DO NOT TOUCH)

| Component | Location | Function |
|---|---|---|
| `MMOS.registerMode()` | line 16816+ | Mode registry |
| `MMOS.navigate()` | MMOS core | Mode navigation with readiness gates |
| `MMOS.init()` | MMOS core | System initialization |
| `MMOS.state` | MMOS core | `hasEnteredArena`, `currentScene`, `modeStatus` |
| `MMOS.setScene()` | MMOS core | Declarative scene switching |
| `MMOS.overlays` | MMOS core | Loader/error overlays |
| `MMOS.fullscreen` | MMOS core | Fullscreen controller |
| Mode registrations | line 17136-17161 | lobby, submenu, play, profile, compete, leaderboard |

### Where login lives relative to MMOS

The boot sequence runs BEFORE MMOS initialization completes its first `navigate()`. The auth check happens at the **entry screen level**, which is the pre-MMOS gate. MMOS modes (lobby, play, etc.) only activate AFTER the user clicks "Enter Arena" and `startArena()` fires.

This is the critical insight: **auth happens in the entry screen layer, which is architecturally OUTSIDE the MMOS mode system.** The entry screen is a CSS-controlled overlay (`#arena-entry`) that sits above the lobby. MMOS doesn't manage it. This means we can redesign the auth experience in this layer without touching MMOS at all.

### Integration points

```
[Entry Screen Layer]          <-- AUTH LIVES HERE (our target)
    |
    v  (user clicks Enter Arena)
[startArena()]                <-- Triggers MMOS activation
    |
    v
[MMOS.navigate('lobby')]      <-- MMOS takes over
    |
    v
[MMOS modes: play, drill, etc.]
```

Login completion must:
1. Set `ArenaUser.authenticated = true`
2. Populate `window.MM_USER`
3. Hydrate the Supabase session via the existing exchange/bootstrap pipeline
4. Unlock the "Enter Arena" button
5. Allow the normal `startArena()` flow to proceed

Login MUST NOT:
1. Call `MMOS.navigate()` or `MMOS.setScene()` directly
2. Modify MMOS mode registrations
3. Interfere with `MMOS.init()` or the loader system
4. Alter the mode readiness gate behavior

---

## 3. CHOSEN SOLUTION: Option A (Arena-Native Login)

### Architecture

Replace the current "redirect to WP" failure path with an **inline AJAX-based login form** that:

1. Renders inside the existing `#entryAuthPanel` (already in the DOM, already styled)
2. Submits credentials via `fetch()` to WordPress's `wp-login.php` using `credentials: 'include'`
3. On successful WP auth (cookie set), immediately re-runs `ensureSupabaseSessionViaWordPress()`
4. On Supabase session success, hydrates identity and unlocks the entry button
5. User never leaves the page

### Why this works

WordPress's `wp-login.php` accepts POST requests and sets the `logged_in` cookie in the response. By sending this request via `fetch()` with `credentials: 'include'`, the browser stores the cookie. Once the cookie exists, the existing `runAuthExchange()` path succeeds because the Railway proxy can read the first-party WordPress cookie.

The entire exchange/bootstrap pipeline remains untouched. We're only changing HOW the WordPress cookie gets set, not what happens after.

### Why Option B was rejected

A silent redirect still navigates away from the page, causes a visible flash/reload, breaks any audio context, resets JavaScript state, and requires re-parsing 17,000+ lines of HTML. Even with careful `redirect_to` handling, the user perceives a page change. Option A keeps the browser tab state completely intact.

---

## 4. UX DESIGN

### Visual concept

The login experience should feel like entering a secure game lobby, not filling out a web form.

**State 1: Auth Required (current, improved)**
- Entry screen shows the Arena branding (logo, title, subtitle) as it does now
- Below the "Enter Arena" button (which shows "Sign In Required"), the auth panel slides into view
- The panel contains a styled login form with Arena's visual language: dark backgrounds, gold accents (#FFD447), the existing `entry-auth-*` CSS classes

**State 2: Authenticating**
- On form submit, the submit button transforms into a loading spinner using the Arena's existing gold spinner aesthetic
- Text reads "Verifying identity..." then "Establishing secure session..." as it progresses through the exchange/bootstrap chain
- No page navigation occurs

**State 3: Success**
- The auth panel fades out
- The welcome message appears: "Welcome back, [Name]"
- The "Enter Arena" button unlocks and pulses once with a gold glow
- User clicks to enter, normal `startArena()` flow proceeds

**State 4: Error**
- Inline error message below the form (red/warm tone, not a system alert)
- "Invalid credentials. Try again." or "Connection failed. Retry."
- Form remains interactive for retry

### Key UX principles

- No page reload, no navigation, no visible URL change
- All states animated with CSS transitions (the entry screen already uses `opacity` and `transform` transitions)
- Error states are recoverable without refresh
- The form uses the existing `.entry-auth-form` CSS which already styles inputs, labels, and submit buttons in the Arena aesthetic
- Password field has show/hide toggle for mobile usability

---

## 5. EXACT IMPLEMENTATION STEPS

### 5.1 Modify `arena-route-proxy.php` (server-side)

**File:** `/Users/brianb/MissionMed/wp-content/mu-plugins/arena-route-proxy.php`

**Change:** Stop injecting `wp_login_form()` HTML. Instead, set a flag that tells the client to render the AJAX form.

In `mm_arena_route_proxy_build_auth_config()` (line 93), replace the login form generation block:

**Current (lines 118-131):**
```php
if ( ! is_user_logged_in() && function_exists( 'wp_login_form' ) ) {
    ob_start();
    wp_login_form(
        array(
            'echo'           => true,
            'remember'       => true,
            'redirect'       => $login_return_url,
            'label_username' => __( 'Email or Username' ),
            'label_password' => __( 'Password' ),
            'label_remember' => __( 'Remember Me' ),
            'label_log_in'   => __( 'Continue to Arena' ),
        )
    );
    $login_form_html = (string) ob_get_clean();
}
```

**Replace with:**
```php
if ( ! is_user_logged_in() ) {
    $login_form_html = '__ARENA_NATIVE_LOGIN__';
}
```

**Why:** The sentinel value `__ARENA_NATIVE_LOGIN__` tells the client-side code to render its own AJAX form instead of injecting raw WP HTML. This preserves the existing config injection pipeline and data shape. The server still correctly reports `isLoggedIn: false` and provides all URLs as fallbacks.

**Add to the returned config array (line 134):**
```php
'wpLoginPostUrl'  => esc_url_raw( site_url( 'wp-login.php', 'login' ) ),
'wpLoginNonce'    => wp_create_nonce( 'mm-arena-ajax-login' ),
```

### 5.2 Add WordPress AJAX login endpoint

**New file:** `/Users/brianb/MissionMed/wp-content/mu-plugins/missionmed-arena-ajax-login.php`

```php
<?php
/**
 * AJAX login handler for Arena-native authentication.
 * Returns JSON instead of HTML redirect.
 * Authority: AUTH-UX Arena Login Overhaul
 */

add_action( 'wp_ajax_nopriv_mm_arena_login', 'mm_arena_ajax_login_handler' );
add_action( 'wp_ajax_mm_arena_login', 'mm_arena_ajax_login_handler' );

function mm_arena_ajax_login_handler() {
    // Accept JSON body or form data
    $content_type = isset( $_SERVER['CONTENT_TYPE'] ) ? $_SERVER['CONTENT_TYPE'] : '';
    
    if ( false !== strpos( $content_type, 'application/json' ) ) {
        $raw  = file_get_contents( 'php://input' );
        $data = json_decode( $raw, true );
        if ( ! is_array( $data ) ) {
            $data = array();
        }
    } else {
        $data = $_POST;
    }

    $username = isset( $data['username'] ) ? sanitize_user( $data['username'] ) : '';
    $password = isset( $data['password'] ) ? $data['password'] : '';
    $remember = ! empty( $data['remember'] );
    $nonce    = isset( $data['nonce'] ) ? $data['nonce'] : '';

    header( 'Content-Type: application/json; charset=utf-8' );

    if ( '' === $username || '' === $password ) {
        wp_send_json( array(
            'ok'      => false,
            'code'    => 'missing_fields',
            'message' => 'Username and password are required.',
        ), 400 );
    }

    $creds = array(
        'user_login'    => $username,
        'user_password' => $password,
        'remember'      => $remember,
    );

    $user = wp_signon( $creds, is_ssl() );

    if ( is_wp_error( $user ) ) {
        $code    = $user->get_error_code();
        $message = 'Invalid username or password.';
        
        if ( 'invalid_username' === $code || 'invalid_email' === $code ) {
            $message = 'No account found with that username or email.';
        } elseif ( 'incorrect_password' === $code ) {
            $message = 'Incorrect password. Please try again.';
        }

        wp_send_json( array(
            'ok'      => false,
            'code'    => $code,
            'message' => $message,
        ), 401 );
    }

    // Set current user so subsequent auth checks work
    wp_set_current_user( $user->ID );

    wp_send_json( array(
        'ok'           => true,
        'user_id'      => $user->ID,
        'display_name' => $user->display_name,
        'email'        => $user->user_email,
    ), 200 );
}
```

**Why a dedicated endpoint instead of POSTing to `wp-login.php`:**
`wp-login.php` returns HTML and performs `wp_redirect()`, which causes issues with `fetch()` (redirect responses, HTML parsing). A clean JSON endpoint via `wp_ajax_nopriv_` gives us:
- Proper JSON response
- `wp_signon()` sets the `logged_in` cookie automatically
- No redirect headers to fight
- Clean error codes for UX messaging

### 5.3 Modify `arena.html` client-side (CDN file)

**File:** `/Users/brianb/MissionMed/LIVE/arena.html`

#### 5.3.1 Replace `renderArenaAuthFormIntoPanel()` (line 9219)

**Current logic:** Injects raw `loginFormHtml` from the server config, which is a WP form that POSTs to `wp-login.php`.

**New logic:**

```javascript
function renderArenaAuthFormIntoPanel(){
  if(!entryAuthPanel) return false;
  var loginUrl = buildArenaLoginUrl();
  var registerUrl = buildArenaRegisterUrl();
  var authCfg = getArenaAuthConfig();
  var loginFormHtml = getArenaLoginFormHtml();

  // Arena-native AJAX login
  if(loginFormHtml === '__ARENA_NATIVE_LOGIN__' || (authCfg && !authCfg.isLoggedIn)){
    var formHtml = [
      '<form id="arenaLoginForm" autocomplete="on" novalidate>',
      '  <div class="login-username">',
      '    <label for="arenaLoginUser">Email or Username</label>',
      '    <input type="text" id="arenaLoginUser" name="username"',
      '           autocomplete="username" autocapitalize="none"',
      '           spellcheck="false" required placeholder="Enter your email or username">',
      '  </div>',
      '  <div class="login-password">',
      '    <label for="arenaLoginPass">Password</label>',
      '    <input type="password" id="arenaLoginPass" name="password"',
      '           autocomplete="current-password" required placeholder="Enter your password">',
      '  </div>',
      '  <div class="login-remember">',
      '    <label><input type="checkbox" name="remember" value="1" checked> Remember Me</label>',
      '  </div>',
      '  <div class="login-submit">',
      '    <button type="submit" id="arenaLoginSubmit" class="button">',
      '      <span class="btn-label">Continue to Arena</span>',
      '      <span class="btn-spinner" hidden></span>',
      '    </button>',
      '  </div>',
      '  <div id="arenaLoginError" class="arena-login-error" hidden></div>',
      '</form>'
    ].join('\n');

    if(entryAuthForm){
      entryAuthForm.innerHTML = formHtml;
      bindArenaLoginForm();
    }

    if(entryAuthLoginLink){
      entryAuthLoginLink.href = loginUrl;
      entryAuthLoginLink.textContent = 'Use full account page';
    }
    if(entryAuthRegisterLink){
      entryAuthRegisterLink.href = registerUrl;
    }
    if(entryAuthLinks){
      entryAuthLinks.style.display = 'flex';
    }
    return true;
  }

  // Fallback: original WP form injection (for logged-in state or legacy)
  if(entryAuthLoginLink){
    entryAuthLoginLink.href = loginUrl;
    entryAuthLoginLink.textContent = loginFormHtml ? 'Use full account page' : 'Continue to Arena';
  }
  if(entryAuthRegisterLink){
    entryAuthRegisterLink.href = registerUrl;
  }
  if(entryAuthForm){
    entryAuthForm.innerHTML = '';
    if(loginFormHtml && loginFormHtml !== '__ARENA_NATIVE_LOGIN__'){
      entryAuthForm.innerHTML = loginFormHtml;
    }
  }
  if(entryAuthLinks){
    entryAuthLinks.style.display = 'flex';
  }
  return false;
}
```

#### 5.3.2 Add the AJAX login handler function (insert after `renderArenaAuthFormIntoPanel`)

```javascript
function bindArenaLoginForm(){
  var form = document.getElementById('arenaLoginForm');
  if(!form) return;
  var submitBtn = document.getElementById('arenaLoginSubmit');
  var btnLabel = submitBtn ? submitBtn.querySelector('.btn-label') : null;
  var btnSpinner = submitBtn ? submitBtn.querySelector('.btn-spinner') : null;
  var errorEl = document.getElementById('arenaLoginError');
  var userInput = document.getElementById('arenaLoginUser');
  var passInput = document.getElementById('arenaLoginPass');

  function setLoading(active, text){
    if(submitBtn) submitBtn.disabled = active;
    if(btnLabel) btnLabel.textContent = text || (active ? 'Verifying...' : 'Continue to Arena');
    if(btnSpinner) btnSpinner.hidden = !active;
    if(userInput) userInput.disabled = active;
    if(passInput) passInput.disabled = active;
  }

  function showError(msg){
    if(errorEl){
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }
  }

  function clearError(){
    if(errorEl){
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
  }

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    clearError();

    var username = (userInput ? userInput.value : '').trim();
    var password = passInput ? passInput.value : '';
    var remember = form.querySelector('input[name="remember"]');
    var rememberChecked = remember ? remember.checked : false;

    if(!username || !password){
      showError('Please enter your username and password.');
      return;
    }

    setLoading(true, 'Verifying identity...');

    try{
      // Step 1: Authenticate against WordPress via AJAX endpoint
      var wpOrigin = resolveCanonicalWordPressOrigin() || window.location.origin;
      var loginResponse = await fetch(wpOrigin + '/wp-admin/admin-ajax.php', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mm_arena_login',
          username: username,
          password: password,
          remember: rememberChecked
        })
      });

      var loginResult = null;
      try{ loginResult = await loginResponse.json(); } catch(_jsonErr){}

      if(!loginResponse.ok || !loginResult || !loginResult.ok){
        var errMsg = (loginResult && loginResult.message)
          ? loginResult.message
          : 'Authentication failed. Please check your credentials.';
        setLoading(false);
        showError(errMsg);
        if(passInput){ passInput.value = ''; passInput.focus(); }
        return;
      }

      // Step 2: WP cookie is now set. Run the exchange/bootstrap pipeline.
      setLoading(true, 'Establishing secure session...');

      var sessionReady = await ensureSupabaseSessionViaWordPress();
      if(!sessionReady){
        setLoading(false);
        showError('Session could not be established. Please try again.');
        return;
      }

      // Step 3: Hydrate user identity
      setLoading(true, 'Loading your profile...');

      var authState = await arenaSupabase.auth.getUser();
      var supabaseUser = authState && authState.data && authState.data.user
        ? authState.data.user : null;

      if(!supabaseUser || !supabaseUser.id){
        setLoading(false);
        showError('Identity verification failed. Please refresh and try again.');
        return;
      }

      window.MM_USER = buildWordPressLikeUserFromSupabaseUser(supabaseUser);
      ArenaUser.authenticated = true;

      await hydrateArenaUserFromAuthenticatedContext();
      await hydrateAvatarState({ force: true, source: 'arena_native_login' });

      // Step 4: Transition to authenticated entry state
      try{ document.body.setAttribute('data-arena-auth-state', 'authenticated'); } catch(_e){}
      resetArenaEntryAuthState();

      entryWelcome.textContent = 'Welcome back, ' + ArenaUser.displayName;
      entryWelcome.classList.add('visible');
      setEntryButtonLocked(false);

      // Pulse the enter button to draw attention
      if(entryEnterBtn){
        entryEnterBtn.classList.add('arena-login-success-pulse');
        setTimeout(function(){
          entryEnterBtn.classList.remove('arena-login-success-pulse');
        }, 1500);
      }

    } catch(err){
      console.error('[Arena] Native login failed:', err);
      setLoading(false);
      showError('Connection error. Please check your network and try again.');
    }
  });
}
```

#### 5.3.3 Add CSS for the AJAX login form states (insert in the entry screen `<style>` block)

```css
/* Arena-native login form enhancements */
.arena-login-error {
  color: #FF6B6B;
  font-size: 13px;
  line-height: 1.4;
  margin-top: 10px;
  padding: 8px 12px;
  background: rgba(255, 107, 107, 0.08);
  border: 1px solid rgba(255, 107, 107, 0.25);
  border-radius: 6px;
  text-align: center;
}
.arena-login-error[hidden] { display: none !important; }

#arenaLoginSubmit .btn-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 212, 71, 0.3);
  border-top-color: #FFD447;
  border-radius: 50%;
  animation: mmos-spin 0.9s linear infinite;
  vertical-align: middle;
  margin-left: 6px;
}
#arenaLoginSubmit .btn-spinner[hidden] { display: none !important; }

#arenaLoginSubmit:disabled {
  opacity: 0.7;
  cursor: wait;
}

.arena-login-success-pulse {
  animation: arena-login-pulse 1.5s ease-out;
}
@keyframes arena-login-pulse {
  0% { box-shadow: 0 0 0 0 rgba(255, 212, 71, 0.6); }
  50% { box-shadow: 0 0 20px 8px rgba(255, 212, 71, 0.3); }
  100% { box-shadow: 0 0 0 0 rgba(255, 212, 71, 0); }
}
```

#### 5.3.4 Modify the "Enter Arena" button click handler (line 9361)

**Current (lines 9361-9375):**
```javascript
if(entryEnterBtn){
  entryEnterBtn.addEventListener('click', function(){
    if(!ArenaUser.authenticated){
      var loginUrl = buildArenaLoginUrl();
      if(loginUrl){
        try{
          window.location.href = loginUrl;
        } catch(_entryLoginNavErr){}
      }
      return;
    }
    applyIdentityToArena();
    openArenaStartGate();
  });
}
```

**Replace with:**
```javascript
if(entryEnterBtn){
  entryEnterBtn.addEventListener('click', function(){
    if(!ArenaUser.authenticated){
      // Instead of redirecting, ensure the auth panel is visible
      // and focus the username field for immediate interaction
      if(entryAuthPanel && entryAuthPanel.hidden){
        showArenaAuthRequiredState({ reason: 'enter_clicked' });
      }
      var userField = document.getElementById('arenaLoginUser');
      if(userField) userField.focus();
      return;
    }
    applyIdentityToArena();
    openArenaStartGate();
  });
}
```

**Why:** Instead of navigating to `/my-account/`, clicking the locked button now draws attention to the already-visible inline login form. The "Use full account page" link remains as an escape hatch for edge cases (password reset, registration).

### 5.4 Files changed summary

| File | Type | Change |
|---|---|---|
| `wp-content/mu-plugins/arena-route-proxy.php` | PHP (server) | Replace `wp_login_form()` with sentinel + add `wpLoginPostUrl` and nonce to config |
| `wp-content/mu-plugins/missionmed-arena-ajax-login.php` | PHP (NEW) | AJAX login endpoint returning JSON |
| `LIVE/arena.html` | HTML/JS/CSS (CDN) | Replace form renderer, add AJAX login handler, add CSS, modify button click |

### 5.5 MMOS impact: ZERO

| MMOS Component | Affected? | Reason |
|---|---|---|
| `MMOS.registerMode()` | No | Not called or modified |
| `MMOS.navigate()` | No | Not called during login |
| `MMOS.init()` | No | Login completes before MMOS modes activate |
| `MMOS.state` | No | No state mutations |
| `MMOS.setScene()` | No | Not called |
| Mode registrations | No | Unchanged |
| Readiness gates | No | `init()` functions untouched |
| Loader/error overlays | No | Not used during login |
| Fullscreen controller | No | Not used during login |
| Event bus | No | No events emitted |

The login flow operates entirely within the **entry screen layer**, which is architecturally outside MMOS's jurisdiction. MMOS only activates when `startArena()` fires, which happens after the user clicks "Enter Arena" post-authentication.

---

## 6. VALIDATION PLAN

### Test 1: Fresh unauthenticated visit

**Steps:**
1. Clear all cookies for `missionmedinstitute.com`
2. Navigate to `/arena`
3. Verify: Arena entry screen loads with "Sign In Required" button
4. Verify: Inline login form is visible (not WP HTML, not a redirect)
5. Verify: URL remains `/arena` throughout

**Expected:** Form renders inside Arena. No navigation occurs. No `wp-login.php` in the address bar at any point.

### Test 2: Successful login flow

**Steps:**
1. Starting from unauthenticated state (Test 1)
2. Enter valid credentials in the inline form
3. Click "Continue to Arena"
4. Observe loading states: "Verifying identity..." then "Establishing secure session..." then "Loading your profile..."
5. Verify: Welcome message appears with correct display name
6. Verify: "Enter Arena" button unlocks and pulses
7. Click "Enter Arena"
8. Verify: Lobby loads normally with avatar, mode cards, MMOS topbar

**Expected:** Complete login-to-lobby flow with zero page navigations. URL stays `/arena`.

### Test 3: Invalid credentials

**Steps:**
1. Enter wrong password
2. Click "Continue to Arena"
3. Verify: Error message appears inline ("Incorrect password. Please try again.")
4. Verify: Password field clears and receives focus
5. Verify: Form is immediately usable for retry

**Expected:** Graceful inline error. No navigation. No alert dialogs.

### Test 4: MMOS integrity post-login

**Steps:**
1. Complete Test 2 (successful login into lobby)
2. Navigate to each MMOS mode: play, profile, compete, leaderboard
3. Use MMOS Back button to return to lobby
4. Navigate to drills (external mode)
5. Return to Arena from drills
6. Test fullscreen toggle

**Expected:** All MMOS navigation works identically to the current production behavior. No regressions.

### Test 5: Session persistence across refresh

**Steps:**
1. Complete Test 2
2. Refresh the page (F5)
3. Verify: Boot sequence detects existing WP cookie + Supabase session
4. Verify: Entry screen shows "Welcome back, [Name]" directly (no login form)
5. Click "Enter Arena"

**Expected:** Refresh behavior unchanged from current production when user IS authenticated.

### Test 6: Logout and re-login

**Steps:**
1. From authenticated lobby, trigger logout (via profile menu or MMOS topbar)
2. Verify: Redirected to `/arena?logged_out=1`
3. Verify: Entry screen shows "You signed out. Sign in to re-enter the Arena."
4. Verify: Inline login form appears
5. Log in again via inline form
6. Verify: Full flow completes without navigation

**Expected:** Complete logout/re-login cycle stays inside Arena.

### Test 7: Fallback link

**Steps:**
1. From unauthenticated state with inline form visible
2. Click "Use full account page" link
3. Verify: Navigates to `/my-account/` (existing WP login)
4. Log in via WP
5. Verify: Redirected back to `/arena?redirected=1`
6. Verify: Normal authenticated entry screen

**Expected:** The escape hatch still works for password reset, registration, or any user who prefers the full WP login.

### Test 8: Network failure during login

**Steps:**
1. Simulate offline state (DevTools Network tab)
2. Attempt login via inline form
3. Verify: "Connection error. Please check your network and try again." appears
4. Re-enable network
5. Retry login

**Expected:** Graceful error handling. No stuck loading states.

### Test 9: Mobile viewport

**Steps:**
1. Test all above scenarios at 375px width (iPhone SE) and 414px width (iPhone 14)
2. Verify: Form inputs are touch-friendly (min 44px tap targets)
3. Verify: Keyboard doesn't obscure the form
4. Verify: Submit button is reachable without scrolling

**Expected:** Full functionality on mobile viewports using existing responsive CSS.

---

## APPENDIX: Auth flow diagram

```
UNAUTHENTICATED USER
        |
        v
  /arena (loads CDN HTML via arena-route-proxy.php)
        |
        v
  boot() -> enforceAuthOrRedirect()
        |
        v
  runAuthExchange() -- FAILS (no WP cookie)
        |
        v
  showArenaAuthRequiredState()
        |
        v
  [CURRENT]                          [NEW]
  Shows WP form or                   Shows Arena-native
  redirect link                      AJAX login form
  -> user clicks ->                  -> user submits ->
  LEAVES ARENA                       fetch() to wp-admin/admin-ajax.php
  -> wp-login.php                           |
  -> redirect back                          v
  -> full page reload              wp_signon() sets cookie
                                           |
                                           v
                                   runAuthExchange() -- SUCCEEDS
                                           |
                                           v
                                   runBootstrapSession()
                                           |
                                           v
                                   supabase.auth.setSession()
                                           |
                                           v
                                   Hydrate ArenaUser
                                           |
                                           v
                                   Unlock "Enter Arena"
                                           |
                                           v
                                   [USER IN ARENA - MMOS ACTIVATES]
```
