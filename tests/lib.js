/* shared headless-Chrome helpers for the self-tests (needs puppeteer-core: npm i puppeteer-core) */
const p = require('puppeteer-core');
const sl = ms => new Promise(r => setTimeout(r, ms));
exports.sl = sl;
exports.args = () => ({ URL: process.argv[2] || 'http://localhost:8077/game.html', shotDir: process.argv[3] || '/tmp/art-shots' });
exports.launch = async function (opts) {
  opts = opts || {};
  const b = await p.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage();
  await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  pg.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
  pg.on('pageerror', e => errs.push('pageerror ' + e.message));
  pg.on('response', r => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()); });
  if (opts.seen !== false) await pg.evaluateOnNewDocument(() => { try { localStorage.setItem('art_login_seen_v1', '1'); } catch (e) {} });
  if (opts.manifest) {   // intercept the manifest and let the test patch it
    await pg.setRequestInterception(true);
    pg.on('request', async rq => {
      if (!/assets\/manifest\.json/.test(rq.url())) return rq.continue();
      try { const r = await fetch(rq.url()); const j = await r.json(); opts.manifest(j); rq.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(j) }); } catch (e) { rq.continue(); }
    });
  }
  return { b, pg, errs };
};
exports.reporter = function () {
  const R = []; let fails = 0;
  return { T(n, ok, x) { if (!ok) fails++; R.push((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' [' + x + ']' : '')); }, R, fails: () => fails };
};
