const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium, webkit } = require('playwright');

const here = __dirname;
const evidence = path.resolve(here, '../../../../../_AI_HANDOFFS/from_codex/MX-DASH-6040A_EVIDENCE/local-filmstrip');
fs.mkdirSync(evidence, { recursive: true });

const frames = [0, 100, 250, 500, 1000, 2000, 3000];
const forbidden = ['CURRENT MATCH SEASON PRIORITY', 'Arena promo', 'Student Dashboard'];

function render(experience) {
  return execFileSync('php', [path.join(here, 'template-first-paint.test.php'), `--render=${experience}`, '--html'], { encoding: 'utf8' });
}

function documentFor(experience) {
  const fragment = render(experience);
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#08111d;color:white}#student-os-root{min-height:100vh}#sos-main{min-height:100vh;position:relative}.classic{padding:48px;font:700 34px Arial}.v2{padding:48px;font:800 48px Arial;color:#f7f3ea}</style></head><body>${fragment}<script>
  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('student-os-root');
    var content = document.getElementById('sos-content');
    content.innerHTML = '<section class="classic"><h1>Student Dashboard</h1><p>CURRENT MATCH SEASON PRIORITY</p><p>Arena promo</p></section>';
    if (${JSON.stringify(experience)} === 'matrix2') {
      window.setTimeout(function () {
        root.classList.add('mmdv2-active');
        content.innerHTML = '<section class="v2"><p>MISSIONMED MATRIX 2.0</p><h1>Where can I take you today?</h1><p>Featured Apps</p></section>';
      }, 2200);
    }
  });
  </script></body></html>`;
}

async function runEngine(name, engine) {
  const launchOptions = name === 'chromium'
    ? { headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }
    : { headless: true };
  const browser = await engine.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const started = Date.now();
  await page.setContent(documentFor('matrix2'), { waitUntil: 'domcontentloaded' });
  const filmStarted = Date.now();
  for (const at of frames) {
    const delay = Math.max(0, at - (Date.now() - filmStarted));
    if (delay) await page.waitForTimeout(delay);
    const visibleText = await page.locator('body').innerText();
    const classicVisible = await page.locator('.classic').isVisible().catch(() => false);
    if (classicVisible || forbidden.some((text) => visibleText.includes(text))) {
      throw new Error(`${name} exposed Classic content at ${at}ms`);
    }
    await page.screenshot({ path: path.join(evidence, `${name}-matrix2-${String(at).padStart(4, '0')}ms.png`), fullPage: true });
  }
  await page.waitForSelector('.v2', { state: 'visible', timeout: 2000 });
  await page.screenshot({ path: path.join(evidence, `${name}-matrix2-ready.png`), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.setContent(documentFor('matrix2'), { waitUntil: 'domcontentloaded' });
  await mobile.screenshot({ path: path.join(evidence, `${name}-matrix2-mobile-390x844-first-paint.png`), fullPage: true });
  if (await mobile.locator('.classic').isVisible().catch(() => false)) {
    throw new Error(`${name} exposed Classic content at 390x844`);
  }
  await mobile.close();

  const directRoute = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await directRoute.goto('about:blank#calendar');
  await directRoute.setContent(documentFor('matrix2'), { waitUntil: 'domcontentloaded' });
  if (await directRoute.locator('#student-os-root').getAttribute('data-dashboard-first-paint')) {
    throw new Error(`${name} retained the dashboard guard on a direct Matrix route`);
  }
  await directRoute.close();

  const classic = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await classic.setContent(documentFor('classic'), { waitUntil: 'domcontentloaded' });
  if (!(await classic.getByText('CURRENT MATCH SEASON PRIORITY').isVisible())) {
    throw new Error(`${name} did not paint explicit Classic immediately`);
  }
  await classic.screenshot({ path: path.join(evidence, `${name}-classic-first-paint.png`), fullPage: true });
  await classic.close();
  await browser.close();
  return { engine: name, frames: frames.length + 1, elapsedMs: Date.now() - started, zeroClassicFrames: true, classicImmediate: true, mobile390x844: true, directMatrixRoute: true };
}

(async () => {
  const results = [];
  results.push(await runEngine('chromium', chromium));
  results.push(await runEngine('webkit', webkit));
  fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + '\n');
  console.log(JSON.stringify(results));
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
