const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const source = fs.readFileSync(path.resolve(__dirname, '../../../../mu-plugins/missionmed-matrix-match-tools-rail.php'), 'utf8');
const script = source.match(/<script id="mmed-match-tools-rail-6050a">([\s\S]*?)<\/script>/)[1];
const style = source.match(/<style id="mmed-match-tools-rail-status-6050a">([\s\S]*?)<\/style>/)[1];
const names = ['StoryForge', 'RISE', 'Timeline', 'HomeBase', 'Arena', 'File Vault', 'PSForge', 'RankList IQ', 'LOR Studio', 'IV Prep On-Call', 'InterviewIQ'];
const wanted = ['HomeBase', 'RISE', 'StoryForge', 'File Vault', 'PS Forge', 'LOR Studio', 'Interview IQ', 'IV Prep On-Call', 'RankList IQ', 'Timeline Builder', 'IV Ready Gear'];
const statuses = ['🚧 In Development','✓ Ready','✓ Ready','✓ Ready','🚧 In Development','◇ Preview','◇ Preview','◇ Preview','◇ Preview','✓ Ready'];
function fixture(experience, locked, omit = []) {
  const links = names.filter(n => !omit.includes(n)).map((name, i) => `<li><a class="sos-nav-link" data-original="${i}" href="${locked ? 'javascript:void(0)' : '#app-' + i}" ${locked ? 'data-locked="true" aria-disabled="true" data-route="app-' + i + '"' : ''}><span class="sos-nav-icon">XX</span><span>${name}</span>${locked ? '<svg class="sos-nav-lock-icon"></svg>' : ''}</a></li>`).join('');
  return `<style>body{margin:0;background:#081725;font-family:Arial;color:white}#sos-sidebar{width:283px}.sos-nav-list{list-style:none;padding:0;margin:0}.sos-nav-label{font-size:9px;color:#657080}.sos-nav-link{box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:10px 16px;color:white;text-decoration:none;font-size:13px}.sos-nav-icon{width:24px}.sos-nav-lock-icon{width:14px;height:14px}@media(max-width:480px){#sos-sidebar{width:100%}}</style><style>${style}</style><div id="student-os-root"><aside id="sos-sidebar"><div class="sos-nav-section"><div class="sos-nav-label">MATCH TOOLS</div><ul class="sos-nav-list">${links}</ul></div><div><a class="sos-nav-link" data-original="${names.length}" href="#calendar"><span class="sos-nav-icon">CA</span><span>Calendar</span></a></div></aside></div><script>window.mmedDashboardV2={experience:${JSON.stringify(experience)}};window.originals=Array.from(document.querySelectorAll('a'));window.before=originals.map(a=>a.outerHTML);window.clicks=0;originals.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();window.clicks++}));</script><script>${script}</script>`;
}
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const page = await browser.newPage({viewport:{width:390,height:844}});
  for (const locked of [false,true]) {
    console.log('fixture',locked ? 'locked' : 'unlocked');
    await page.setContent(fixture('matrix2',locked));
    assert.deepEqual(await page.locator('li:not([hidden]) > a > span:nth-child(2)').allTextContents(),wanted);
    assert.deepEqual(await page.locator('[data-mmed-rail-group]').allTextContents(),['FULL SEASON','APPLICATION PERIOD','INTERVIEW SEASON']);
    assert.deepEqual(await page.locator('.sos-nav-list .mmed-rail-status').allTextContents(),statuses);
    assert.equal(await page.locator('[data-original="11"] .mmed-rail-status').textContent(),'✓ Ready');
    assert.equal(await page.getByText('LOR Builder',{exact:true}).count(),0);
    for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(()=>[...document.querySelectorAll('a[data-mmed-maturity]')].every(a=>{
        const r=a.getBoundingClientRect(),b=a.querySelector('.mmed-rail-status').getBoundingClientRect();
        const l=a.querySelector('.sos-nav-lock-icon');const k=l&&l.getBoundingClientRect();
        return a.scrollWidth<=a.clientWidth && b.left>=r.left && b.right<=r.right && (!k || b.right<=k.left);
      })),true);
    }
    const preserved = await page.evaluate(() => originals.every((a,i) => {
      const old = document.createElement('div');old.innerHTML=before[i];const b=old.firstChild;
      return a===document.querySelector('[data-original="'+i+'"]') && ['href','data-locked','aria-disabled','data-route','class'].every(k=>a.getAttribute(k)===b.getAttribute(k)) && a.querySelectorAll('svg').length===b.querySelectorAll('svg').length;
    }));
    assert.equal(preserved,true);
    assert.equal(await page.locator('[data-original="2"]').isEnabled(),!locked);
    assert.equal(await page.locator('[data-original="2"] .mmed-rail-status').count(),0);
    await page.locator('[data-original="2"]').click({timeout:2000,force:true});
    assert.equal(await page.evaluate(()=>clicks),1);
    assert.equal(await page.locator('[data-original="0"]').isEnabled(),!locked);
    await page.locator('[data-original="0"]').click({timeout:2000,force:true});
    assert.equal(await page.evaluate(()=>clicks),2);
    assert.equal(await page.getByText('IV Ready Gear',{exact:true}).locator('..').getAttribute('href'),'https://missionmedinstitute.com/interview-ready/#home');
    // Owner rerenders and late eligibility-controlled injections remain safe.
    await page.evaluate(()=>{document.querySelector('.sos-nav-list').appendChild(document.createElement('li'));});
    await page.waitForTimeout(50);
    assert.deepEqual(await page.locator('li:not([hidden]) > a > span:nth-child(2)').allTextContents(),wanted);
  }
  await page.setContent(fixture('matrix2',false).replace('>Timeline</span>','>Timeline Builder</span>'));
  assert.equal(await page.getByText('Timeline Builder',{exact:true}).count(),1);
  await page.setContent(fixture('matrix2',false,['InterviewIQ','LOR Studio','Timeline']));
  assert.equal(await page.getByText('Timeline Builder',{exact:true}).count(),0);
  assert.equal(await page.getByText('Interview IQ',{exact:true}).count(),0);
  assert.equal(await page.getByText('LOR Studio',{exact:true}).count(),0);
  await page.evaluate(()=>{const li=document.createElement('li');li.innerHTML='<a class="sos-nav-link" href="/interviewiq/"><span class="sos-nav-icon">IQ</span><span>InterviewIQ</span></a>';document.querySelector('.sos-nav-list').appendChild(li);});
  await page.waitForTimeout(50);
  assert.equal(await page.getByText('Interview IQ',{exact:true}).count(),1);
  await page.setContent(fixture('classic',true));
  assert.equal(await page.evaluate(()=>originals.every((a,i)=>a.outerHTML===before[i])),true);
  assert.equal(await page.locator('[data-mmed-rail-group]').count(),0);
  assert.equal(await page.locator('.mmed-rail-status').count(),0);
  await browser.close();
  console.log('PASS: exact Founder maturity map/Calendar, no LOR Builder, desktop/390x844 badge and lock coexistence, exact groups/order, locked/unlocked node identity/attributes/icons/handlers, omitted eligibility, late owner injection, idempotence, exact Gear URL, Classic unchanged');
})().catch(e=>{console.error(e);process.exit(1);});
