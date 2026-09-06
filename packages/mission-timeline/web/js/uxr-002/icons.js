import {escapeHtml} from "./utils.js";

const paths={
  "house":'<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  "list-checks":'<path d="m3 6 2 2 4-4"/><path d="M11 6h10"/><path d="m3 12 2 2 4-4"/><path d="M11 12h10"/><path d="m3 18 2 2 4-4"/><path d="M11 18h10"/>',
  "presentation":'<path d="M2 3h20v14H2z"/><path d="m8 21 4-4 4 4"/><path d="M12 17v4"/>',
  "download":'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>',
  "file-up":'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/>',
  "chevron-left":'<path d="m15 18-6-6 6-6"/>',
  "chevron-right":'<path d="m9 18 6-6-6-6"/>',
  "external-link":'<path d="M15 3h6v6"/><path d="m10 14 11-11"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  "check":'<path d="m5 12 4 4L19 6"/>',
  "lock":'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  "arrow-right":'<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  "upload-cloud":'<path d="M16 16l-4-4-4 4"/><path d="M12 12v9"/><path d="M20.4 17.5A5 5 0 0 0 18 8.3 7 7 0 0 0 4.3 10.6 4.5 4.5 0 0 0 5.5 19H7"/>',
  "calendar":'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  "x":'<path d="m6 6 12 12M18 6 6 18"/>',
  "info":'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>'
};

export function icon(name,{size=20,label=null,className=""}={}){
  const body=paths[name]||paths.info;
  const aria=label?`role="img" aria-label="${escapeHtml(label)}"`:'aria-hidden="true"';
  return`<svg class="icon ${escapeHtml(className)}" ${aria} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
