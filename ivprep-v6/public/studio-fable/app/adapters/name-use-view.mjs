// Consumes only the already owner-checked saved-attempt view. No current setup,
// browser envelope fallback, provider analysis or authorization is owned here.
import {buildNameUseReview,buildEvidenceMomentLinks} from '../../../studio/presentation-view-model.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function nameUseViewMarkup(a) {
  const model=buildNameUseReview({session:a?.saved?.session,sessionDetail:a?.detail});
  const moments=model.status==='AVAILABLE'?model.moments.map(moment=>{
    const link=buildEvidenceMomentLinks(model.replayEvidence,[moment.segmentId],a.sealed?.durationMs)[0];
    const seek=a.recordingId&&link?.available?`<a class="btn btn-quiet" href="#/film/${encodeURIComponent(a.id)}?t=${link.startMs/1000}">${esc(link.label)} · replay</a>`:'<small>Replay range unavailable</small>';
    return `<article><p class="note">${esc(moment.label)}</p><blockquote>${esc(moment.text)}</blockquote>${seek}</article>`;
  }).join(''):'';
  const empty=model.status==='AVAILABLE'&&!model.moments.length?'<p class="note">No exact name matches in the available transcript. This is not a score or a failure.</p>':'';
  return `<details class="housing panel expert" data-name-use-review><summary>Optional name-use observations</summary><h3 class="t-h3">${esc(model.heading)}</h3><p class="note">${esc(model.copy)}</p>${moments}${empty}</details>`;
}
