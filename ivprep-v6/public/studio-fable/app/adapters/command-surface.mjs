// Home command surface: markup + wiring around the pure command router.
// Enter and chip clicks both route; unknown text shows suggestions and never navigates.
import { routeCommand, isSafeHref } from './command-router.mjs';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chipMarkup = chip => `<button type="button" class="chip-cmd" data-command-href="${esc(chip.href)}" data-command-id="${esc(chip.id)}">${esc(chip.label)}</button>`;

export function commandSurfaceMarkup({ chips = [] } = {}) {
  return `<section class="command-surface housing" data-command-surface aria-labelledby="command-label">
      <form class="command-form" data-command-form role="search" novalidate>
        <div class="command-row"><label class="t-kick gold command-label" id="command-label" for="command-input">What do you want to work on?</label><input id="command-input" class="command-input" type="text" name="command" autocomplete="off" spellcheck="false" maxlength="200" placeholder="Try “practice my weakness answer” or “prepare me for SUNY Downstate”" aria-describedby="command-help"><button type="submit" class="btn btn-secondary command-go">Go ▸</button></div>
        <div class="command-chips" role="group" aria-label="Suggestions">${chips.filter(chip => isSafeHref(chip.href)).map(chipMarkup).join('')}</div>
        <p class="note command-help" id="command-help" role="status" aria-live="polite"></p>
      </form>
    </section>`;
}

export function mountCommandSurface(host, { questions = [], latest = null, navigate = href => { globalThis.location.hash = href; }, isCurrent = () => true } = {}) {
  if (!host?.querySelector) return () => {};
  const form = host.querySelector('[data-command-form]'), input = host.querySelector('#command-input'), help = host.querySelector('#command-help');
  if (!form || !input || !help) return () => {};
  const go = href => { if (isCurrent() && isSafeHref(href)) navigate(href); };
  const onSubmit = event => {
    event.preventDefault?.();
    if (!isCurrent()) return;
    const result = routeCommand(input.value, { questions, latest });
    if (result.kind === 'route') { help.textContent = result.label; go(result.href); return; }
    help.innerHTML = `<span>${esc(result.message)}</span> ${result.suggestions.map(chipMarkup).join('')}`;
    help.querySelector?.('button')?.focus?.();
  };
  const onClick = event => {
    const chip = event.target?.closest?.('[data-command-href]');
    if (!chip) return;
    event.preventDefault?.();
    go(chip.getAttribute?.('data-command-href') ?? chip.dataset?.commandHref);
  };
  form.addEventListener('submit', onSubmit);
  host.addEventListener('click', onClick);
  return () => { form.removeEventListener('submit', onSubmit); host.removeEventListener('click', onClick); };
}
