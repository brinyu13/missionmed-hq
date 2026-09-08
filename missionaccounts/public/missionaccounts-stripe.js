const STRIPE_JS_URL = 'https://js.stripe.com/v3/';
let stripeJsPromise = null;

export function isSafePublishableKey(value, mode) {
  if (!['test', 'live'].includes(mode)) return false;
  return new RegExp(`^pk_${mode}_[A-Za-z0-9_]+$`).test(String(value || ''));
}

export function loadStripeJs({ documentObject = document, windowObject = window } = {}) {
  if (typeof windowObject.Stripe === 'function') return Promise.resolve(windowObject.Stripe);
  if (stripeJsPromise) return stripeJsPromise;
  stripeJsPromise = new Promise((resolve, reject) => {
    const existing = documentObject.querySelector(`script[src="${STRIPE_JS_URL}"]`);
    const script = existing || documentObject.createElement('script');
    const finish = () => {
      if (typeof windowObject.Stripe !== 'function') {
        stripeJsPromise = null;
        reject(new Error('Stripe secure payment form did not become available.'));
        return;
      }
      resolve(windowObject.Stripe);
    };
    const fail = () => {
      stripeJsPromise = null;
      reject(new Error('Stripe secure payment form could not be loaded.'));
    };
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', fail, { once: true });
    if (!existing) {
      script.src = STRIPE_JS_URL;
      script.async = true;
      documentObject.head.append(script);
    }
  });
  return stripeJsPromise;
}

export async function confirmStripeSetup({ stripe, elements, returnUrl }) {
  if (!stripe || !elements) throw new Error('Stripe secure payment form is not ready.');
  const submitted = await elements.submit();
  if (submitted?.error) return { error: submitted.error, setupIntent: null };
  return stripe.confirmSetup({
    elements,
    redirect: 'if_required',
    confirmParams: {
      return_url: returnUrl,
      payment_method_data: { allow_redisplay: 'always' },
    },
  });
}

function paymentSetupMarkup() {
  return `<style>
    #missionaccountsStripeOverlay{position:fixed;inset:0;z-index:2147483600;display:grid;place-items:end center;background:rgba(10,13,20,.56);backdrop-filter:blur(4px);padding:0}
    #missionaccountsStripeDialog{width:min(720px,100%);max-height:92vh;overflow:auto;border:0;border-radius:22px 22px 0 0;background:var(--sheet,#fffdf7);color:var(--ink,#171a21);box-shadow:0 -24px 70px rgba(0,0,0,.34);padding:26px 28px 30px;font-family:var(--sans,system-ui,sans-serif)}
    #missionaccountsStripeDialog h2{margin:0;padding-right:44px;font-size:24px;line-height:1.15;font-weight:900;font-style:italic;letter-spacing:-.02em}
    #missionaccountsStripeDialog p{margin:9px 0;color:var(--ink2,#535969);font-size:15px;line-height:1.55}
    #missionaccountsStripeDialog .mma-stripe-rule{margin:16px 0;padding:14px 16px;border:1px solid var(--line,#d9d4c7);border-radius:14px;background:var(--paper,#f7f3ea)}
    #missionaccountsStripeDialog .mma-stripe-rule strong{display:block;color:var(--ink,#171a21);margin-bottom:4px}
    #missionaccountsStripeElement{min-height:78px;margin:18px 0}
    #missionaccountsStripeStatus{min-height:24px;margin-top:10px;color:var(--ink2,#535969)}
    #missionaccountsStripeStatus[data-kind="error"]{color:#a12622}
    #missionaccountsStripeStatus[data-kind="success"]{color:#17663a}
    #missionaccountsStripeDialog .mma-stripe-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
    #missionaccountsStripeDialog button{appearance:none;border:1px solid var(--line,#d9d4c7);border-radius:999px;padding:10px 16px;background:transparent;color:inherit;font:800 14px/1 var(--sans,system-ui,sans-serif);cursor:pointer}
    #missionaccountsStripeDialog button[data-primary]{background:var(--ink,#171a21);border-color:var(--ink,#171a21);color:var(--sheet,#fffdf7)}
    #missionaccountsStripeDialog button:disabled{opacity:.5;cursor:wait}
    #missionaccountsStripeClose{position:absolute;right:22px;top:20px;width:36px;height:36px;padding:0!important;font-size:22px!important}
    #missionaccountsStripeDialog .mma-stripe-secure{font-size:12.5px;color:var(--mute,#747987)}
    @media (min-width:760px){#missionaccountsStripeOverlay{place-items:center;padding:24px}#missionaccountsStripeDialog{position:relative;border-radius:22px}}
    @media (prefers-reduced-motion:no-preference){#missionaccountsStripeDialog{animation:mmaStripeUp .2s ease-out}@keyframes mmaStripeUp{from{transform:translateY(18px);opacity:.75}}}
  </style>
  <section id="missionaccountsStripeDialog" role="dialog" aria-modal="true" aria-labelledby="missionaccountsStripeTitle" tabindex="-1">
    <button type="button" id="missionaccountsStripeClose" aria-label="Close secure payment setup">×</button>
    <h2 id="missionaccountsStripeTitle">Secure payment setup</h2>
    <p>Your payment details go directly to Stripe through its secure Payment Element. MissionMed never receives or stores your full card number.</p>
    <div class="mma-stripe-rule"><strong>Save for future Drills payments</strong>By saving, you authorize MissionMed Institute to keep this payment method securely with Stripe for future Drills payments. This does not turn on automatic billing. You will review and accept the separate $25-per-calendar-day authorization next.</div>
    <div id="missionaccountsStripeElement" aria-label="Stripe secure payment form"></div>
    <div id="missionaccountsStripeStatus" role="status" aria-live="polite">Opening Stripe’s secure form…</div>
    <div class="mma-stripe-actions">
      <button type="button" data-primary id="missionaccountsStripeSubmit" disabled>Save payment method</button>
      <button type="button" id="missionaccountsStripeCancel">Not now</button>
    </div>
    <p class="mma-stripe-secure">Saving a payment method does not create a charge or turn on automatic billing.</p>
  </section>`;
}

function setupResultMessage(setupIntent) {
  if (setupIntent?.status === 'succeeded') {
    return 'Stripe accepted the payment method. MissionAccounts is waiting for the signed webhook before marking it on file.';
  }
  if (setupIntent?.status === 'processing') return 'Stripe is still processing the payment method. MissionAccounts will update after the signed webhook arrives.';
  return 'Stripe received the setup request. MissionAccounts will update only after Stripe confirms it with a signed webhook.';
}

export function openSecureStripeSetup({
  publishableKey,
  mode,
  createSession,
  refresh,
  notify,
  returnUrl,
  documentObject = document,
  windowObject = window,
  stripeLoader = loadStripeJs,
} = {}) {
  if (!isSafePublishableKey(publishableKey, mode)) throw new Error('Secure payment setup configuration is invalid.');
  if (typeof createSession !== 'function') throw new Error('Secure payment setup session is unavailable.');
  const prior = documentObject.getElementById('missionaccountsStripeOverlay');
  if (prior) prior.remove();
  const returnFocus = documentObject.activeElement;
  const overlay = documentObject.createElement('div');
  overlay.id = 'missionaccountsStripeOverlay';
  overlay.innerHTML = paymentSetupMarkup();
  documentObject.body.append(overlay);
  const dialog = overlay.querySelector('#missionaccountsStripeDialog');
  const closeButton = overlay.querySelector('#missionaccountsStripeClose');
  const cancelButton = overlay.querySelector('#missionaccountsStripeCancel');
  const submitButton = overlay.querySelector('#missionaccountsStripeSubmit');
  const status = overlay.querySelector('#missionaccountsStripeStatus');
  let paymentElement = null;
  let closed = false;

  const setStatus = (message, kind = '') => {
    status.textContent = message;
    status.dataset.kind = kind;
  };
  const close = () => {
    if (closed) return;
    closed = true;
    try { paymentElement?.destroy(); } catch {}
    overlay.remove();
    if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus({ preventScroll: true });
  };
  const onKeydown = event => {
    if (event.key === 'Escape' && !submitButton.disabled) close();
  };
  overlay.addEventListener('keydown', onKeydown);
  closeButton.addEventListener('click', close);
  cancelButton.addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay && !submitButton.disabled) close(); });
  dialog.focus({ preventScroll: true });

  const ready = (async () => {
    try {
      const Stripe = await stripeLoader({ documentObject, windowObject });
      if (closed) return null;
      const session = await createSession();
      if (closed) return null;
      if (!session?.client_secret || !/^seti_[A-Za-z0-9_]+_secret_[A-Za-z0-9_]+$/.test(session.client_secret)) {
        throw new Error('Stripe setup session is incomplete.');
      }
      const stripe = Stripe(publishableKey);
      const elements = stripe.elements({
        clientSecret: session.client_secret,
        appearance: {
          theme: documentObject.documentElement.dataset.theme === 'dark' ? 'night' : 'stripe',
          variables: { borderRadius: '12px', colorPrimary: '#1f57d6', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' },
        },
      });
      paymentElement = elements.create('payment', { layout: 'tabs' });
      paymentElement.mount('#missionaccountsStripeElement');
      setStatus('Stripe’s secure form is ready.');
      submitButton.disabled = false;
      submitButton.addEventListener('click', async () => {
        submitButton.disabled = true;
        closeButton.disabled = true;
        cancelButton.disabled = true;
        setStatus('Saving securely with Stripe…');
        try {
          const result = await confirmStripeSetup({ stripe, elements, returnUrl });
          if (result?.error) {
            setStatus(result.error.message || 'Stripe could not save this payment method.', 'error');
            submitButton.disabled = false;
            closeButton.disabled = false;
            cancelButton.disabled = false;
            return;
          }
          setStatus(setupResultMessage(result?.setupIntent), 'success');
          cancelButton.textContent = 'Close';
          cancelButton.disabled = false;
          closeButton.disabled = false;
          if (typeof refresh === 'function') await refresh();
          if (typeof notify === 'function') notify('Payment setup sent securely to Stripe.');
        } catch (error) {
          setStatus(error instanceof Error ? error.message : 'Stripe could not save this payment method.', 'error');
          submitButton.disabled = false;
          closeButton.disabled = false;
          cancelButton.disabled = false;
        }
      });
      return { stripe, elements, paymentElement, session };
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Secure payment setup is unavailable.', 'error');
      cancelButton.textContent = 'Close';
      cancelButton.disabled = false;
      closeButton.disabled = false;
      return null;
    }
  })();

  return { close, ready, overlay };
}

function actionDialogMarkup({ needsConsent, danger }) {
  return `<style>
    #missionaccountsPaymentOverlay{position:fixed;inset:0;z-index:2147483600;display:grid;place-items:end center;background:rgba(10,13,20,.56);backdrop-filter:blur(4px)}
    #missionaccountsPaymentDialog{position:relative;width:min(680px,100%);max-height:92vh;overflow:auto;border:0;border-radius:22px 22px 0 0;background:var(--sheet,#fffdf7);color:var(--ink,#171a21);box-shadow:0 -24px 70px rgba(0,0,0,.34);padding:26px 28px 30px;font-family:var(--sans,system-ui,sans-serif)}
    #missionaccountsPaymentDialog h2{margin:0;padding-right:44px;font-size:24px;line-height:1.15;font-weight:900;font-style:italic;letter-spacing:-.02em}
    #missionaccountsPaymentDialog p{margin:9px 0;color:var(--ink2,#535969);font-size:15px;line-height:1.55}
    #missionaccountsPaymentFacts{margin:16px 0;padding:14px 16px 14px 34px;border:1px solid var(--line,#d9d4c7);border-radius:14px;background:var(--paper,#f7f3ea);color:var(--ink2,#535969)}
    #missionaccountsPaymentFacts li{margin:6px 0;line-height:1.45}
    #missionaccountsPaymentConsent{display:${needsConsent ? 'flex' : 'none'};gap:10px;align-items:flex-start;margin:16px 0;font-weight:700;line-height:1.45}
    #missionaccountsPaymentConsent input{width:20px;height:20px;flex:0 0 auto;margin-top:1px}
    #missionaccountsPaymentStatus{min-height:23px;margin-top:10px;color:var(--ink2,#535969)}
    #missionaccountsPaymentStatus[data-kind="error"]{color:#a12622}
    #missionaccountsPaymentDialog .mma-payment-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
    #missionaccountsPaymentDialog button{appearance:none;border:1px solid var(--line,#d9d4c7);border-radius:999px;padding:10px 16px;background:transparent;color:inherit;font:800 14px/1 var(--sans,system-ui,sans-serif);cursor:pointer}
    #missionaccountsPaymentConfirm{background:${danger ? '#a12622' : 'var(--ink,#171a21)'}!important;border-color:${danger ? '#a12622' : 'var(--ink,#171a21)'}!important;color:#fff!important}
    #missionaccountsPaymentDialog button:disabled{opacity:.5;cursor:wait}
    #missionaccountsPaymentClose{position:absolute;right:22px;top:20px;width:36px;height:36px;padding:0!important;font-size:22px!important}
    @media (min-width:760px){#missionaccountsPaymentOverlay{place-items:center;padding:24px}#missionaccountsPaymentDialog{border-radius:22px}}
  </style>
  <section id="missionaccountsPaymentDialog" role="dialog" aria-modal="true" aria-labelledby="missionaccountsPaymentTitle" tabindex="-1">
    <button type="button" id="missionaccountsPaymentClose" aria-label="Close">×</button>
    <h2 id="missionaccountsPaymentTitle"></h2>
    <p id="missionaccountsPaymentIntro"></p>
    <ul id="missionaccountsPaymentFacts"></ul>
    <label id="missionaccountsPaymentConsent"><input type="checkbox" id="missionaccountsPaymentConsentCheck"><span id="missionaccountsPaymentConsentText"></span></label>
    <div id="missionaccountsPaymentStatus" role="status" aria-live="polite"></div>
    <div class="mma-payment-actions"><button type="button" id="missionaccountsPaymentConfirm"></button><button type="button" id="missionaccountsPaymentCancel">Not now</button></div>
  </section>`;
}

export function openPaymentActionDialog({
  title,
  intro,
  facts = [],
  consentLabel = '',
  confirmLabel,
  danger = false,
  onConfirm,
  documentObject = document,
} = {}) {
  if (typeof onConfirm !== 'function') throw new Error('Payment action is unavailable.');
  const prior = documentObject.getElementById('missionaccountsPaymentOverlay');
  if (prior) prior.remove();
  const returnFocus = documentObject.activeElement;
  const overlay = documentObject.createElement('div');
  overlay.id = 'missionaccountsPaymentOverlay';
  overlay.innerHTML = actionDialogMarkup({ needsConsent: Boolean(consentLabel), danger });
  documentObject.body.append(overlay);
  const dialog = overlay.querySelector('#missionaccountsPaymentDialog');
  const closeButton = overlay.querySelector('#missionaccountsPaymentClose');
  const cancelButton = overlay.querySelector('#missionaccountsPaymentCancel');
  const confirmButton = overlay.querySelector('#missionaccountsPaymentConfirm');
  const consent = overlay.querySelector('#missionaccountsPaymentConsentCheck');
  const status = overlay.querySelector('#missionaccountsPaymentStatus');
  overlay.querySelector('#missionaccountsPaymentTitle').textContent = title || 'Confirm payment action';
  overlay.querySelector('#missionaccountsPaymentIntro').textContent = intro || '';
  const factsList = overlay.querySelector('#missionaccountsPaymentFacts');
  for (const fact of facts) {
    const item = documentObject.createElement('li');
    item.textContent = String(fact);
    factsList.append(item);
  }
  if (!facts.length) factsList.hidden = true;
  overlay.querySelector('#missionaccountsPaymentConsentText').textContent = consentLabel;
  confirmButton.textContent = confirmLabel || 'Confirm';
  confirmButton.disabled = Boolean(consentLabel);
  if (consentLabel) consent.addEventListener('change', () => { confirmButton.disabled = !consent.checked; });
  let settled = false;
  let busy = false;
  let resolveResult;
  const result = new Promise(resolve => { resolveResult = resolve; });
  const close = outcome => {
    if (settled || busy) return;
    settled = true;
    overlay.remove();
    if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus({ preventScroll: true });
    resolveResult(outcome);
  };
  const cancel = () => close(false);
  closeButton.addEventListener('click', cancel);
  cancelButton.addEventListener('click', cancel);
  overlay.addEventListener('click', event => { if (event.target === overlay) cancel(); });
  overlay.addEventListener('keydown', event => { if (event.key === 'Escape') cancel(); });
  confirmButton.addEventListener('click', async () => {
    if (confirmButton.disabled || settled) return;
    busy = true;
    confirmButton.disabled = true;
    closeButton.disabled = true;
    cancelButton.disabled = true;
    status.textContent = 'Saving to MissionAccounts…';
    try {
      await onConfirm();
      busy = false;
      settled = true;
      overlay.remove();
      if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus({ preventScroll: true });
      resolveResult(true);
    } catch (error) {
      busy = false;
      status.textContent = error instanceof Error ? error.message : 'MissionAccounts could not save this payment action.';
      status.dataset.kind = 'error';
      confirmButton.disabled = Boolean(consentLabel) && !consent.checked;
      closeButton.disabled = false;
      cancelButton.disabled = false;
    }
  });
  dialog.focus({ preventScroll: true });
  return { close: cancel, result, overlay };
}
