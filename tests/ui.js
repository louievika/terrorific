/* Phase B self-tests: modules, manifest-driven values, no-helpers, diegetic controls, drag direction, puzzles. */
const { sl, args, launch, reporter } = require('./lib');
const { URL, shotDir } = args();
const fs = require('fs'); fs.mkdirSync(shotDir, { recursive: true });
process.on('unhandledRejection', e => { console.log((global.__R||[]).join('\n')); console.log('CRASH', e.message); process.exit(2); });
(async () => {
  const { T, R, fails } = reporter(); global.__R = R;
  /* ---------- A. manifest-driven: patch the manifest in flight and see the game change ---------- */
  {
    const { b, pg, errs } = await launch({ manifest: j => { j.game.puzzles.hotspots.fusebox.yawDeg = -40; j.game.puzzles.hotspots.fusebox.amountPct = 33; j.game.nights[0].len = 11; j.game.puzzles.hotspots.fusebox.types = ['tiles', 'tiles', 'tiles', 'tiles', 'tiles']; } });
    await pg.goto(URL, { waitUntil: 'load' }); await sl(3000);
    const m = await pg.evaluate(() => ({ mods: ['config', 'rooms', 'art', 'audio', 'ui', 'nights', 'puzzles'].map(k => !!window.ART[k]), yaw: ART.CFG.puzzles.hotspots.fusebox.yawDeg, amt: ART.CFG.puzzles.hotspots.fusebox.amountPct, nights: ART.CFG.clock && ART.CFG.clock.nightSeconds }));
    T('all 7 modules loaded on window.ART', m.mods.every(Boolean), JSON.stringify(m.mods));
    T('manifest value reaches CFG (hotspot yaw / amount)', m.yaw === -40 && m.amt === 33, JSON.stringify(m));
    await pg.tap('#authBtn'); await sl(1500);
    const n = await pg.evaluate(() => ({ len: __game.S.len, type: ART.puzzles.typeFor('fusebox', 1) }));
    T('manifest night length + puzzle type drive gameplay', n.type === 'tiles' && n.len === 11, JSON.stringify(n));
    T('no console errors (manifest run)', errs.length === 0, errs.join(' | '));
    await b.close();
  }
  /* ---------- B. default manifest ---------- */
  const { b, pg, errs } = await launch();
  await pg.goto(URL, { waitUntil: 'load' }); await sl(3000);
  const ev = (f, a) => pg.evaluate(f, a);
  await pg.screenshot({ path: shotDir + '/b-login.png' });
  await pg.tap('#authBtn'); await sl(1800);
  T('night 1 starts from the tap', await ev(() => __game.S.phase === 'play' && __game.S.night === 1));
  // no helpers anywhere
  const dom = await ev(() => ({
    ids: ['helpBtn', 'help', 'helpMenu', 'tips', 'tip', 'voiceBtn', 'muteBtn', 'quitBtn', 'subtitle', 'controls', 'hint'].filter(i => document.getElementById(i)),
    txt: /\b(help|hint|tip|tutorial|tap here|swipe)\b/i.test(document.getElementById('game').innerText),
    cfg: JSON.stringify(ART.CFG).match(/help|hint|tip(?!s?[a-z])|tutorial/gi) || []
  }));
  T('no help / hint / mute / quit / subtitle elements in the DOM', dom.ids.length === 0, dom.ids.join(','));
  T('no instructional text on the game screen', !dom.txt);
  T('no help/hint/tip/tutorial keys in CFG', dom.cfg.length === 0, dom.cfg.join(','));
  const src = await ev(async () => (await Promise.all(['js/ui.js', 'js/nights.js', 'js/config.js', 'game.html', 'assets/manifest.json'].map(u => fetch(u).then(r => r.text())))).join('\n'));
  T('no help/tips/idle-tip strings in shipped code or manifest', !/helpBtn|idleTip|idle tip|helpMenu|tutorial/i.test(src));
  // auto-pan on first run only
  await pg.evaluate(() => localStorage.removeItem('art_login_seen_v1'));
  await ev(() => { __game.startNight(1); });
  await sl(5300);
  await pg.screenshot({ path: shotDir + '/b-autopan-mid.png' });
  const ap = await ev(() => ({ on: !!(ART.V.auto && ART.V.auto.on), yaw: ART.V.autoYaw, view: ART.V.yaw }));
  T('first-run auto-pan hint plays (scene sways by itself)', ap.on && Math.abs(ap.yaw) > 0.05, JSON.stringify(ap));
  await sl(3100); await pg.screenshot({ path: shotDir + '/b-autopan-right.png' }); await sl(2600);
  const seen = await ev(() => localStorage.getItem('art_login_seen_v1'));
  T('auto-pan marks itself seen (never repeats)', seen === '1', String(seen));
  await ev(() => { ART.V.autoYaw = 0; ART.V.auto = null; __game.startNight(1); });
  await sl(800);
  await pg.screenshot({ path: shotDir + '/b-night1-office.png' });
  // door button: big, visible in the default view
  const door = await ev(() => { const r = document.getElementById('btnDoor').getBoundingClientRect(); return { w: r.width, h: r.height, l: r.left, r: r.right, vis: getComputedStyle(document.getElementById('btnDoor')).visibility }; });
  T('door button on screen and >= 44px', door.vis !== 'hidden' && door.l >= 0 && door.r <= 390 && door.w >= 44 && door.h >= 44, JSON.stringify(door));
  await pg.tap('#btnDoor'); await sl(300);
  T('tapping the door button locks the door', await ev(() => __game.S.door === true));
  await pg.screenshot({ path: shotDir + '/b-door-locked.png' });
  await pg.tap('#btnDoor'); await sl(300);
  T('tapping again opens it', await ev(() => __game.S.door === false));
  // monitor handle
  const lip = await ev(() => { const r = document.getElementById('btnCam').getBoundingClientRect(); return { h: r.height, w: r.width, b: r.bottom }; });
  T('monitor edge handle is big (>=44px tall, wide)', lip.h >= 44 && lip.w >= 120, JSON.stringify(lip));
  await pg.tap('#btnCam'); await sl(700);
  T('tap on edge handle flips the monitor up', await ev(() => __game.S.cam === true && document.getElementById('monitor').classList.contains('open')));
  await ev(() => { __game.setFeed('kitchen'); }); await sl(500);
  await pg.screenshot({ path: shotDir + '/b-monitor-open.png' });
  await pg.tap('#btnCam'); await sl(600);
  T('tapping the handle again flips it down', await ev(() => __game.S.cam === false));
  await pg.touchscreen.touchStart(195, 835); await pg.touchscreen.touchMove(195, 700); await pg.touchscreen.touchMove(195, 560); await pg.touchscreen.touchEnd(); await sl(700);
  T('swipe up from the bottom edge opens the monitor', await ev(() => __game.S.cam === true));
  await ev(() => __game.closeMonitor()); await sl(500);
  // drag direction: finger right -> view turns left (content follows the finger)
  await ev(() => { ART.V.dragYaw = 0; ART.V.dragPitch = 0; });
  await pg.touchscreen.touchStart(120, 400); await pg.touchscreen.touchMove(180, 400); await pg.touchscreen.touchMove(260, 400); await pg.touchscreen.touchEnd(); await sl(400);
  const dy = await ev(() => ART.V.yaw);
  T('drag finger right -> view turns left (natural drag)', dy > 0.1, dy.toFixed(3));
  await ev(() => { ART.V.dragYaw = 0; });
  // side-wall panels appear when you turn to them
  await ev(() => { __game.startNight(2); }); await sl(300);
  for (const id of ['fusebox', 'doorbolt']) {
    const sp = await ev(id => { const h = ART.CFG.puzzles.hotspots[id]; ART.V.dragYaw = h.yawDeg * Math.PI / 180; return h.yawDeg; }, id); await sl(500);
    const r = await ev(id => { const e = document.querySelector('.spot-btn.' + id); const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width, vis: getComputedStyle(e).visibility }; }, id);
    T(id + ' panel visible when turned to it, big enough', r.vis !== 'hidden' && r.l >= 0 && r.r <= 390 && r.w >= 44, JSON.stringify(r));
  }
  await ev(() => { ART.V.dragYaw = 0; });

  /* ---------- C. puzzles: each type solved through the real DOM, each gameplay effect ---------- */
  async function solve(type) {
    return await ev(async type => {
      const ctl = __game.S.puzzle.ctl, sol = ctl.solution(), q = s => [...document.querySelectorAll(s)], w = ms => new Promise(r => setTimeout(r, ms));
      if (type === 'keypad') { for (const ch of sol) { document.querySelector('.pz-key[data-k="' + ch + '"]').click(); await w(20); } }
      else if (type === 'wires') { for (const [li, ri] of sol) { q('.pz-wire.l')[li].click(); await w(20); q('.pz-wire.r')[ri].click(); await w(20); } }
      else { for (const i of sol) { q('.pz-tile')[i].click(); await w(20); } }
      return JSON.stringify(sol);
    }, type);
  }
  async function turnTo(id) { await ev(id => { ART.V.dragYaw = ART.CFG.puzzles.hotspots[id].yawDeg * Math.PI / 180; }, id); await sl(450); }
  async function freshNight(n) { await ev(n => { __game.startNight(n); __game.S.nightCfg.aggro = 0; __game.S.artRoom = 'basement'; __game.S.attackT = -1; __game.S.session = 0; for (const k in __game.S.cool) __game.S.cool[k] = 0; ART.V.dragYaw = 0; }, n); await sl(400); }
  for (const type of ['keypad', 'wires', 'tiles']) {
    await freshNight(1);
    await ev(type => { const h = __game.CFG.puzzles.hotspots.fusebox; h.types = [type, type, type, type, type]; ART.puzzles.refresh(); __game.S.power = 50; }, type);
    await turnTo('fusebox'); await pg.tap('.spot-btn.fusebox'); await sl(400);
    const open = await ev(() => !!__game.S.puzzle && document.getElementById('puzzle').classList.contains('open'));
    T('fuse box tap opens the ' + type + ' puzzle', open);
    if (type === 'keypad') await sl(100);
    await pg.screenshot({ path: shotDir + '/b-puzzle-' + type + '.png' });
    // wrong input first where meaningful: puzzle must not auto-solve
    const sol = await solve(type); await sl(900);
    const after = await ev(() => ({ p: __game.S.power, open: !!__game.S.puzzle, cool: __game.S.cool.fusebox }));
    T(type + ' puzzle is solvable via the DOM -> power +' + 25 + '%, panel closes, cooldown set', after.p >= 74 && !after.open && after.cool > 0, JSON.stringify(after) + ' sol=' + sol);
  }
  // cooldown: panel will not reopen right after
  await turnTo('fusebox'); await ev(() => ART.puzzles.open('fusebox')); await sl(200);
  T('fuse box refuses while on cooldown', await ev(() => !__game.S.puzzle));
  // wrong code does not solve
  await freshNight(1);
  await ev(() => { __game.CFG.puzzles.hotspots.fusebox.types = ['keypad', 'keypad', 'keypad', 'keypad', 'keypad']; ART.puzzles.refresh(); __game.S.power = 50; ART.puzzles.open('fusebox'); });
  await sl(200);
  const wrong = await ev(async () => { const code = __game.S.puzzle.ctl.solution(), bad = code.split('').map(c => String((+c + 1) % 10)); for (const c of bad) document.querySelector('.pz-key[data-k="' + c + '"]').click(); await new Promise(r => setTimeout(r, 900)); return { open: !!__game.S.puzzle, p: __game.S.power }; });
  T('wrong keypad code does not solve or grant power', wrong.open && wrong.p < 51, JSON.stringify(wrong));
  await pg.tap('#puzzleClose'); await sl(300);
  T('puzzle close (x) works, no penalty', await ev(() => !__game.S.puzzle));
  // dead power -> fuse box rescue
  await freshNight(2);
  await ev(() => { const g = __game; g.CFG.puzzles.hotspots.fusebox.types = ['tiles', 'tiles', 'tiles', 'tiles', 'tiles']; ART.puzzles.refresh(); g.S.power = 0.1; g.S.lo10 = true; g.tick(1); });
  T('power reaches 0 -> house dead', await ev(() => __game.S.powerDead)); await sl(1500);
  await ev(() => { __game.S.deadT = 12; });
  await turnTo('fusebox'); await pg.screenshot({ path: shotDir + '/b-dead-fusebox.png' });
  await pg.tap('.spot-btn.fusebox'); await sl(400);
  T('dead house: fuse box still opens (tap in the dark)', await ev(() => !!__game.S.puzzle));
  await solve('tiles'); await sl(1200);
  const rescue = await ev(() => ({ dead: __game.S.powerDead, p: __game.S.power, ph: __game.S.phase }));
  T('fuse box puzzle restores the dead house (power back, no attack)', !rescue.dead && rescue.p >= 14 && rescue.ph === 'play', JSON.stringify(rescue));
  // door bolt holds an attack, does not drain like the door
  await freshNight(2);
  await ev(() => { __game.CFG.puzzles.hotspots.doorbolt.types = ['wires', 'wires', 'wires', 'wires', 'wires']; ART.puzzles.refresh(); });
  await turnTo('doorbolt'); await pg.tap('.spot-btn.doorbolt'); await sl(400); await solve('wires'); await sl(1000);
  T('door-bolt puzzle arms the bolt', await ev(() => __game.S.bolt === true));
  await ev(() => { ART.V.dragYaw = 0; const g = __game; g.S.door = false; g.S.artRoom = 'hallway'; g.S.attackT = 0.5; });
  await ev(() => { for (let i = 0; i < 8; i++) __game.tick(0.2); }); await sl(300);
  const held = await ev(() => ({ ph: __game.S.phase, room: __game.S.artRoom, bolt: __game.S.bolt }));
  T('bolted door holds an attack with the door button open', held.ph === 'play' && held.room !== 'hallway' && !held.bolt, JSON.stringify(held));
  // puzzles cannot open during the monitor / scare
  await freshNight(1); await ev(() => { __game.openMonitor(); }); await sl(300);
  T('hotspots inert while the monitor is up', await ev(() => ART.puzzles.open('fusebox') === false));
  await ev(() => __game.closeMonitor());
  // registry is swappable
  T('puzzle registry swappable: register() adds a type', await ev(() => { ART.puzzles.register('t', () => ({ destroy() {}, solution() {} })); const ok = ART.puzzles.types().includes('t') && ART.puzzles.types().length >= 4; return ok; }));
  T('no console errors (default run)', errs.length === 0, errs.join(' | '));
  console.log(R.join('\n')); console.log('UI/PUZZLE TESTS: ' + (R.length - fails()) + '/' + R.length + ' pass');
  await b.close(); process.exit(fails() ? 1 : 0);
})();
