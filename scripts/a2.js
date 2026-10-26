const p=require('puppeteer-core');
const sl=ms=>new Promise(r=>setTimeout(r,ms));
const URL=process.argv[2]||'http://localhost:8077/game.html';
const shotDir=process.argv[3]||'screenshots';
(async()=>{
 const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-gl=swiftshader','--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const pg=await b.newPage(); await pg.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const errs=[]; pg.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.type()+': '+m.text())}); pg.on('pageerror',e=>errs.push('pageerror '+e.message));
 pg.on('response',r=>{if(r.status()>=400)errs.push('HTTP '+r.status()+' '+r.url())});
 await pg.goto(URL,{waitUntil:'load'}); await sl(3500);
 await pg.evaluate(()=>localStorage.clear());
 await pg.tap('#authBtn'); await sl(1500);
 const R=[]; const T=(n,ok,x)=>{R.push((ok?'PASS ':'FAIL ')+n+(x?' ['+x+']':''))};
 const ev=(f,a)=>pg.evaluate(f,a);
 // freeze
 T('night1 started', await ev(()=>__game.S.phase==='play'&&__game.S.night===1));
 await ev(()=>{const g=__game;g.S.nightCfg.aggro=1;g.S.artRoom='basement';g.S.moveT=0.1;g.openMonitor();g.setFeed('basement');});
 await ev(()=>{for(let i=0;i<60;i++)__game.tick(0.2)});
 T('art frozen while observed', await ev(()=>__game.S.artRoom==='basement'));
 await ev(()=>{__game.closeMonitor();__game.S.moveT=0.1;for(let i=0;i<10;i++)__game.tick(0.2)});
 T('art moves when not observed', await ev(()=>__game.S.artRoom!=='basement'), await ev(()=>__game.S.artRoom));
 // power
 const d=await ev(()=>{const g=__game,S=g.S;S.cam=false;S.door=false;S.power=100;const t0=S.t;g.tick(10);const idle=100-S.power;S.power=100;S.cam=true;g.tick(10);const cam=100-S.power;S.cam=false;return {idle,cam}});
 T('camera drains more than idle', d.cam>d.idle*2, JSON.stringify(d));
 // night 3 appear rule
 await ev(()=>{const g=__game;g.startNight(3);g.S.nightCfg.appearP=1;g.S.artRoom='kitchen';g.openMonitor();g.setFeed('basement');g.setFeed('frontdoor');});
 T('night3: appears in room just checked (basement)', await ev(()=>__game.S.artRoom==='basement'||__game.S.artRoom==='frontdoor'), await ev(()=>__game.S.artRoom+' log:'+__game.S.log.slice(-3).join('|')));
 await ev(()=>{__game.S.artRoom='kitchen';__game.setFeed('hallway');});
 T('night3: appeared in frontdoor after leaving it', await ev(()=>__game.S.log.some(l=>l.includes('APPEAR in frontdoor'))));
 // door held
 await ev(()=>{const g=__game;g.startNight(1);g.S.door=true;g.S.artRoom='hallway';g.S.attackT=1;g.S.power=80;});
 await ev(()=>{for(let i=0;i<8;i++)__game.tick(0.2)});
 T('locked door holds, Art retreats', await ev(()=>__game.S.phase==='play'&&__game.S.artRoom!=='hallway'), await ev(()=>__game.S.artRoom+' pwr '+__game.S.power.toFixed(1)));
 // light-out scare at 10%
 await ev(()=>{const g=__game;g.startNight(1);g.S.power=9.5;g.tick(0.1)});
 await sl(250); await pg.screenshot({path:shotDir+'/a-scare-beat1.png'}); console.log('dbg0',await ev(()=>JSON.stringify([__game.S.t,__game.S.artRoom,__game.S.attackT,__game.S.door,__game.S.phase])));
 const b2=await ev(()=>({busy:__game.S.scareBusy,lo:document.body.classList.contains('lightsout')}));
 T('lights-out scare at 10%: flicker/dark beat', b2.busy&&b2.lo, JSON.stringify(b2));
 await sl(1400); console.log('dbg1',await ev(()=>JSON.stringify([__game.S.t,__game.S.artRoom,__game.S.attackT,__game.S.door,__game.S.phase]))); await pg.screenshot({path:shotDir+'/a-scare-payoff.png'});
 await sl(1500);
 T('scare ends, game continues', await ev(()=>!__game.S.scareBusy&&__game.S.phase==='play'), await ev(()=>JSON.stringify({b:__game.S.scareBusy,ph:__game.S.phase,l:__game.S.log.slice(-4),art:__game.S.artRoom,t:__game.S.t})));
 // attack: door open
 await ev(()=>{const g=__game;g.startNight(2);g.S.door=false;g.S.artRoom='hallway';g.S.attackT=0.1;g.tick(0.5)});
 await sl(900); await pg.screenshot({path:shotDir+'/a-jumpscare.png'});
 await sl(2500);
 T('open door -> jumpscare -> game over', await ev(()=>__game.S.phase==='over'));
 await pg.screenshot({path:shotDir+'/a-gameover.png'});
 await pg.tap('#goRetry'); await sl(500);
 T('retry restarts night 2', await ev(()=>__game.S.phase==='play'&&__game.S.night===2));
 // power zero
 await ev(()=>{const g=__game;g.S.power=0.1;g.S.lo10=true;g.tick(1)});
 T('power 0 -> dead', await ev(()=>__game.S.powerDead));
 await sl(300); await pg.screenshot({path:shotDir+'/a-powerdead.png'});
 await ev(()=>{__game.S.deadT=0.1;__game.tick(0.5)}); await sl(2800);
 T('power dead -> Art attacks -> game over', await ev(()=>__game.S.phase==='over'));
 // full progression
 await pg.tap('#goRetry'); await sl(300);
 for(let n=1;n<=5;n++){
   await ev((n)=>{const g=__game;g.startNight(n);g.S.session=0;g.S.nightCfg.aggro=0;g.S.power=100;g.S.peeks=[];g.S.t=g.S.len-0.1;g.tick(0.3)},n);
   await sl(1500);
   const ph=await ev(()=>__game.S.phase);
   if(n<5){ T('night '+n+' -> lore', ph==='lore'); await sl(2500); if(n===1||n===3) await pg.screenshot({path:shotDir+'/a-lore'+n+'.png'});
     await sl(2200); await pg.evaluate(()=>document.getElementById('loreNext').click()); await sl(400);
     T('after lore: night '+(n+1), await ev(m=>__game.S.phase==='play'&&__game.S.night===m,n+1)); }
   else { T('night 5 -> win', ph==='win'); await sl(600); await pg.screenshot({path:shotDir+'/a-win.png'}); }
 }
 // cap
 await pg.tap('#winAgain'); await sl(400);
 await ev(()=>{__game.S.session=599.9}); await sl(600);
 T('10-min cap -> bad ending', await ev(()=>__game.S.phase==='bad'));
 await pg.screenshot({path:shotDir+'/a-bad.png'});
 console.log(R.join('\n')); console.log(errs.join('\n')||'no console errors');
 await b.close();
})();
