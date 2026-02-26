/* ══════════════════════════════════════════
   GARCIA'S SCRIPT – main.js
   Handles: Eclipse transition, checkpoint
   detection, key fetching, clock, stars
══════════════════════════════════════════ */

/* ──────────────────────────────────────────
   CONFIG — paste your Lootlabs links here
────────────────────────────────────────── */
var CP_LINKS = {
  1: 'https://lootlabs.gg/YOUR_CP1_LINK_HERE',
  2: 'https://lootlabs.gg/YOUR_CP2_LINK_HERE',
  3: 'https://lootlabs.gg/YOUR_CP3_LINK_HERE',
};
var KEY_SOURCE  = 'https://raw.githubusercontent.com/kielsvu/Utility/refs/heads/Lua/Utility/Major/Main.txt';
var COOLDOWN_MS = 20 * 60 * 60 * 1000; // 20 hours
var MIN_AWAY_MS = 4000;                 // must be away 4s before unlock triggers

/* ──────────────────────────────────────────
   STATE
────────────────────────────────────────── */
var currentView   = 1;           // 1=CP1, 2=CP2, 3=CP3, 4=Key
var cpDone        = [false, false, false]; // cp1, cp2, cp3
var clickedAt     = [null, null, null];    // timestamp per checkpoint
var cpListeners   = [null, null, null];    // per-checkpoint cleanup fns
var pollTimers    = [null, null, null];

/* ──────────────────────────────────────────
   ECLIPSE TRANSITION
────────────────────────────────────────── */
var eclCanvas, eclCtx, eW, eH, eclMaxR;
var eclAnimating = false;
var EXPAND_MS = 480, SHRINK_MS = 480, HOLD_MS = 60;

function eclInit() {
  eclCanvas = document.createElement('canvas');
  eclCanvas.id = 'eclipse-canvas';
  eclCanvas.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;display:block;will-change:transform;';
  document.body.appendChild(eclCanvas);
  eclCtx = eclCanvas.getContext('2d');
  eclResize();
  window.addEventListener('resize', eclResize);

  // Entrance: start covered, shrink open
  eclDrawFull();
  eclCanvas.style.pointerEvents = 'all';
  setTimeout(function() {
    eclShrink(function() {
      eclCanvas.style.pointerEvents = 'none';
      eclAnimating = false;
    });
  }, 50);
}

function eclResize() {
  if (!eclCanvas) return;
  eW = eclCanvas.width  = window.innerWidth;
  eH = eclCanvas.height = window.innerHeight;
  eclMaxR = Math.hypot(eW, eH) / 2 + 6;
}

function eclEase(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }

function eclDrawFull() {
  eclCtx.clearRect(0, 0, eW, eH);
  eclCtx.fillStyle = 'rgb(5,5,5)';
  eclCtx.beginPath();
  eclCtx.arc(eW/2, eH/2, eclMaxR, 0, Math.PI*2);
  eclCtx.fill();
}

function eclDrawCircle(r) {
  eclCtx.clearRect(0, 0, eW, eH);
  if (r <= 0) return;
  if (r > 4) {
    var grd = eclCtx.createRadialGradient(eW/2, eH/2, Math.max(0,r-22), eW/2, eH/2, r+10);
    grd.addColorStop(0,    'rgba(178,132,255,0.00)');
    grd.addColorStop(0.45, 'rgba(178,132,255,0.65)');
    grd.addColorStop(1,    'rgba(178,132,255,0.00)');
    eclCtx.fillStyle = grd;
    eclCtx.beginPath();
    eclCtx.arc(eW/2, eH/2, r+10, 0, Math.PI*2);
    eclCtx.fill();
  }
  eclCtx.fillStyle = 'rgb(5,5,5)';
  eclCtx.beginPath();
  eclCtx.arc(eW/2, eH/2, r, 0, Math.PI*2);
  eclCtx.fill();
}

// Exit — setTimeout loop so browser can't throttle it during view switch
function eclExpand(cb) {
  var start = null;
  var FRAME = 1000/60;
  eclCanvas.style.pointerEvents = 'all';
  function step() {
    var now = Date.now();
    if (!start) start = now;
    var t = Math.min((now - start) / EXPAND_MS, 1);
    eclDrawCircle(eclEase(t) * eclMaxR);
    if (t < 1) { setTimeout(step, FRAME); }
    else { eclDrawFull(); setTimeout(cb, HOLD_MS); }
  }
  step();
}

// Entrance — rAF is fine, no navigation happening
function eclShrink(cb) {
  var start = performance.now();
  function step(now) {
    var t = Math.min((now - start) / SHRINK_MS, 1);
    eclDrawCircle((1 - eclEase(t)) * eclMaxR);
    if (t < 1) { requestAnimationFrame(step); }
    else {
      eclCtx.clearRect(0, 0, eW, eH);
      eclCanvas.style.pointerEvents = 'none';
      if (cb) cb();
    }
  }
  requestAnimationFrame(step);
}

function goToView(n) {
  if (n === currentView || eclAnimating) return;
  eclAnimating = true;
  document.body.classList.add('exiting');

  eclExpand(function() {
    // Swap views
    document.getElementById('view' + currentView).classList.remove('active');
    currentView = n;
    var nextView = document.getElementById('view' + n);
    nextView.classList.add('active');

    // Re-trigger card animation
    var card = nextView.querySelector('.card');
    if (card) {
      card.classList.remove('animIn');
      void card.offsetWidth; // reflow
      card.classList.add('animIn');
    }

    // If key view — load key
    if (n === 4) loadKey();

    document.body.classList.remove('exiting');
    eclAnimating = false;
    eclShrink(null);
  });
}

/* ──────────────────────────────────────────
   CHECKPOINT DETECTION
   Works on mobile + PC. Uses timestamp of
   link click — unlocks only after MIN_AWAY_MS
────────────────────────────────────────── */
function initCheckpoint(cpIndex) { // 0-based (0=CP1)
  var cpNum    = cpIndex + 1;
  var visitBtn = document.getElementById('visitBtn' + cpNum);
  var contBtn  = document.getElementById('continueBtn' + cpNum);
  var pulseEl  = document.getElementById('pulse' + cpNum);
  var labelEl  = document.getElementById('label' + cpNum);
  var statusEl = document.getElementById('status' + cpNum);

  if (!visitBtn) return;

  // Set link
  visitBtn.href = CP_LINKS[cpNum] || '#';

  function tryUnlock() {
    if (cpDone[cpIndex] || !clickedAt[cpIndex]) return;
    var away = Date.now() - clickedAt[cpIndex];
    if (away >= MIN_AWAY_MS) doUnlock();
  }

  function doUnlock() {
    if (cpDone[cpIndex]) return;
    cpDone[cpIndex] = true;
    cleanup();
    sessionStorage.setItem('cp' + cpNum + '_done', '1');

    statusEl.textContent = '✓ Link completed — you may continue!';
    statusEl.classList.add('unlocked');
    visitBtn.style.opacity = '0.35';
    visitBtn.style.pointerEvents = 'none';
    contBtn.classList.remove('locked');
    contBtn.disabled = false;
    pulseEl.style.display = 'block';
    labelEl.innerHTML = 'Continue <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:var(--border);fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
  }

  function onVis() {
    if (document.visibilityState === 'visible') tryUnlock();
  }
  function onFocus() { tryUnlock(); }
  function onPageShow() { tryUnlock(); }

  function cleanup() {
    if (pollTimers[cpIndex]) { clearInterval(pollTimers[cpIndex]); pollTimers[cpIndex] = null; }
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('pageshow', onPageShow);
  }

  // Listen from page load so we catch return even before user clicks
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('focus',    onFocus);
  window.addEventListener('pageshow', onPageShow);

  // Fallback poll every 500ms
  pollTimers[cpIndex] = setInterval(function() {
    if (cpDone[cpIndex]) { cleanup(); return; }
    if (document.visibilityState === 'visible' && clickedAt[cpIndex]) tryUnlock();
  }, 500);

  // Link click — record timestamp
  visitBtn.addEventListener('click', function() {
    if (cpDone[cpIndex]) return;
    clickedAt[cpIndex] = Date.now();
    sessionStorage.setItem('cp' + cpNum + '_clickedAt', String(clickedAt[cpIndex]));
    setTimeout(function() {
      if (!cpDone[cpIndex]) {
        statusEl.innerHTML = '<span class="spinner"></span> Complete the link then come back…';
      }
    }, 800);
  });

  // Continue button
  contBtn.addEventListener('click', function() {
    if (!cpDone[cpIndex]) return;
    this.classList.add('verified');
    labelEl.innerHTML = '✓ &nbsp;Verified';
    setTimeout(function() { goToView(cpNum + 1); }, 500);
  });

  // Restore session state
  if (sessionStorage.getItem('cp' + cpNum + '_done')) {
    clickedAt[cpIndex] = Date.now() - 999999;
    doUnlock();
  } else {
    var saved = sessionStorage.getItem('cp' + cpNum + '_clickedAt');
    if (saved) {
      clickedAt[cpIndex] = parseInt(saved, 10);
      statusEl.innerHTML = '<span class="spinner"></span> Complete the link then come back…';
    }
  }

  cpListeners[cpIndex] = cleanup;
}

/* ──────────────────────────────────────────
   KEY SYSTEM
────────────────────────────────────────── */
var STORAGE_KEY = 'garcia_key_data';

function loadKey() {
  var keyEl    = document.getElementById('keyValue');
  var subEl    = document.getElementById('keySub');
  var timerEl  = document.getElementById('cooldownTimer');
  if (keyEl) keyEl.textContent = 'Loading...';

  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch(e){}

  if (saved && saved.issuedAt && (Date.now() - saved.issuedAt) < COOLDOWN_MS) {
    if (keyEl) keyEl.textContent = saved.key;
    if (subEl) subEl.textContent = 'Your existing key — resets after cooldown';
    startTimer(saved, timerEl);
    return;
  }

  fetchKeys().then(function(all) {
    var picked = pickKey(all);
    var data   = { key: picked, issuedAt: Date.now() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e){}
    if (keyEl) keyEl.textContent = picked;
    if (subEl) subEl.textContent = 'All checkpoints complete — here is your script key';
    startTimer(data, timerEl);
  }).catch(function() {
    if (keyEl) keyEl.textContent = 'Error loading';
    if (subEl) subEl.innerHTML = 'Could not load. <a href="javascript:loadKey()" style="color:var(--gold);text-decoration:underline;">Tap to retry</a>';
  });
}

async function fetchKeys() {
  var url = KEY_SOURCE + '?t=' + Date.now();
  var res, err;
  for (var i = 1; i <= 3; i++) {
    try {
      res = await fetch(url, { method:'GET', cache:'no-store' });
      if (res.ok) break;
    } catch(e) {
      err = e;
      if (i < 3) await new Promise(function(r){ setTimeout(r, 700*i); });
    }
  }
  if (!res || !res.ok) throw new Error('Fetch failed');
  var text = await res.text();
  var keys = text.split('\n').map(function(k){ return k.trim(); }).filter(function(k){ return k.length > 0; });
  if (!keys.length) throw new Error('Empty');
  return keys;
}

function pickKey(all) {
  var used = [];
  try { used = JSON.parse(localStorage.getItem('garcia_used_keys') || '[]'); } catch(e){}
  var avail = all.filter(function(k){ return used.indexOf(k) === -1; });
  if (!avail.length) { avail = all; used = []; try { localStorage.removeItem('garcia_used_keys'); } catch(e){} }
  var picked = avail[Math.floor(Math.random() * avail.length)];
  used.push(picked);
  try { localStorage.setItem('garcia_used_keys', JSON.stringify(used)); } catch(e){}
  return picked;
}

function startTimer(data, el) {
  if (!el) return;
  function tick() {
    var rem = COOLDOWN_MS - (Date.now() - data.issuedAt);
    if (rem <= 0) {
      el.textContent = '🔓 Key expired — get a new one';
      el.style.color = 'rgba(255,255,255,0.35)';
      try { localStorage.removeItem(STORAGE_KEY); } catch(e){}
      return;
    }
    var h = Math.floor(rem/3600000), m = Math.floor((rem%3600000)/60000), s = Math.floor((rem%60000)/1000);
    el.textContent = '⏳ Key valid for: ' + pad(h) + 'h ' + pad(m) + 'm ' + pad(s) + 's';
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
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;font-size:16px;';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try { document.execCommand('copy'); } catch(e){}
  document.body.removeChild(ta);
  flashCopy(btn);
}
function flashCopy(btn) {
  if (!btn) return;
  btn.textContent = 'Copied!'; btn.classList.add('copied');
  setTimeout(function(){ btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
}

/* ──────────────────────────────────────────
   CLOCK
────────────────────────────────────────── */
function pad(n) { return String(n).padStart(2,'0'); }
function startClock() {
  var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function tick() {
    var now = new Date(), h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
    var ap = h >= 12 ? 'PM' : 'AM'; h = h%12||12;
    var t = days[now.getDay()]+' '+pad(h)+':'+pad(m)+':'+pad(s)+' '+ap;
    document.querySelectorAll('.datetime').forEach(function(el){ el.textContent = t; });
  }
  tick(); setInterval(tick, 1000);
}

/* ──────────────────────────────────────────
   STARS
────────────────────────────────────────── */
function spawnStars() {
  var el = document.getElementById('stars');
  if (!el) return;
  for (var i = 0; i < 120; i++) {
    var s = document.createElement('div'); s.className = 'star';
    var sz = Math.random()*2+0.5;
    s.style.cssText = 'width:'+sz+'px;height:'+sz+'px;top:'+(Math.random()*100)+'%;left:'+(Math.random()*100)+'%;--d:'+(2+Math.random()*5)+'s;--delay:'+(Math.random()*7)+'s;--op:'+(0.2+Math.random()*0.6)+';';
    el.appendChild(s);
  }
}

/* ──────────────────────────────────────────
   BOOT
────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  spawnStars();
  startClock();
  eclInit();
  initCheckpoint(0); // CP1
  initCheckpoint(1); // CP2
  initCheckpoint(2); // CP3
});
