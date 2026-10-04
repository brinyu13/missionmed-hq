// Display selection only. Existing producers retain measurement/primary-lock ownership.
export function overlayLayers(value) {
  return Object.fromEntries(['face','bodyHands','position'].map(key=>[key,value?.[key]!==false]));
}
export function liveOverlayVisibility(preferences) {
  const layers=overlayLayers(preferences?.overlayLayers),enabled=preferences?.overlaysVisible===true;
  return {face:enabled&&layers.face,hands:enabled&&layers.bodyHands,body:enabled&&layers.bodyHands,position:enabled&&layers.position};
}
