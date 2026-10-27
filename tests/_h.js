/* shared puppeteer helpers for the Phase-E2 suites (grab / taunts / eggs / dog) */
const p = require('puppeteer-core'); const sl = ms => new Promise(r => setTimeout(r, ms));
const ARGS = ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader'];
async function open(url, qs, block) {
  const b = await p.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ARGS });
  const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  if (block) { await pg.setRequestInterception(true); pg.on('request', r => block.test(r.url()) ? r.respond({ status: 404, body: 'x' }) : r.continue()); }
  await pg.goto(url + '?fast=1&novideo=1' + (qs || ''), { waitUntil: 'load' }); await sl(2500);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('art_login_seen_v1', '1'); localStorage.setItem('terrorific_intro_seen_v1', '1'); });
  await pg.tap('#authBtn'); await sl(1500);
  return { b, pg, errs };
}
/* start night n quiet (no scares/attacks); door shut when door=true */
async function arm(pg, n, door) {
  await pg.evaluate(async (n, door) => { const S = ART.S; ART.nights.start(n); await new Promise(r => setTimeout(r, 400)); S.peeks = []; S.nightCfg.aggro = 0; S.attackT = 999; ART.art.reset(); ART.ui.closeMonitor(true);
    S.door = !!door; document.getElementById('btnDoor').classList.toggle('on', !!door); S.t = 30; }, n, door);
}
module.exports = { open, arm, sl };
