const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const source = fs.readFileSync(path.resolve(__dirname, '../../../../mu-plugins/missionmed-matrix-match-tools-rail.php'), 'utf8');
const script = source.match(/<script id="mmed-match-tools-rail-6050a">([\s\S]*?)<\/script>/)[1];
const style = source.match(/<style id="mmed-match-tools-rail-status-6050a">([\s\S]*?)<\/style>/)[1];
const names = ['StoryForge', 'RISE', 'Timeline', 'HomeBase', 'Arena', 'File Vault', 'PSForge', 'RankList IQ', 'LOR Studio', 'IV Prep On-Call', 'InterviewIQ'];
const wanted = ['HomeBase', 'RISE', 'StoryForge', 'File Vault', 'PS Forge', 'LOR Studio', 'Interview IQ', 'IV Prep On-Call', 'RankList IQ', 'Timeline', 'IV Ready Gear', 'Arena'];
const statuses = ['🚧 In Development','✓ Ready','✓ Ready','✓ Ready','🚧 In Development','◇ Preview','◇ Preview','◇ Preview','◇ Preview','✓ Ready'];
function fixture(experience, locked, omit = []) {
  const links = names.filter(n => !omit.includes(n)).map((name, i) => `<li><a class="sos-nav-link" data-original="${i}" href="${locked ? 'javascript:void(0)' : '#app-' + i}" ${locked ? 'data-locked="true" aria-disabled="true" data-route="app-' + i + '"' : ''}><span class="sos-nav-icon">XX</span><span>${name}</span>${locked ? '<svg class="sos-nav-lock-icon"></svg>' : ''}</a></li>`).join('');
  return `<style>body{margin:0;background:#081725;font-family:Arial;color:white}#sos-sidebar{width:283px}.sos-nav-list{list-style:none;padding:0;margin:0}.sos-nav-label{font-size:9px;color:#657080}.sos-nav-link{box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:10px 16px;color:white;text-decoration:none;font-size:13px}.sos-nav-icon{width:24px}.sos-nav-lock-icon{width:14px;height:14px}@media(max-width:480px){#sos-sidebar{width:100%}}</style><style>${style}</style><div id="student-os-root"><aside id="sos-sidebar"><div class="sos-nav-section"><div class="sos-nav-label">MATCH TOOLS</div><ul class="sos-nav-list">${links}</ul></div><div><a class="sos-nav-link" data-original="${names.length}" href="#calendar"><span class="sos-nav-icon">CA</span><span>Calendar</span></a></div></aside></div><script>window.mmedDashboardV2={experience:${JSON.stringify(experience)}};window.originals=Array.from(document.querySelectorAll('a'));window.before=originals.map(a=>a.outerHTML);window.clicks=0;originals.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();window.clicks++}));</script><script>${script}</script>`;
}
(async () => {
  // PHP must emit nothing for anonymous visitors or any other application route.
  const phpPath=path.resolve(__dirname,'../../../../mu-plugins/missionmed-matrix-match-tools-rail.php');
  for(const [signedIn,url] of [[false,'/member-dashboard/'],[true,'/arena/'],[true,'/interviewiq/']]) {
    const php=`define('ABSPATH','/');function add_action(){} function is_user_logged_in(){return ${signedIn?'true':'false'};}function wp_parse_url($u,$c){return parse_url($u,$c);}$_SERVER['REQUEST_URI']=${JSON.stringify(url)};include ${JSON.stringify(phpPath)};`;
    assert.equal(execFileSync('php',['-r',php+'mmed_match_tools_rail_6050a();'],{encoding:'utf8'}),'');
  }
  const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const page = await browser.newPage({viewport:{width:390,height:844}});
  for (const locked of [false,true]) {
    console.log('fixture',locked ? 'locked' : 'unlocked');
    await page.setContent(fixture('matrix2',locked));
    assert.deepEqual(await page.locator('li:not([hidden]) > a > span:nth-child(2)').allTextContents(),wanted);
    assert.equal(await page.locator('[data-mmed-timeline-label="short"]').count(),1);
    assert.equal(await page.locator('[data-mmed-timeline-label="short"]').evaluate(el=>getComputedStyle(el,'::after').content), '" Builder"');
    assert.deepEqual(await page.locator('[data-mmed-rail-group]').allTextContents(),['FULL SEASON','APPLICATION PERIOD','INTERVIEW SEASON','PRACTICE']);
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
    await page.evaluate(()=>{const dashboard=document.createElement('div');dashboard.className='mmdv2-in';document.getElementById('student-os-root').appendChild(dashboard);});
    await page.waitForTimeout(50);
    assert.equal(await page.locator('.mmed-arena-entry').count(),1);
    assert.equal(await page.locator('.mmed-arena-entry').getAttribute('href'),await page.locator('[data-original="4"]').getAttribute('href'));
    assert.equal(await page.locator('.mmed-arena-entry').getAttribute('data-locked'),locked?'true':null);
    await page.locator('.mmed-arena-entry').click({force:true});
    assert.equal(await page.evaluate(()=>clicks),1);
    await page.evaluate(()=>{clicks=0;});
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
  // Real production owner + rail, both execution orders. A competing text rewrite
  // starves timers and hangs navigation; this page must settle and stay responsive.
  const ownerScript=fs.readFileSync(path.join(__dirname,'timeline-launch-owner.fixture.js'),'utf8');
  for (const ownerFirst of [true,false]) {
    const ownerTag='<script>window.MissionMedTimelineLaunch={target:"https://missionmedinstitute.com/timeline/"};'+ownerScript+'</script>';
    const railTag='<script>'+script+'</script>';
    const html=fixture('matrix2',false)
      .replace('data-original="2"', 'data-original="2" data-missionmed-product="timeline" data-app-id="timeline" aria-label="Timeline Builder"')
      .replace(railTag,ownerFirst?ownerTag+railTag:railTag+ownerTag);
    await page.setContent(html,{timeout:3000});
    await page.waitForTimeout(100);
    const timeline=page.locator('[data-missionmed-product="timeline"]');
    assert.equal(await timeline.count(),1);
    assert.equal(await timeline.isVisible(),true);
    assert.equal(await timeline.getAttribute('href'),'https://missionmedinstitute.com/timeline/');
    assert.equal(await timeline.getAttribute('aria-label'),'Timeline Builder');
    assert.equal(await timeline.locator('span').last().textContent(),'Timeline');
    assert.equal(await timeline.locator('[data-mmed-timeline-label="short"]').count(),1);
    assert.deepEqual(await page.locator('li:not([hidden]) > a > span:nth-child(2)').allTextContents(),wanted);
    await page.evaluate(()=>{const li=document.createElement('li');document.querySelector('.sos-nav-list').appendChild(li);});
    await page.waitForTimeout(100);
    assert.equal(await timeline.isVisible(),true);
    assert.equal(await timeline.locator('span').last().textContent(),'Timeline');
    assert.equal(await page.evaluate(()=>new Promise(resolve=>setTimeout(()=>resolve(true),20))),true);
  }
  // GX showcase: original owner remains the only route/access decision maker.
  const arenaFixture=(locked,omit=[])=>fixture('matrix2',locked,omit).replace('</aside></div>','</aside><main class="mmdv2-in"></main></div>');
  for(const locked of [false,true]) {
    await page.setContent(arenaFixture(locked));
    await page.evaluate(()=>{window.replacementClicks=0;});
    const entry=page.locator('.mmed-arena-entry');
    assert.equal(await entry.count(),1);
    assert.equal(await entry.locator('strong').textContent(),'MissionMed Arena');
    assert.equal(await entry.locator('.mmed-arena-lock').isVisible(),locked);
    assert.equal(await entry.locator('img').getAttribute('loading'),'lazy');
    assert.match(await entry.locator('img').getAttribute('src'),/blue\._assets-600x335\.png$/);
    assert.match(await entry.locator('source').getAttribute('srcset'),/blue\._assets-300x167\.png$/);
    await entry.press('Enter');
    assert.equal(await page.evaluate(()=>clicks),1);
    // Replacement must get the next click; stale owner's listener must not run.
    await page.evaluate(()=>{const old=document.querySelector('[data-original="4"]');const next=old.cloneNode(true);next.addEventListener('click',e=>{e.preventDefault();window.replacementClicks=(window.replacementClicks||0)+1;});old.replaceWith(next);});
    await page.waitForTimeout(50);
    await entry.click({force:true});
    assert.equal(await page.evaluate(()=>replacementClicks),1);
    assert.equal(await page.evaluate(()=>clicks),1);
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({reducedMotion:'reduce'});
      await entry.scrollIntoViewIfNeeded();
      assert.equal(await entry.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
      assert.equal(await entry.locator('.mmed-arena-cta').isVisible(),true);
      assert.equal(await entry.evaluate(el=>getComputedStyle(el).animationName),'none');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      if(process.env.GX_EVIDENCE_DIR) {
        fs.mkdirSync(process.env.GX_EVIDENCE_DIR,{recursive:true});
        await entry.screenshot({path:path.join(process.env.GX_EVIDENCE_DIR,`arena-${locked?'locked':'unlocked'}-${viewport.width}.png`)});
      }
    }
    // Failed imagery never removes the usable owner-controlled CTA.
    await entry.locator('img').dispatchEvent('error');
    assert.equal(await entry.getAttribute('data-image-failed'),'true');
    assert.equal(await entry.locator('picture').isVisible(),false);
    assert.equal(await entry.locator('.mmed-arena-cta').isVisible(),true);
    await page.evaluate(()=>document.querySelector('[data-original="4"]').remove());
    await page.waitForTimeout(50);
    assert.equal(await entry.count(),0);
  }
  await page.setContent(arenaFixture(false,['Arena']));
  assert.equal(await page.locator('.mmed-arena-entry').count(),0);
  await page.evaluate(()=>{const li=document.createElement('li');li.innerHTML='<a class="sos-nav-link" href="#arena"><span>Arena</span></a>';document.querySelector('.sos-nav-list').appendChild(li);});
  await page.waitForTimeout(50);
  assert.equal(await page.locator('.mmed-arena-entry').count(),1);
  assert.equal(await page.locator('.mmed-arena-entry').getAttribute('href'),'#arena');
  if(process.env.GX_EVIDENCE_DIR) {
    const preview=arenaFixture(false).replace('<style>body','<style>.mmdv2-in{max-width:1080px;margin:24px auto}#sos-sidebar{display:none}body');
    fs.writeFileSync(path.join(process.env.GX_EVIDENCE_DIR,'arena-preview.html'),preview);
  }
  await browser.close();
  console.log('PASS: GX PHP route/auth isolation, artwork contract, keyboard, locked/unlocked/current-owner delegation, owner removal/reinjection, image failure, reduced motion, desktop and exact390x844 no overflow');
  console.log('PASS: exact Founder maturity map/Calendar, no LOR Builder, desktop/390x844 badge and lock coexistence, exact groups/order, locked/unlocked node identity/attributes/icons/handlers, omitted eligibility, late owner injection, idempotence, exact Gear URL, Classic unchanged');
})().catch(e=>{console.error(e);process.exit(1);});
