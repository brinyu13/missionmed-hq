// Keep the index's local bootstrap ahead of the application when packaging.
// Relative inline imports cannot resolve from the standalone release inventory.
export function packagedBrowserEntry(sourceIndex){
  const matches=[...sourceIndex.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)]
    .filter(match=>match[1].includes('IndexedDbAdapter')&&match[1].includes('local-synthetic-intelligence-021.js'));
  if(matches.length!==1)throw new Error('TIMELINE_LOCAL_BOOTSTRAP_NOT_UNIQUE');
  const bootstrap=matches[0][1].replace(/(\bfrom\s*|\bimport\s*)(['"])\.\/js\//g,'$1$2./web/js/');
  return{
    bootstrapElement:matches[0][0],
    contents:`${bootstrap}\nawait import("./web/js/407f-engineering-adapter.js");\nawait import("./web/js/family-022.js");\n`
  };
}
