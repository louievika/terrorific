/* node tests/run-all.js [url] [screenshotDir]  - runs every headless suite, prints PASS/FAIL, exit code 1 on any failure.
   Needs puppeteer-core + a Chrome (CHROME=/path/to/chrome). Serve the repo first: python3 -m http.server 8077 */
const { spawnSync } = require('child_process');
const url = process.argv[2] || 'http://localhost:8077/game.html', shots = process.argv[3] || '/tmp/art-shots';
let bad = 0;
for (const f of ['logic.js', 'ui.js', 'audio.js', 'voice.js', 'camlock.js', 'hardpuz.js', 'video.js', 'feedscare.js']) {
  console.log('\n=== tests/' + f + ' ===');
  const r = spawnSync('node', [__dirname + '/' + f, url, shots], { stdio: 'inherit' }); if (r.status) bad++;
}
console.log(bad ? '\nRESULT: FAIL (' + bad + ' suite(s))' : '\nRESULT: ALL PASS');
process.exit(bad ? 1 : 0);
