/* ══════════════════════════════════════════
   GARCIA'S SCRIPT – main.js
   Single-page checkpoint system.
   Opens Lootlabs in SAME tab, restores
   state on return via sessionStorage.
══════════════════════════════════════════ */

/* ──────────────────────────────────────────
   CONFIG — set your links & GitHub Pages URL
────────────────────────────────────────── */
var CP_LINKS = {
  1: 'https://lootlabs.gg/YOUR_CP1_LINK_HERE',
  2: 'https://lootlabs.gg/YOUR_CP2_LINK_HERE',
  3: 'https://lootlabs.gg/YOUR_CP3_LINK_HERE',
};
var KEY_SOURCE  = 'https://raw.githubusercontent.com/kielsvu/Utility/refs/heads/Lua/Utility/Major/Main.txt';
var COOLDOWN_MS = 20 * 60 * 60 * 1000;

/* ──────────────────────────────────────────
   SESSION STATE — persists across reload
   sessionStorage keys:
     garcia_view      : current view (1-4)
     garcia_cp1_done  : '1' if completed
     garcia_cp2_done  : '1' if completed
     garcia_cp3_done  : '1' if completed
     garcia_cp1_left  : '1' if user left for link
     garcia_cp2_left  : '1' if user left for link
     garcia_cp3_left  : '1' if user left for link
────────────────────────────────────────── */
function saveView(n) { try { sessionStorage.setItem('garcia_view', String(n)); } catch(e){} }
function getView()   { try { return parseInt(sessionStorage.getItem('garcia_view') || '1', 10); } catch(e){ return 1; } }
function markDone(n) { try { sessionStorage.setItem('garcia_cp'+n+'_done', '1'); } catch(e){} }
function isDone(n)   { try { return !!sessionStorage.getItem('garcia_cp'+n+'_done'); } catch(e){ return false; } }
function markLeft(n) { try { sessionStorage.setItem('garcia_cp'+n+'_left', '1'); } catch(e){} }
function hasLeft(n)  { try { return !!sessionStorage.getItem('garcia_cp'+n+'_left'); } catch(e){ return false; } }

/* ──────────────────────────────────────────
   VIEW SYSTEM
────────────────────────────────────────── */
var currentView = 1;

function showView(n, animate) {
  document.getElementById('view' + currentView).classList.remove('active');
  currentView = n;
  saveView(n);
  var next = document.getElementById('view' + n);
  next.classList.add('active');
  if (animate !== false) {
    var card = next.querySelector('.card');
    if (card) {
      card.classList.remove('animIn');
      void card.offsetWidth;
      card.classList.add('animIn');
    }
  }
  if (n === 4) loadKey();
}

function goToView(n) {
  if (n === currentView || eclAnimating) return;
  eclAnimating = true;
  document.body.classList.add('exiting');
  eclExpand(function() {
    showView(n, true);
    document.body.classList.remove('exiting');
    eclAnimating = false;
    eclShrink(null);
  });
}

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

function eclEase(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }

function eclDrawFull() {
  eclCtx.clearRect(0,0,eW,eH);
  eclCtx.fillStyle = 'rgb(5,5,5)';
  eclCtx.beginPath();
  eclCtx.arc(eW/2, eH/2, eclMaxR, 0, Math.PI*2);
  eclCtx.fill();
}

function eclDrawCircle(r) {
  eclCtx.clearRect(0,0,eW,eH);
  if (r <= 0) return;
  if (r > 4) {
    var grd = eclCtx.createRadialGradient(eW/2,eH/2,Math.max(0,r-22),eW/2,eH/2,r+10);
    grd.addColorStop(0,    'rgba(178,132,255,0.00)');
    grd.addColorStop(0.45, 'rgba(178,132,255,0.65)');
    grd.addColorStop(1,    'rgba(178,132,255,0.00)');
    eclCtx.fillStyle = grd;
    eclCtx.beginPath();
    eclCtx.arc(eW/2,eH/2,r+10,0,Math.PI*2);
    eclCtx.fill();
  }
  eclCtx.fillStyle = 'rgb(5,5,5)';
  eclCtx.beginPath();
  eclCtx.arc(eW/2,eH/2,r,0,Math.PI*2);
  eclCtx.fill();
}

function eclExpand(cb) {
  var start = null, FRAME = 1000/60;
  eclCanvas.style.pointerEvents = 'all';
  function step() {
    var now = Date.now();
    if (!start) start = now;
    var t = Math.min((now-start)/EXPAND_MS,1);
    eclDrawCircle(eclEase(t)*eclMaxR);
    if (t < 1) { setTimeout(step,FRAME); }
    else { eclDrawFull(); setTimeout(cb,HOLD_MS); }
  }
  step();
}

function eclShrink(cb) {
  var start = performance.now();
  function step(now) {
    var t = Math.min((now-start)/SHRINK_MS,1);
    eclDrawCircle((1-eclEase(t))*eclMaxR);
    if (t < 1) { requestAnimationFrame(step); }
    else {
      eclCtx.clearRect(0,0,eW,eH);
      eclCanvas.style.pointerEvents = 'none';
      if (cb) cb();
    }
  }
  requestAnimationFrame(step);
}

/* ──────────────────────────────────────────
   CHECKPOINT SYSTEM
   - Opens link in SAME tab (no new tab)
   - Lootlabs redirects back to this page
   - sessionStorage restores state on reload
────────────────────────────────────────── */
function initCheckpoint(cpIndex) {
  var cpNum    = cpIndex + 1;
  var visitBtn = document.getElementById('visitBtn' + cpNum);
  var contBtn  = document.getElementById('continueBtn' + cpNum);
  var pulseEl  = document.getElementById('pulse' + cpNum);
  var labelEl  = document.getElementById('label' + cpNum);
  var statusEl = document.getElementById('status' + cpNum);
  if (!visitBtn) return;

  visitBtn.href = CP_LINKS[cpNum] || '#';

  // ── Already completed this checkpoint ──
  if (isDone(cpNum)) {
    doUnlock(true);
    return;
  }

  // ── Returned from Lootlabs (page reloaded after redirect) ──
  if (hasLeft(cpNum)) {
    // They went to Lootlabs and came back — unlock immediately
    doUnlock(false);
    return;
  }

  // ── Visit button — opens in SAME tab ──
  visitBtn.addEventListener('click', function(e) {
    e.preventDefault();
    markLeft(cpNum); // save that they left BEFORE navigating away
    window.location.href = CP_LINKS[cpNum];
  });

  function doUnlock(instant) {
    if (isDone(cpNum) && instant) {
      // Already done, just restore UI
    }
    markDone(cpNum);

    statusEl.textContent = '✓ Link completed — you may continue!';
    statusEl.classList.add('unlocked');
    visitBtn.style.opacity = '0.35';
    visitBtn.style.pointerEvents = 'none';
    contBtn.classList.remove('locked');
    contBtn.disabled = false;
    pulseEl.style.display = 'block';
    labelEl.innerHTML = 'Continue <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:var(--border);fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

    contBtn.addEventListener('click', function() {
      this.classList.add('verified');
      labelEl.innerHTML = '✓ &nbsp;Verified';
      setTimeout(function() { goToView(cpNum + 1); }, 500);
    });
  }
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
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch(e){}

  if (saved && saved.issuedAt && (Date.now()-saved.issuedAt) < COOLDOWN_MS) {
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
  var res;
  for (var i = 1; i <= 3; i++) {
    try {
      res = await fetch(url, { method:'GET', cache:'no-store' });
      if (res.ok) break;
    } catch(e) {
      if (i < 3) await new Promise(function(r){ setTimeout(r, 700*i); });
    }
  }
  if (!res || !res.ok) throw new Error('Fetch failed');
  var text = await res.text();
  var keys = text.split('\n').map(function(k){ return k.trim(); }).filter(function(k){ return k.length>0; });
  if (!keys.length) throw new Error('Empty');
  return keys;
}

function pickKey(all) {
  var used = [];
  try { used = JSON.parse(localStorage.getItem('garcia_used_keys')||'[]'); } catch(e){}
  var avail = all.filter(function(k){ return used.indexOf(k)===-1; });
  if (!avail.length) { avail=all; used=[]; try{localStorage.removeItem('garcia_used_keys');}catch(e){} }
  var picked = avail[Math.floor(Math.random()*avail.length)];
  used.push(picked);
  try { localStorage.setItem('garcia_used_keys', JSON.stringify(used)); } catch(e){}
  return picked;
}

function startTimer(data, el) {
  if (!el) return;
  function tick() {
    var rem = COOLDOWN_MS - (Date.now()-data.issuedAt);
    if (rem <= 0) {
      el.textContent = '🔓 Key expired — refresh for a new one';
      el.style.color = 'rgba(255,255,255,0.35)';
      try{localStorage.removeItem(STORAGE_KEY);}catch(e){}
      return;
    }
    var h=Math.floor(rem/3600000), m=Math.floor((rem%3600000)/60000), s=Math.floor((rem%60000)/1000);
    el.textContent = '⏳ Key valid for: '+pad(h)+'h '+pad(m)+'m '+pad(s)+'s';
    setTimeout(tick,1000);
  }
  tick();
}

function copyKey() {
  var key = document.getElementById('keyValue').textContent;
  if (!key || key==='Loading...' || key==='Error loading') return;
  var btn = document.getElementById('copyBtn');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(key).then(function(){flashCopy(btn);}).catch(function(){fallbackCopy(key,btn);});
  } else { fallbackCopy(key,btn); }
}
function fallbackCopy(text,btn) {
  var ta=document.createElement('textarea'); ta.value=text;
  ta.style.cssText='position:fixed;top:-9999px;left:-9999px;opacity:0;font-size:16px;';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try{document.execCommand('copy');}catch(e){}
  document.body.removeChild(ta); flashCopy(btn);
}
function flashCopy(btn) {
  if(!btn)return;
  btn.textContent='Copied!'; btn.classList.add('copied');
  setTimeout(function(){btn.textContent='Copy';btn.classList.remove('copied');},2000);
}

/* ──────────────────────────────────────────
   CLOCK & STARS
────────────────────────────────────────── */
function pad(n){ return String(n).padStart(2,'0'); }

function startClock() {
  var days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function tick() {
    var now=new Date(), h=now.getHours(), m=now.getMinutes(), s=now.getSeconds();
    var ap=h>=12?'PM':'AM'; h=h%12||12;
    var t=days[now.getDay()]+' '+pad(h)+':'+pad(m)+':'+pad(s)+' '+ap;
    document.querySelectorAll('.datetime').forEach(function(el){el.textContent=t;});
  }
  tick(); setInterval(tick,1000);
}

function spawnStars() {
  var el=document.getElementById('stars');
  if(!el)return;
  for(var i=0;i<120;i++){
    var s=document.createElement('div'); s.className='star';
    var sz=Math.random()*2+0.5;
    s.style.cssText='width:'+sz+'px;height:'+sz+'px;top:'+(Math.random()*100)+'%;left:'+(Math.random()*100)+'%;--d:'+(2+Math.random()*5)+'s;--delay:'+(Math.random()*7)+'s;--op:'+(0.2+Math.random()*0.6)+';';
    el.appendChild(s);
  }
}

/* ──────────────────────────────────────────
   BOOT — restore state on page load
────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  spawnStars();
  startClock();
  eclInit();

  // Restore which view we were on
  var savedView = getView();

  // Make sure all previous checkpoints are marked done
  // before jumping to the saved view
  if (savedView > 1) {
    for (var i = 1; i < savedView; i++) markDone(i);
  }

  // Jump straight to saved view without animation on reload
  if (savedView !== 1) {
    document.getElementById('view1').classList.remove('active');
    currentView = savedView;
    document.getElementById('view' + savedView).classList.add('active');
    if (savedView === 4) loadKey();
  }

  // Init all checkpoints (they each check their own state)
  initCheckpoint(0);
  initCheckpoint(1);
  initCheckpoint(2);
});
