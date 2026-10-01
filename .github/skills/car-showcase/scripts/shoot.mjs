// Screenshots of the showcase at chosen scroll points, desktop or phone, with any console errors listed.
// Needs Playwright (npm i -D playwright, then npx playwright install chromium) and the page being served.
//
// usage:
//   node shoot.mjs                         # desktop 1440×900, every section at a few points
//   node shoot.mjs --phone                 # 390×844 touch phone
//   node shoot.mjs --size 844x390 --phone  # landscape phone
//   node shoot.mjs --url http://localhost:5178/ --out shots --at hero:0,specs:0.5
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const phone = process.argv.includes('--phone');
const [W, H] = arg('--size', phone ? '390x844' : '1440x900').split('x').map(Number);
const url = arg('--url', 'http://localhost:5178/');
const out = arg('--out', 'shots');
const stops = arg('--at', 'hero:0,hero:0.6,hemi:0.45,specs:0.5,studio:0.5,sound:0.5,finale:0.3,finale:0.8,book:0')
  .split(',')
  .map((s) => { const [id, p] = s.split(':'); return [id, Number(p)]; });

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(url);
await page.waitForSelector('#loader.done', { state: 'attached', timeout: 60000 });
await page.waitForTimeout(1200);
for (const [id, p] of stops) {
  await page.evaluate(([id, p]) => {
    const s = document.getElementById(id);
    scrollTo(0, s.offsetTop + Math.max(0, s.offsetHeight - innerHeight) * p);
  }, [id, p]);
  await page.waitForTimeout(2300); // let the camera settle
  const file = `${out}/${phone ? 'phone' : 'desktop'}-${W}x${H}-${id}-${p}.png`;
  await page.screenshot({ path: file });
  console.log(file);
}
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
