# MissionMed WordPress Connector Architecture

**Prepared for:** Dr. Brian — MissionMed Institute
**Date:** March 6, 2026
**Status:** Architecture Proposal — Ready for Review

---

## 1. Problem Statement

Claude currently interacts with the MissionMed WordPress site through an authenticated Chrome browser session, using session cookies and a WordPress nonce. This approach works but is fragile: it requires Dr. Brian to be logged in, it depends on browser state, and the nonce expires. A proper connector architecture is needed so Claude can perform controlled WordPress actions reliably and independently.

---

## 2. Recommended Architecture

The recommended approach uses **three layers** working together:

```
┌──────────────────────────────────────────────────────────────┐
│                     CLAUDE DESKTOP                           │
│                                                              │
│  Claude sends structured tool calls via MCP protocol         │
│  e.g. "create_draft_post", "update_post", "list_posts"      │
└──────────────────┬───────────────────────────────────────────┘
                   │  MCP Protocol (stdio)
                   ▼
┌──────────────────────────────────────────────────────────────┐
│              MCP SERVER (runs locally on Mac)                 │
│                                                              │
│  • Node.js process launched by Claude Desktop                │
│  • Exposes WordPress tools to Claude via MCP                 │
│  • Enforces safety rules BEFORE calling WordPress            │
│  • Blocks page edits, plugin changes, Elementor content      │
│  • Logs every action for audit                               │
│  • Holds the Application Password credential                 │
└──────────────────┬───────────────────────────────────────────┘
                   │  HTTPS (REST API + Basic Auth)
                   ▼
┌──────────────────────────────────────────────────────────────┐
│         WORDPRESS (missionmedinstitute.com)                   │
│                                                              │
│  Custom Plugin: "MissionMed Claude Connector"                │
│  • Registers filtered REST endpoints under /wp-json/mmc/v1  │
│  • Validates requests against an allowlist                   │
│  • Blocks modifications to Elementor-managed pages           │
│  • Rate-limits API calls                                     │
│  • Returns structured JSON responses                         │
│                                                              │
│  Authentication: WordPress Application Password              │
│  (built into WordPress 5.6+, no extra plugins needed)        │
└──────────────────────────────────────────────────────────────┘
```

### Why This Architecture

**Option considered: Browser connector only** — fragile, session-dependent, no safety guards. Rejected.

**Option considered: Direct REST API with Application Password, no plugin** — exposes the full WordPress REST API surface, including page editing, user management, plugin control. Too dangerous. Rejected.

**Option considered: Custom plugin only, no MCP server** — would require Claude to make raw HTTP calls through bash, harder to control and audit. Rejected.

**Chosen: Custom plugin + MCP server** — defense in depth. The MCP server enforces safety rules on the Claude side. The WordPress plugin enforces them on the server side. Even if one layer fails, the other catches it.

---

## 3. Authentication Model

### WordPress Application Passwords

WordPress 5.6+ includes built-in Application Passwords. This is the recommended auth method because it requires no additional plugins, can be scoped to a specific user, can be revoked instantly from the WordPress admin panel, and works over HTTPS with standard Basic Auth.

**Setup steps:**

1. In WordPress admin, go to **Users → Your Profile**
2. Scroll to **Application Passwords**
3. Enter name: `Claude MCP Connector`
4. Click **Add New Application Password**
5. Copy the generated password (shown once)
6. Store it in the MCP server's environment config

**How it's used:**

Every REST API call from the MCP server includes an `Authorization` header:

```
Authorization: Basic base64(username:application_password)
```

This authenticates as the `brinyu` administrator account but through a dedicated credential that can be revoked without changing the main password.

### Security Considerations

The Application Password should be stored in a `.env` file on Dr. Brian's local machine, never committed to version control. The MCP server reads it at startup. HTTPS is mandatory (already in place on the site). The credential should be rotated periodically — every 90 days is reasonable.

---

## 4. WordPress Plugin: MissionMed Claude Connector

### Purpose

A lightweight custom plugin that sits between the WordPress REST API and incoming requests from Claude. It exposes a controlled set of endpoints under a custom namespace and enforces safety rules at the WordPress level.

### Endpoint Structure

All endpoints live under: `https://missionmedinstitute.com/wp-json/mmc/v1/`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mmc/v1/posts` | GET | List posts (with filters for status, category, date) |
| `/mmc/v1/posts` | POST | Create a new draft post |
| `/mmc/v1/posts/{id}` | GET | Get a single post by ID |
| `/mmc/v1/posts/{id}` | PUT | Update an existing post (title, content, status, categories, tags) |
| `/mmc/v1/posts/{id}/trash` | POST | Move a post to trash |
| `/mmc/v1/categories` | GET | List all categories |
| `/mmc/v1/categories` | POST | Create a new category |
| `/mmc/v1/tags` | GET | List all tags |
| `/mmc/v1/tags` | POST | Create a new tag |
| `/mmc/v1/media` | POST | Upload a media file (images for blog posts) |
| `/mmc/v1/status` | GET | Health check / connection test |

### What Is Explicitly NOT Exposed

The plugin does **not** register endpoints for pages (Elementor-managed content), users or roles, plugins or themes, site settings or options, WooCommerce orders or products, LearnDash courses, menus or widgets, or raw SQL or database operations.

### Safety Guards Built Into the Plugin

**1. Post-type restriction:** The plugin only operates on the `post` post type. Any request targeting a `page`, `product`, `sfwd-courses`, or other post type is rejected with a `403 Forbidden`.

**2. Elementor detection:** Before allowing any update, the plugin checks whether the post has Elementor metadata (`_elementor_data`, `_elementor_edit_mode`). If it does, the update is blocked. This prevents accidental corruption of Elementor layouts.

**3. Status transitions:** The plugin enforces a status allowlist. Claude can set a post to `draft`, `pending`, or `trash`. Publishing (`publish`) requires an explicit flag and is logged separately. Direct deletion (bypassing trash) is not available.

**4. Rate limiting:** Maximum 30 requests per minute per Application Password. This prevents runaway loops.

**5. Content validation:** Post titles are limited to 200 characters. Post content is sanitized through `wp_kses_post()`. No raw HTML injection of scripts or iframes.

**6. Audit logging:** Every action is logged to a custom database table with timestamp, action type, post ID, and a summary of what changed.

---

## 5. MCP Server Design

### Overview

The MCP server is a Node.js application that runs locally on Dr. Brian's Mac, launched automatically by Claude Desktop. It translates Claude's tool calls into WordPress REST API requests and enforces a second layer of safety rules.

### MCP Tools Exposed to Claude

```
Tool: wp_list_posts
  Description: List WordPress posts with optional filters
  Parameters:
    - status: "draft" | "publish" | "pending" | "trash" (optional)
    - category: string (optional)
    - search: string (optional)
    - per_page: number (default 10, max 50)

Tool: wp_create_post
  Description: Create a new WordPress post (defaults to draft)
  Parameters:
    - title: string (required)
    - content: string (required)
    - status: "draft" | "pending" (default "draft")
    - categories: string[] (optional)
    - tags: string[] (optional)
    - featured_image_id: number (optional)

Tool: wp_update_post
  Description: Update an existing post's content or metadata
  Parameters:
    - post_id: number (required)
    - title: string (optional)
    - content: string (optional)
    - status: "draft" | "pending" | "publish" (optional)
    - categories: string[] (optional)
    - tags: string[] (optional)

Tool: wp_trash_post
  Description: Move a post to trash (reversible)
  Parameters:
    - post_id: number (required)

Tool: wp_get_post
  Description: Get full details of a single post
  Parameters:
    - post_id: number (required)

Tool: wp_list_categories
  Description: List all post categories

Tool: wp_list_tags
  Description: List all post tags

Tool: wp_upload_media
  Description: Upload an image for use in posts
  Parameters:
    - file_path: string (required)
    - alt_text: string (optional)

Tool: wp_connection_test
  Description: Verify the WordPress connection is working
```

### MCP Server Safety Rules

The MCP server enforces these rules before any request reaches WordPress:

1. **No page modifications** — if a post_id resolves to a page, reject it
2. **Publish requires confirmation** — when status is set to `publish`, the MCP server returns a confirmation prompt to Claude, which Claude must relay to the user
3. **Content size limits** — reject posts with content over 100KB
4. **No bulk operations** — each tool call operates on a single post
5. **Dry-run mode** — a `DRY_RUN=true` environment flag makes all write operations return what would happen without executing

---

## 6. Example API Request Flow

Here is what happens when Claude creates a blog post:

**Step 1 — Claude decides to create a post:**
```
Claude calls tool: wp_create_post
  title: "New CME Resource: Wilderness Medicine Updates"
  content: "<p>The MissionMed Institute is pleased to announce...</p>"
  status: "draft"
  categories: ["CME Resources", "Blog"]
```

**Step 2 — MCP server validates:**
- Title length: 49 chars ✓
- Status is "draft" (no publish confirmation needed) ✓
- Content size: 847 bytes ✓
- No prohibited post type ✓

**Step 3 — MCP server sends to WordPress:**
```
POST https://missionmedinstitute.com/wp-json/mmc/v1/posts
Authorization: Basic <base64 credentials>
Content-Type: application/json

{
  "title": "New CME Resource: Wilderness Medicine Updates",
  "content": "<p>The MissionMed Institute is pleased to announce...</p>",
  "status": "draft",
  "categories": ["CME Resources", "Blog"]
}
```

**Step 4 — WordPress plugin validates:**
- Post type is `post` ✓
- No Elementor metadata ✓
- Status is in allowlist ✓
- Content passes `wp_kses_post()` ✓
- Rate limit not exceeded ✓
- Logs the action ✓

**Step 5 — Response returned to Claude:**
```json
{
  "success": true,
  "post_id": 4720,
  "status": "draft",
  "edit_url": "https://missionmedinstitute.com/wp-admin/post.php?post=4720&action=edit",
  "message": "Draft post created successfully."
}
```

**Step 6 — Claude reports to Dr. Brian:**
> "I've created a draft post titled 'New CME Resource: Wilderness Medicine Updates' (Post ID 4720). You can review it in WordPress before publishing."

---

## 7. Claude Desktop Configuration

The MCP server is registered in Claude Desktop's configuration file:

```json
{
  "mcpServers": {
    "missionmed-wordpress": {
      "command": "node",
      "args": ["/path/to/missionmed-wp-mcp/server.js"],
      "env": {
        "WP_SITE_URL": "https://missionmedinstitute.com",
        "WP_USERNAME": "brinyu",
        "WP_APP_PASSWORD": "<application-password>",
        "DRY_RUN": "false",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

Once configured, Claude sees the `wp_*` tools automatically in every conversation. No browser session required.

---

## 8. Implementation Steps

### Phase 1: WordPress Application Password (30 minutes)

1. Log into WordPress admin
2. Go to Users → Profile → Application Passwords
3. Create a password named "Claude MCP Connector"
4. Save the credential securely

### Phase 2: WordPress Plugin (2–3 hours)

1. Create plugin directory: `wp-content/plugins/missionmed-claude-connector/`
2. Write the main plugin file with REST route registration
3. Implement the safety guards (Elementor detection, post-type check, rate limiter)
4. Add the audit logging table
5. Activate the plugin in WordPress admin
6. Test each endpoint with curl

### Phase 3: MCP Server (2–3 hours)

1. Create a Node.js project with the MCP SDK (`@modelcontextprotocol/sdk`)
2. Implement each tool (wp_create_post, wp_update_post, etc.)
3. Add the safety validation layer
4. Add environment-based configuration
5. Test locally with the MCP inspector

### Phase 4: Integration Testing (1 hour)

1. Register the MCP server in Claude Desktop config
2. Restart Claude Desktop
3. Run connection test: ask Claude to call `wp_connection_test`
4. Run write test: ask Claude to create and trash a draft post
5. Run safety test: ask Claude to modify a page (should be blocked)
6. Verify audit logs in WordPress

### Phase 5: Production Use

1. Disable DRY_RUN mode
2. Begin using Claude for blog post drafting and content management
3. Review audit logs weekly for the first month

---

## 9. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Elementor page corruption | Both MCP server and plugin block page edits; Elementor metadata check prevents any post with Elementor data from being modified |
| Accidental publishing | Publish action requires explicit user confirmation via Claude; plugin logs all status changes |
| Credential exposure | Application Password stored in local .env only; can be revoked instantly from WordPress admin |
| Runaway API calls | Rate limiter at 30 req/min; MCP server enforces single-item operations |
| Plugin conflict | Custom namespace `/mmc/v1/` avoids collision with other plugins; plugin has no frontend impact |
| WooCommerce/LearnDash interference | Plugin only operates on `post` type; all other post types are explicitly blocked |

---

## 10. Future Extensions

Once the core connector is stable, it could be extended to support WooCommerce product updates (with separate safety guards), LearnDash course content management, Yoast SEO metadata updates for posts, scheduled post publishing, and bulk content import from spreadsheets or documents.

Each extension would follow the same pattern: a new set of endpoints in the plugin, corresponding tools in the MCP server, and safety rules in both layers.

---

## Summary

The recommended architecture is a **custom WordPress plugin** paired with a **local MCP server**. The plugin exposes controlled REST endpoints under `/mmc/v1/` with built-in safety guards. The MCP server runs on Dr. Brian's Mac, holds the authentication credential, and provides WordPress tools directly to Claude Desktop. Together they create a defense-in-depth system that lets Claude manage blog content safely without requiring an active browser session.

Total estimated setup time: **one working day** (6–8 hours across all phases).
