/* ══════════════════════════════════════════
   GARCIA'S SCRIPT – main.js
══════════════════════════════════════════ */

/* ── CONFIG ──
   Set CP_LINKS to your Lootlabs links.
   Set DONE_SIGNAL to a word that appears in
   the URL Lootlabs redirects to after completion.
   e.g. if redirect URL is:
     https://yourname.github.io/repo/?done
   then DONE_SIGNAL = 'done'
────────────────────────────────────────── */
var CP_LINKS = {
  1: 'https://lootlabs.gg/YOUR_CP1_LINK_HERE',
  2: 'https://lootlabs.gg/YOUR_CP2_LINK_HERE',
  3: 'https://lootlabs.gg/YOUR_CP3_LINK_HERE',
};
var DONE_SIGNAL = 'done'; // word to detect in redirect URL
var KEY_SOURCE  = 'https://raw.githubusercontent.com/kielsvu/Utility/refs/heads/Lua/Utility/Major/Main.txt';
var COOLDOWN_MS = 20 * 60 * 60 * 1000;

/* ── STATE ── */
var currentView = 1;
var cpDone = { 1: false, 2: false, 3: false };

/* ──────────────────────────────────────────
   ECLIPSE TRANSITION
────────────────────────────────────────── */
var eclCanvas, eclCtx, eW, eH, eclMaxR, eclAnimating = false;

function eclInit() {
  eclCanvas = document.createElement('canvas');
  eclCanvas.id = 'eclipse-canvas';
  eclCanvas.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;display:block;will-change:transform;';
  document.body.appendChild(eclCanvas);
  eclCtx = eclCanvas.getContext('2d');
  eclResize();
  window.addEventListener('resize', eclResize);
  eclDrawFull();
  eclCanvas.style.pointerEvents = 'all';
  setTimeout(function() {
    eclShrink(function() { eclCanvas.style.pointerEvents = 'none'; eclAnimating = false; });
  }, 50);
}
function eclResize() {
  if (!eclCanvas) return;
  eW = eclCanvas.width = window.innerWidth;
  eH = eclCanvas.height = window.innerHeight;
  eclMaxR = Math.hypot(eW, eH) / 2 + 6;
}
function eclEase(t) { return t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }
function eclDrawFull() {
  eclCtx.clearRect(0,0,eW,eH);
  eclCtx.fillStyle='rgb(5,5,5)';
  eclCtx.beginPath(); eclCtx.arc(eW/2,eH/2,eclMaxR,0,Math.PI*2); eclCtx.fill();
}
function eclDraw(r) {
  eclCtx.clearRect(0,0,eW,eH); if(r<=0)return;
  if(r>4){
    var g=eclCtx.createRadialGradient(eW/2,eH/2,Math.max(0,r-22),eW/2,eH/2,r+10);
    g.addColorStop(0,'rgba(178,132,255,0)'); g.addColorStop(0.45,'rgba(178,132,255,0.65)'); g.addColorStop(1,'rgba(178,132,255,0)');
    eclCtx.fillStyle=g; eclCtx.beginPath(); eclCtx.arc(eW/2,eH/2,r+10,0,Math.PI*2); eclCtx.fill();
  }
  eclCtx.fillStyle='rgb(5,5,5)'; eclCtx.beginPath(); eclCtx.arc(eW/2,eH/2,r,0,Math.PI*2); eclCtx.fill();
}
function eclExpand(cb) {
  var s=null,F=1000/60; eclCanvas.style.pointerEvents='all';
  function step(){ var n=Date.now(); if(!s)s=n; var t=Math.min((n-s)/480,1); eclDraw(eclEase(t)*eclMaxR); if(t<1){setTimeout(step,F);}else{eclDrawFull();setTimeout(cb,60);} }
  step();
}
function eclShrink(cb) {
  var s=performance.now();
  function step(n){ var t=Math.min((n-s)/480,1); eclDraw((1-eclEase(t))*eclMaxR); if(t<1){requestAnimationFrame(step);}else{eclCtx.clearRect(0,0,eW,eH);eclCanvas.style.pointerEvents='none';if(cb)cb();} }
  requestAnimationFrame(step);
}
function goToView(n) {
  if(n===currentView||eclAnimating)return;
  eclAnimating=true; document.body.classList.add('exiting');
  eclExpand(function(){
    document.getElementById('view'+currentView).classList.remove('active');
    currentView=n;
    var el=document.getElementById('view'+n);
    el.classList.add('active');
    var card=el.querySelector('.card');
    if(card){card.classList.remove('animIn');void card.offsetWidth;card.classList.add('animIn');}
    if(n===4)loadKey();
    document.body.classList.remove('exiting');
    eclAnimating=false; eclShrink(null);
  });
}

/* ──────────────────────────────────────────
   CHECKPOINT — iframe with real completion detection

   How it works:
   1. Lootlabs link loads in iframe
   2. We poll iframe src/href every 500ms
   3. When iframe navigates to your redirect URL
      (which contains DONE_SIGNAL), we catch it
      and unlock the checkpoint immediately
   4. Also catches postMessage events from the
      iframe in case Lootlabs sends one
   5. Manual "I completed it" fallback button
      in case iframe detection fails
────────────────────────────────────────── */
function initCheckpoint(cpNum) {
  var startBtn     = document.getElementById('startBtn'     + cpNum);
  var iframe       = document.getElementById('cpIframe'     + cpNum);
  var cpWindow     = document.getElementById('cpWindow'     + cpNum);
  var timerEl      = document.getElementById('cpTimer'      + cpNum);
  var footerEl     = document.getElementById('cpFooter'     + cpNum);
  var statusEl     = document.getElementById('status'       + cpNum);
  var continueWrap = document.getElementById('continueWrap' + cpNum);
  var continueBtn  = document.getElementById('continueBtn'  + cpNum);
  var pulseEl      = document.getElementById('pulse'        + cpNum);
  var labelEl      = document.getElementById('label'        + cpNum);
  var doneOverlay  = document.getElementById('doneOverlay'  + cpNum);
  var manualBtn    = document.getElementById('manualBtn'    + cpNum);

  var pollInterval = null;
  var iframeDone   = false;

  /* ── Check if iframe URL signals completion ── */
  function checkIframeDone() {
    if (iframeDone) return;
    var href = '';
    try {
      // Same-origin: direct access
      href = iframe.contentWindow.location.href;
    } catch(e) {
      // Cross-origin: read iframe.src as fallback
      href = iframe.src || '';
    }
    if (href && href.indexOf(DONE_SIGNAL) !== -1) {
      onComplete();
    }
  }

  /* ── iframe load event — fires on every navigation ── */
  iframe.addEventListener('load', function() {
    checkIframeDone();
  });

  /* ── postMessage from iframe (some ad networks use this) ── */
  window.addEventListener('message', function(e) {
    if (iframeDone) return;
    var data = e.data;
    if (typeof data === 'string') {
      if (data.indexOf('complete') !== -1 || data.indexOf('done') !== -1 || data.indexOf('success') !== -1) {
        onComplete();
      }
    } else if (data && typeof data === 'object') {
      if (data.type === 'complete' || data.type === 'done' || data.completed || data.success) {
        onComplete();
      }
    }
  });

  /* ── Poll every 500ms as safety net ── */
  function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(function() {
      if (iframeDone) { clearInterval(pollInterval); return; }
      checkIframeDone();
    }, 500);
  }

  /* ── Completion handler ── */
  function onComplete() {
    if (iframeDone) return;
    iframeDone = true;
    clearInterval(pollInterval);

    // Show done overlay inside the iframe window
    doneOverlay.classList.add('visible');
    timerEl.textContent = '✓';
    timerEl.style.color = 'var(--green)';

    footerEl.style.background    = 'rgba(100,220,140,0.08)';
    footerEl.style.borderColor   = 'rgba(100,220,140,0.4)';
    footerEl.querySelector('.cp-foot-text').textContent = '✓ Checkpoint complete!';
    footerEl.querySelector('.cp-foot-text').style.color = 'var(--green)';

    statusEl.textContent = '✓ Checkpoint complete — you may continue!';
    statusEl.classList.add('unlocked');

    cpDone[cpNum] = true;
    continueWrap.style.display = 'block';
    continueBtn.classList.remove('locked');
    continueBtn.disabled = false;
    pulseEl.style.display = 'block';
    labelEl.innerHTML = 'Continue <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:var(--border);fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

    continueBtn.onclick = function() {
      this.classList.add('verified');
      labelEl.innerHTML = '✓ &nbsp;Verified';
      iframe.src = 'about:blank';
      cpWindow.style.display = 'none';
      setTimeout(function() { goToView(cpNum + 1); }, 500);
    };
  }

  /* ── Manual fallback button ── */
  manualBtn.addEventListener('click', function() {
    onComplete();
  });

  /* ── Start button ── */
  startBtn.addEventListener('click', function() {
    if (cpDone[cpNum]) return;
    startBtn.parentElement.style.display = 'none';
    cpWindow.style.display = 'block';
    statusEl.innerHTML = '<span class="spinner"></span> Complete the checkpoint in the window below…';
    timerEl.textContent = '⏳';

    // Load Lootlabs into iframe
    iframe.src = CP_LINKS[cpNum] || 'about:blank';

    startPolling();
  });
}

/* ──────────────────────────────────────────
   KEY SYSTEM
────────────────────────────────────────── */
var STORAGE_KEY = 'garcia_key_data';

function loadKey() {
  var keyEl=document.getElementById('keyValue'), subEl=document.getElementById('keySub'), timerEl=document.getElementById('cooldownTimer');
  if(keyEl)keyEl.textContent='Loading...';
  var saved=null; try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY));}catch(e){}
  if(saved&&saved.issuedAt&&(Date.now()-saved.issuedAt)<COOLDOWN_MS){
    if(keyEl)keyEl.textContent=saved.key;
    if(subEl)subEl.textContent='Your existing key — resets after cooldown';
    startTimer(saved,timerEl); return;
  }
  fetchKeys().then(function(all){
    var picked=pickKey(all), data={key:picked,issuedAt:Date.now()};
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch(e){}
    if(keyEl)keyEl.textContent=picked;
    if(subEl)subEl.textContent='All checkpoints complete — here is your script key';
    startTimer(data,timerEl);
  }).catch(function(){
    if(keyEl)keyEl.textContent='Error loading';
    if(subEl)subEl.innerHTML='Could not load. <a href="javascript:loadKey()" style="color:var(--gold);text-decoration:underline;">Tap to retry</a>';
  });
}
async function fetchKeys(){
  var url=KEY_SOURCE+'?t='+Date.now(),res;
  for(var i=1;i<=3;i++){try{res=await fetch(url,{method:'GET',cache:'no-store'});if(res.ok)break;}catch(e){if(i<3)await new Promise(function(r){setTimeout(r,700*i);});}}
  if(!res||!res.ok)throw new Error('fail');
  var keys=(await res.text()).split('\n').map(function(k){return k.trim();}).filter(function(k){return k.length>0;});
  if(!keys.length)throw new Error('empty');
  return keys;
}
function pickKey(all){
  var used=[];try{used=JSON.parse(localStorage.getItem('garcia_used_keys')||'[]');}catch(e){}
  var avail=all.filter(function(k){return used.indexOf(k)===-1;});
  if(!avail.length){avail=all;used=[];try{localStorage.removeItem('garcia_used_keys');}catch(e){}}
  var picked=avail[Math.floor(Math.random()*avail.length)];
  used.push(picked);try{localStorage.setItem('garcia_used_keys',JSON.stringify(used));}catch(e){}
  return picked;
}
function startTimer(data,el){
  if(!el)return;
  function tick(){
    var rem=COOLDOWN_MS-(Date.now()-data.issuedAt);
    if(rem<=0){el.textContent='🔓 Key expired — refresh for a new one';el.style.color='rgba(255,255,255,0.35)';try{localStorage.removeItem(STORAGE_KEY);}catch(e){}return;}
    var h=Math.floor(rem/3600000),m=Math.floor((rem%3600000)/60000),s=Math.floor((rem%60000)/1000);
    el.textContent='⏳ Key valid for: '+pad(h)+'h '+pad(m)+'m '+pad(s)+'s';setTimeout(tick,1000);
  }tick();
}
function copyKey(){
  var key=document.getElementById('keyValue').textContent;
  if(!key||key==='Loading...'||key==='Error loading')return;
  var btn=document.getElementById('copyBtn');
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(key).then(function(){flashCopy(btn);}).catch(function(){fallbackCopy(key,btn);});}
  else{fallbackCopy(key,btn);}
}
function fallbackCopy(text,btn){
  var ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;top:-9999px;left:-9999px;opacity:0;font-size:16px;';
  document.body.appendChild(ta);ta.focus();ta.select();try{document.execCommand('copy');}catch(e){}document.body.removeChild(ta);flashCopy(btn);
}
function flashCopy(btn){if(!btn)return;btn.textContent='Copied!';btn.classList.add('copied');setTimeout(function(){btn.textContent='Copy';btn.classList.remove('copied');},2000);}

/* ──────────────────────────────────────────
   CLOCK & STARS
────────────────────────────────────────── */
function pad(n){return String(n).padStart(2,'0');}
function startClock(){
  var days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function tick(){var now=new Date(),h=now.getHours(),m=now.getMinutes(),s=now.getSeconds();var ap=h>=12?'PM':'AM';h=h%12||12;var t=days[now.getDay()]+' '+pad(h)+':'+pad(m)+':'+pad(s)+' '+ap;document.querySelectorAll('.datetime').forEach(function(el){el.textContent=t;});}
  tick();setInterval(tick,1000);
}
function spawnStars(){
  var el=document.getElementById('stars');if(!el)return;
  for(var i=0;i<120;i++){var s=document.createElement('div');s.className='star';var sz=Math.random()*2+0.5;s.style.cssText='width:'+sz+'px;height:'+sz+'px;top:'+(Math.random()*100)+'%;left:'+(Math.random()*100)+'%;--d:'+(2+Math.random()*5)+'s;--delay:'+(Math.random()*7)+'s;--op:'+(0.2+Math.random()*0.6)+';';el.appendChild(s);}
}

/* ── BOOT ── */
document.addEventListener('DOMContentLoaded', function(){
  spawnStars(); startClock(); eclInit();
  initCheckpoint(1); initCheckpoint(2); initCheckpoint(3);
});
