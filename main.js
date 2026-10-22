/* ============================================================
   爻光 / YAO GUANG — 角色档案
   普通脚本（非 module）：file:// 下也能直接双击打开
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 0. 时钟 ---------- */
  var clock = $('#hudClock');
  if (clock) {
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    var tickClock = function () {
      var d = new Date();
      clock.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    };
    tickClock();
    setInterval(tickClock, 1000);
  }

  /* ---------- 1. 逐字拆行（只给纯色标题用） ---------- */
  function splitChars() {
    $$('[data-split]').forEach(function (el) {
      var text = el.textContent;
      if (!text || el.dataset.done) return;
      el.dataset.done = '1';
      el.setAttribute('aria-label', text);
      el.textContent = '';
      var i = 0;
      Array.from(text).forEach(function (ch) {
        if (ch === ' ') {
          el.appendChild(document.createTextNode(' '));
          return;
        }
        var wrap = document.createElement('span');
        wrap.className = 'ch';
        wrap.setAttribute('aria-hidden', 'true');
        var inner = document.createElement('i');
        inner.textContent = ch;
        inner.style.setProperty('--d', (i * 45) + 'ms');
        wrap.appendChild(inner);
        el.appendChild(wrap);
        i++;
      });
      el.classList.add('split');
    });
  }

  /* ---------- 2. 进场观察 ---------- */
  var io = null;
  function observeReveals() {
    var targets = $$('.reveal, [data-wipe], .split, .hero__art-inner');
    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    /* 被 clip-path 裁成 0 面积的元素自己永远不会「相交」，
       所以改看它未被裁剪的父级，命中后再给本体加状态 */
    var owner = new Map();
    var watch = function (el) {
      var clipped = el.hasAttribute('data-wipe') || el.classList.contains('hero__art-inner');
      var node = clipped && el.parentElement ? el.parentElement : el;
      if (!owner.has(node)) owner.set(node, []);
      owner.get(node).push(el);
    };
    targets.forEach(watch);

    io = new IntersectionObserver(function (items) {
      items.forEach(function (it) {
        if (!it.isIntersecting) return;
        (owner.get(it.target) || []).forEach(function (el) { el.classList.add('is-in'); });
        io.unobserve(it.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    owner.forEach(function (list, node) { io.observe(node); });
  }

  /* ---------- 3. 首屏视差 ---------- */
  function parallax() {
    var layers = $$('[data-depth]');
    if (!layers.length || reduce) return;
    var y = 0, target = 0, raf = 0, running = false;
    var frame = function () {
      y += (target - y) * 0.12;
      layers.forEach(function (el) {
        var d = parseFloat(el.dataset.depth) || 0;
        el.style.transform = 'translate3d(0,' + (-y * d).toFixed(2) + 'px,0)';
      });
      if (Math.abs(target - y) < 0.4) { running = false; return; }
      raf = requestAnimationFrame(frame);
    };
    var onScroll = function () {
      target = window.pageYOffset || document.documentElement.scrollTop;
      if (!running) { running = true; raf = requestAnimationFrame(frame); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 4. 首屏扫描成像：抖动图 → 真正的立绘 ---------- */
  function heroScan(onEnd) {
    var wrap = $('.hero__art-inner');
    if (!wrap || !window.SCAN_SRC || reduce) { if (onEnd) onEnd(); return; }

    var img = new Image();
    img.onload = function () {
      var SW = img.naturalWidth, SH = img.naturalHeight;
      var CELL = 4;
      var cols = Math.floor(SW / CELL), rows = Math.floor(SH / CELL);

      var src = document.createElement('canvas');
      src.width = SW; src.height = SH;
      var sctx = src.getContext('2d');
      sctx.drawImage(img, 0, 0);

      var data;
      try { data = sctx.getImageData(0, 0, SW, SH).data; }
      catch (e) { if (onEnd) onEnd(); return; }

      /* 位移把抖动结果画到离屏画布，之后只做「逐行揭开」，不逐帧重算 */
      var off = document.createElement('canvas');
      off.width = SW; off.height = SH;
      var octx = off.getContext('2d');
      var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      var buckets = { gold: [], paper: [], jade: [], dim: [] };

      for (var cy = 0; cy < rows; cy++) {
        for (var cx = 0; cx < cols; cx++) {
          var sum = 0, n = 0;
          for (var py = 0; py < CELL; py++) {
            for (var px = 0; px < CELL; px++) {
              var x = cx * CELL + px, y = cy * CELL + py;
              var i = (y * SW + x) * 4;
              sum += (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 255;
              n++;
            }
          }
          var lum = sum / n;
          var t = (BAYER[(cy % 4) * 4 + (cx % 4)] + 0.5) / 16;
          if (lum < t * 0.92) continue;
          var key = lum > 0.74 ? 'gold' : lum > 0.5 ? 'paper' : lum > 0.26 ? 'jade' : 'dim';
          buckets[key].push(cx * CELL, cy * CELL);
        }
      }

      var COLORS = { gold: 'rgba(87,227,216,.95)', paper: 'rgba(228,238,242,.82)', jade: 'rgba(111,178,255,.78)', dim: 'rgba(80,120,190,.32)' };
      Object.keys(buckets).forEach(function (k) {
        octx.fillStyle = COLORS[k];
        var arr = buckets[k];
        for (var j = 0; j < arr.length; j += 2) octx.fillRect(arr[j], arr[j + 1], CELL - 1, CELL - 1);
      });

      var cv = document.createElement('canvas');
      cv.width = SW; cv.height = SH;
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none;image-rendering:pixelated;opacity:1;transition:opacity .9s ease';
      cv.setAttribute('aria-hidden', 'true');
      wrap.appendChild(cv);
      var ctx = cv.getContext('2d');

      var start = performance.now(), DUR = 1500;
      var draw = function (now) {
        var p = Math.min(1, (now - start) / DUR);
        var ease = 1 - Math.pow(1 - p, 3);
        var h = Math.round(SH * ease);
        ctx.clearRect(0, 0, SW, SH);
        if (h > 0) ctx.drawImage(off, 0, 0, SW, h, 0, 0, SW, h);
        /* 扫描线：亮带 + 细线 */
        if (h < SH) {
          var g = ctx.createLinearGradient(0, h - 18, 0, h + 2);
          g.addColorStop(0, 'rgba(87,227,216,0)');
          g.addColorStop(0.85, 'rgba(87,227,216,.55)');
          g.addColorStop(1, 'rgba(255,255,255,.9)');
          ctx.fillStyle = g;
          ctx.fillRect(0, h - 18, SW, 20);
        }
        if (p < 1) {
          requestAnimationFrame(draw);
        } else {
          cv.style.opacity = '0';
          setTimeout(function () { cv.remove(); }, 1000);
          if (onEnd) onEnd();
        }
      };
      requestAnimationFrame(draw);
    };
    img.onerror = function () { if (onEnd) onEnd(); };
    img.src = window.SCAN_SRC;
  }

  /* ---------- 5. 开屏 ---------- */
  function boot() {
    return new Promise(function (resolve) {
      var el = $('#boot'), bar = $('#bootBar'), pct = $('#bootPct'), guaBox = $('#bootGua');
      if (!el) { resolve(); return; }

      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        if (bar) bar.style.width = '100%';
        if (pct) pct.textContent = '100%';
        if (guaBox) $$('i', guaBox).forEach(function (i) { i.classList.add('on'); });
        el.classList.add('is-done');
        document.body.classList.add('is-ready');
        setTimeout(function () {
          el.style.display = 'none';
          resolve();
        }, reduce ? 60 : 900);
      };

      if (reduce) { finish(); return; }

      if (guaBox) {
        for (var k = 0; k < 6; k++) {
          var line = document.createElement('i');
          if (k === 1 || k === 4) line.className = 'yin';
          guaBox.appendChild(line);
        }
      }

      var t0 = performance.now();
      var p = 0;
      var step = function (now) {
        var dt = now - t0;
        var target = 100 * (1 - Math.pow(1 - Math.min(dt / 2000, 1), 2.4));
        p += (target - p) * 0.14 + Math.random() * 0.22;
        p = Math.min(p, 99.4);
        if (bar) bar.style.width = p.toFixed(1) + '%';
        if (pct) pct.textContent = Math.floor(p) + '%';
        if (guaBox) {
          var lit = Math.floor((p / 100) * 6);
          var lines = $$('i', guaBox);
          for (var j = 0; j < lines.length; j++) lines[j].classList.toggle('on', j < lit);
        }
        if (dt > 2100 && p > 97) { finish(); return; }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /* ---------- 6. 右侧章节导航 ---------- */
  function rail() {
    var links = $$('.rail a');
    if (!links.length) return;
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var secs = $$('section[id]');
    if (!('IntersectionObserver' in window)) return;
    var nav = new IntersectionObserver(function (items) {
      items.forEach(function (it) {
        var a = map[it.target.id];
        if (!a) return;
        if (it.isIntersecting) {
          links.forEach(function (l) { l.classList.remove('is-on'); });
          a.classList.add('is-on');
        }
      });
    }, { threshold: 0, rootMargin: '-45% 0px -45% 0px' });
    secs.forEach(function (s) { nav.observe(s); });
  }

  /* ---------- 7. 灯箱 ---------- */
  function lightbox() {
    var box = $('#lightbox'), img = $('#lbImg'), cap = $('#lbCap');
    if (!box || !img) return;
    var lastFocus = null;

    var open = function (src, text, alt) {
      lastFocus = document.activeElement;
      img.src = src;
      img.alt = alt || text || '';
      if (cap) cap.textContent = text || '';
      box.hidden = false;
      document.body.classList.add('is-locked');
      requestAnimationFrame(function () { box.classList.add('is-on'); });
      var btn = $('#lbClose');
      if (btn) btn.focus();
    };
    var close = function () {
      box.classList.remove('is-on');
      document.body.classList.remove('is-locked');
      setTimeout(function () {
        box.hidden = true;
        img.removeAttribute('src');
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }, reduce ? 0 : 380);
    };

    $$('.gal__item').forEach(function (b) {
      b.addEventListener('click', function () {
        var pic = $('img', b);
        open(b.dataset.src || (pic && pic.src), b.dataset.cap, pic && pic.alt);
      });
    });

    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.id === 'lbClose') close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !box.hidden) close();
    });
  }


/* ---------- 背景音乐 ---------- */
function bgm() {
  var audio = document.getElementById('bgm');
  var btn = document.getElementById('bgmBtn');
  if (!audio || !btn) return;
  var ico = btn.querySelector('.bgm__ico');
  var wanted = false;

  function paint(on) {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (ico) ico.textContent = on ? '❚❚' : '▶';
  }

  function play() {
    var p = audio.play();
    if (p && p.catch) p.catch(function () { paint(false); wanted = false; });
  }

  btn.addEventListener('click', function () {
    if (!audio.paused) {
      wanted = false;
      audio.pause();
      paint(false);
      return;
    }
    wanted = true;
    play();
  });

  audio.addEventListener('play', function () { paint(true); });
  audio.addEventListener('pause', function () { if (!wanted) paint(false); });
  audio.addEventListener('error', function () { paint(false); });

  // 首次交互（点击/滚动/触摸）尝试起播；被浏览器拦下就保持待命，等用户点按钮
  var armed = true;
  function arm() {
    if (!armed) return;
    armed = false;
    ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(function (t) {
      window.removeEventListener(t, arm, { passive: true });
    });
    wanted = true;
    play();
  }
  ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(function (t) {
    window.addEventListener(t, arm, { passive: true });
  });
}
  /* ---------- 启动 ---------- */
  splitChars();
  lightbox();
  bgm();
  rail();
  parallax();

  boot().then(function () {
    observeReveals();
    heroScan();
  });
})();
