/* MR coaching coupon interaction only. No Hero, commerce or provider mutation. */
(() => {
  'use strict';
  const section = document.querySelector('#private-coaching');
  const button = section?.querySelector('[data-coaching-copy]');
  const code = section?.querySelector('[data-coaching-code]');
  const status = section?.querySelector('[data-coaching-copy-status]');
  if (!button || !code || !status) return;
  button.addEventListener('click', async () => {
    const value = code.textContent.trim();
    if (value !== 'MATCHREADY2026' || button.disabled) return;
    button.disabled = true;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(value);
      status.textContent = 'Code copied. Your checkout will show the applicable discount.';
    } catch (_) {
      status.textContent = 'Select and copy MATCHREADY2026 above. You can also enter it at checkout.';
    } finally {
      button.disabled = false;
    }
  });
})();
