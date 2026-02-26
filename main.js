/* ══════════════════════════════════════════
   GARCIA'S SCRIPT – main.js
══════════════════════════════════════════ */

/* ── CONFIG — paste your links here ── */
var CP_LINKS = {
  1: 'https://direct-link.net/2561546/piqYsBqnZeyP',
  2: 'https://lootlabs.gg/YOUR_CP2_LINK_HERE',
  3: 'https://lootlabs.gg/YOUR_CP3_LINK_HERE',
};
var KEY_SOURCE  = 'https://raw.githubusercontent.com/kielsvu/Utility/refs/heads/Lua/Utility/Major/Main.txt';
var COOLDOWN_MS = 20 * 60 * 60 * 1000;
var CP_DURATION = 30; // seconds user must wait inside iframe

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
function eclEase(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }
function eclDrawFull() {
  eclCtx.clearRect(0,0,eW,eH);
  eclCtx.fillStyle = 'rgb(5,5,5)';
  eclCtx.beginPath(); eclCtx.arc(eW/2,eH/2,eclMaxR,0,Math.PI*2); eclCtx.fill();
}
function eclDraw(r) {
  eclCtx.clearRect(0,0,eW,eH);
  if (r <= 0) return;
  if (r > 4) {
    var g = eclCtx.createRadialGradient(eW/2,eH/2,Math.max(0,r-22),eW/2,eH/2,r+10);
    g.addColorStop(0,'rgba(178,132,255,0)'); g.addColorStop(0.45,'rgba(178,132,255,0.65)'); g.addColorStop(1,'rgba(178,132,255,0)');
    eclCtx.fillStyle = g;
    eclCtx.beginPath(); eclCtx.arc(eW/2,eH/2,r+10,0,Math.PI*2); eclCtx.fill();
  }
  eclCtx.fillStyle = 'rgb(5,5,5)';
  eclCtx.beginPath(); eclCtx.arc(eW/2,eH/2,r,0,Math.PI*2); eclCtx.fill();
}
function eclExpand(cb) {
  var s=null, F=1000/60; eclCanvas.style.pointerEvents='all';
  function step(){ var n=Date.now(); if(!s)s=n; var t=Math.min((n-s)/480,1); eclDraw(eclEase(t)*eclMaxR); if(t<1){setTimeout(step,F);}else{eclDrawFull();setTimeout(cb,60);} }
  step();
}
function eclShrink(cb) {
  var s=performance.now();
  function step(n){ var t=Math.min((n-s)/480,1); eclDraw((1-eclEase(t))*eclMaxR); if(t<1){requestAnimationFrame(step);}else{eclCtx.clearRect(0,0,eW,eH);eclCanvas.style.pointerEvents='none';if(cb)cb();} }
  requestAnimationFrame(step);
}
function goToView(n) {
  if (n===currentView||eclAnimating) return;
  eclAnimating = true;
  document.body.classList.add('exiting');
  eclExpand(function() {
    document.getElementById('view'+currentView).classList.remove('active');
    currentView = n;
    var el = document.getElementById('view'+n);
    el.classList.add('active');
    var card = el.querySelector('.card');
    if (card) { card.classList.remove('animIn'); void card.offsetWidth; card.classList.add('animIn'); }
    if (n === 4) loadKey();
    document.body.classList.remove('exiting');
    eclAnimating = false;
    eclShrink(null);
  });
}

/* ──────────────────────────────────────────
   CHECKPOINT — iframe inside the card
   Flow:
   1. User clicks "Start Checkpoint"
   2. iframe loads the Lootlabs link
   3. Countdown timer runs (CP_DURATION seconds)
   4. When timer hits 0 → green, Continue unlocks
────────────────────────────────────────── */
function initCheckpoint(cpNum) {
  var startBtn    = document.getElementById('startBtn' + cpNum);
  var iframe      = document.getElementById('cpIframe' + cpNum);
  var window_     = document.getElementById('cpWindow' + cpNum);
  var timer       = document.getElementById('cpTimer' + cpNum);
  var footer      = document.getElementById('cpFooter' + cpNum);
  var statusEl    = document.getElementById('status' + cpNum);
  var continueWrap= document.getElementById('continueWrap' + cpNum);
  var continueBtn = document.getElementById('continueBtn' + cpNum);
  var pulseEl     = document.getElementById('pulse' + cpNum);
  var labelEl     = document.getElementById('label' + cpNum);

  startBtn.addEventListener('click', function() {
    if (cpDone[cpNum]) return;

    // Hide start button, show iframe window
    startBtn.parentElement.style.display = 'none';
    window_.style.display = 'block';
    statusEl.innerHTML = '<span class="spinner"></span> Complete the checkpoint in the window below…';

    // Load the Lootlabs link into the iframe
    iframe.src = CP_LINKS[cpNum] || 'about:blank';

    // Start countdown
    var secs = CP_DURATION;
    timer.textContent = secs + 's';
    timer.style.color = 'rgba(178,132,255,0.8)';

    var countdown = setInterval(function() {
      secs--;
      if (secs > 0) {
        timer.textContent = secs + 's';
        // Turn yellow at halfway
        if (secs <= Math.ceil(CP_DURATION / 2)) {
          timer.style.color = 'rgba(255,210,80,0.9)';
        }
      } else {
        clearInterval(countdown);
        // Timer done — unlock
        timer.textContent = '✓';
        timer.style.color = 'var(--green)';
        timer.style.fontWeight = '900';
        footer.style.background = 'rgba(100,220,140,0.08)';
        footer.style.borderColor = 'rgba(100,220,140,0.4)';
        footer.querySelector('.cp-foot-text').textContent = '✓ Checkpoint complete!';
        footer.querySelector('.cp-foot-text').style.color = 'var(--green)';

        statusEl.textContent = '✓ Checkpoint complete — you may continue!';
        statusEl.classList.add('unlocked');

        // Show and unlock continue button
        cpDone[cpNum] = true;
        continueWrap.style.display = 'block';
        continueBtn.classList.remove('locked');
        continueBtn.disabled = false;
        pulseEl.style.display = 'block';
        labelEl.innerHTML = 'Continue <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:var(--border);fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

        continueBtn.onclick = function() {
          this.classList.add('verified');
          labelEl.innerHTML = '✓ &nbsp;Verified';
          // Collapse iframe to save space
          iframe.src = 'about:blank';
          window_.style.display = 'none';
          setTimeout(function() { goToView(cpNum + 1); }, 500);
        };
      }
    }, 1000);
  });
}

/* ──────────────────────────────────────────
   KEY SYSTEM
────────────────────────────────────────── */
var STORAGE_KEY = 'garcia_key_data';

function loadKey() {
  var keyEl   = document.getElementById('keyValue');
  var subEl   = document.getElementById('keySub');
  var timerEl = document.getElementById('cooldownTimer');
  if (keyEl) keyEl.textContent = 'Loading...';

  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch(e) {}

  if (saved && saved.issuedAt && (Date.now() - saved.issuedAt) < COOLDOWN_MS) {
    if (keyEl) keyEl.textContent = saved.key;
    if (subEl) subEl.textContent = 'Your existing key — resets after cooldown';
    startTimer(saved, timerEl);
    return;
  }

  fetchKeys().then(function(all) {
    var picked = pickKey(all);
    var data = { key: picked, issuedAt: Date.now() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
    if (keyEl) keyEl.textContent = picked;
    if (subEl) subEl.textContent = 'All checkpoints complete — here is your script key';
    startTimer(data, timerEl);
  }).catch(function() {
    if (keyEl) keyEl.textContent = 'Error loading';
    if (subEl) subEl.innerHTML = 'Could not load. <a href="javascript:loadKey()" style="color:var(--gold);text-decoration:underline;">Tap to retry</a>';
  });
}

async function fetchKeys() {
  var url = KEY_SOURCE + '?t=' + Date.now(), res;
  for (var i = 1; i <= 3; i++) {
    try { res = await fetch(url, { method:'GET', cache:'no-store' }); if (res.ok) break; }
    catch(e) { if (i < 3) await new Promise(function(r){ setTimeout(r, 700*i); }); }
  }
  if (!res || !res.ok) throw new Error('fail');
  var keys = (await res.text()).split('\n').map(function(k){ return k.trim(); }).filter(function(k){ return k.length > 0; });
  if (!keys.length) throw new Error('empty');
  return keys;
}

function pickKey(all) {
  var used = [];
  try { used = JSON.parse(localStorage.getItem('garcia_used_keys') || '[]'); } catch(e) {}
  var avail = all.filter(function(k){ return used.indexOf(k) === -1; });
  if (!avail.length) { avail = all; used = []; try { localStorage.removeItem('garcia_used_keys'); } catch(e) {} }
  var picked = avail[Math.floor(Math.random() * avail.length)];
  used.push(picked);
  try { localStorage.setItem('garcia_used_keys', JSON.stringify(used)); } catch(e) {}
  return picked;
}

function startTimer(data, el) {
  if (!el) return;
  function tick() {
    var rem = COOLDOWN_MS - (Date.now() - data.issuedAt);
    if (rem <= 0) { el.textContent = '🔓 Key expired — refresh for a new one'; el.style.color = 'rgba(255,255,255,0.35)'; try { localStorage.removeItem(STORAGE_KEY); } catch(e) {} return; }
    var h=Math.floor(rem/3600000), m=Math.floor((rem%3600000)/60000), s=Math.floor((rem%60000)/1000);
    el.textContent = '⏳ Key valid for: '+pad(h)+'h '+pad(m)+'m '+pad(s)+'s';
    setTimeout(tick, 1000);
  }
  tick();
}

function copyKey() {
  var key = document.getElementById('keyValue').textContent;
  if (!key || key === 'Loading...' || key === 'Error loading') return;
  var btn = document.getElementById('copyBtn');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(key).then(function(){ flashCopy(btn); }).catch(function(){ fallbackCopy(key, btn); });
  } else { fallbackCopy(key, btn); }
}
function fallbackCopy(text, btn) {
  var ta = document.createElement('textarea'); ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;font-size:16px;';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try { document.execCommand('copy'); } catch(e) {}
  document.body.removeChild(ta); flashCopy(btn);
}
function flashCopy(btn) {
  if (!btn) return;
  btn.textContent = 'Copied!'; btn.classList.add('copied');
  setTimeout(function(){ btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
}

/* ──────────────────────────────────────────
   CLOCK & STARS
────────────────────────────────────────── */
function pad(n) { return String(n).padStart(2,'0'); }
function startClock() {
  var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function tick() {
    var now=new Date(), h=now.getHours(), m=now.getMinutes(), s=now.getSeconds();
    var ap=h>=12?'PM':'AM'; h=h%12||12;
    var t=days[now.getDay()]+' '+pad(h)+':'+pad(m)+':'+pad(s)+' '+ap;
    document.querySelectorAll('.datetime').forEach(function(el){ el.textContent=t; });
  }
  tick(); setInterval(tick, 1000);
}
function spawnStars() {
  var el = document.getElementById('stars'); if (!el) return;
  for (var i=0; i<120; i++) {
    var s=document.createElement('div'); s.className='star';
    var sz=Math.random()*2+0.5;
    s.style.cssText='width:'+sz+'px;height:'+sz+'px;top:'+(Math.random()*100)+'%;left:'+(Math.random()*100)+'%;--d:'+(2+Math.random()*5)+'s;--delay:'+(Math.random()*7)+'s;--op:'+(0.2+Math.random()*0.6)+';';
    el.appendChild(s);
  }
}

/* ── BOOT ── */
document.addEventListener('DOMContentLoaded', function() {
  spawnStars();
  startClock();
  eclInit();
  initCheckpoint(1);
  initCheckpoint(2);
  initCheckpoint(3);
});
