// Tela do teleprompter — a mesma no app (Mac/Windows) e no navegador (tablet/celular).
(() => {
  const native = !!window.tpNative;
  const touch = matchMedia('(pointer: coarse)').matches;
  document.body.classList.add(native ? 'native' : 'web');
  if (touch) document.body.classList.add('touch');
  if (native) document.body.classList.add(window.tpNative.platform === 'darwin' ? 'mac' : 'win');

  const $ = (id) => document.getElementById(id);
  const root = $('prompter'), viewport = $('viewport'), doc = $('doc'), textEl = $('text');
  const marker = $('marker'), controls = $('controls'), countdownEl = $('countdown');
  const playBtn = $('playBtn'), speedLabel = $('speedLabel'), timeLabel = $('timeLabel');
  const progressFill = $('progressFill'), layoutPanel = $('layoutPanel'), hint = $('hint');

  // Ícones
  $('closeBtn').innerHTML = native ? ICONS.close : ICONS.back;
  $('closeBtn').title = native ? 'Fechar (Esc)' : 'Voltar aos roteiros (Esc)';
  $('restartBtn').innerHTML = ICONS.restart;
  $('slowerBtn').innerHTML = ICONS.minus;
  $('fasterBtn').innerHTML = ICONS.plus;
  $('smallerBtn').innerHTML = ICONS.textSmaller;
  $('largerBtn').innerHTML = ICONS.textLarger;
  $('layoutBtn').innerHTML = ICONS.layout;
  $('fullscreenBtn').innerHTML = ICONS.fullscreen;
  $('layoutClose').innerHTML = ICONS.close;
  if (!document.fullscreenEnabled) $('fullscreenBtn').classList.add('hidden');

  const st = {
    text: '', fontSize: 34, duration: 60, multiplier: 1, countdownOn: true,
    playing: false, counting: false, hovering: false,
    scrolled: 0, docH: 0, viewH: 0, pps: 0, last: 0, raf: 0, countTimer: 0,
    position: null, size: null,
  };
  let library = null; // só no navegador

  // ---------- Texto e medidas ----------

  function renderText() {
    textEl.replaceChildren(...TP.normalizeScript(st.text).split('\n').filter(Boolean).map((line) => {
      const p = document.createElement('p'); p.textContent = line; return p;
    }));
    textEl.style.fontSize = st.fontSize + 'px';
  }

  function readingY() { return st.viewH * TP.READING_LINE; }

  function relayout() {
    const keep = progress();
    st.viewH = viewport.clientHeight;
    const ry = readingY();
    doc.style.paddingTop = Math.max(0, ry - st.fontSize * 0.75) + 'px';
    doc.style.paddingBottom = (st.viewH - ry) + 'px';
    st.docH = doc.scrollHeight;
    const mh = st.fontSize * 0.9;
    marker.style.top = (ry - mh / 2) + 'px';
    marker.style.height = mh + 'px';
    // esmaecimento: faixa dos controles limpa, o já lido fraco, o fim some
    const ch = parseFloat(getComputedStyle(root).getPropertyValue('--controls-h')) || 44;
    const r = TP.READING_LINE * 100;
    const mask = `linear-gradient(to bottom, transparent 0, transparent ${ch}px, rgba(0,0,0,.22) max(${ch}px, ${r - 9}%), #000 ${r - 2}%, #000 78%, transparent 100%)`;
    viewport.style.webkitMaskImage = mask;
    viewport.style.maskImage = mask;
    recomputeSpeed();
    st.scrolled = keep * distance();
    draw();
  }

  const distance = () => Math.max(0, st.docH - st.viewH);
  const progress = () => TP.progress(st.scrolled, st.docH, st.viewH);

  function recomputeSpeed() {
    st.pps = TP.pixelsPerSecond(st.docH, st.viewH, st.duration) * st.multiplier;
  }

  function draw() {
    st.scrolled = Math.min(Math.max(0, st.scrolled), distance());
    doc.style.transform = `translate3d(0, ${-st.scrolled}px, 0)`;
    progressFill.style.width = (progress() * 100) + '%';
    timeLabel.textContent = TP.formatTime(TP.remaining(st.scrolled, st.docH, st.viewH, st.pps));
    speedLabel.textContent = st.multiplier.toFixed(1) + '×';
    playBtn.innerHTML = st.playing ? ICONS.pause : ICONS.play;
    root.classList.toggle('show-controls', !st.counting && (!st.playing || st.hovering || !layoutPanel.classList.contains('hidden')));
  }

  // ---------- Reprodução ----------

  function tick(now) {
    const dt = Math.min(0.1, (now - st.last) / 1000);
    st.last = now;
    st.scrolled += st.pps * dt;
    if (st.scrolled >= distance()) { st.scrolled = distance(); pause(); return; }
    draw();
    st.raf = requestAnimationFrame(tick);
  }

  function play() {
    st.playing = true;
    st.last = performance.now();
    cancelAnimationFrame(st.raf);
    st.raf = requestAnimationFrame(tick);
    keepAwake(true);
    draw();
  }

  function pause() {
    st.playing = false;
    cancelAnimationFrame(st.raf);
    keepAwake(false);
    draw();
  }

  function togglePlay() {
    if (st.counting) { stopCountdown(); return; }
    if (st.playing) { pause(); return; }
    hideLayout();
    if (progress() >= 1) st.scrolled = 0;
    if (progress() <= 0.001 && st.countdownOn) startCountdown(); else play();
  }

  function startCountdown(n = 3) {
    st.counting = true;
    root.classList.add('counting');
    countdownEl.classList.remove('hidden');
    countdownEl.textContent = n;
    draw();
    clearInterval(st.countTimer);
    st.countTimer = setInterval(() => {
      n -= 1;
      if (n > 0) countdownEl.textContent = n;
      else { stopCountdown(); play(); }
    }, 1000);
  }

  function stopCountdown() {
    clearInterval(st.countTimer);
    st.counting = false;
    root.classList.remove('counting');
    countdownEl.classList.add('hidden');
    draw();
  }

  function restart() { stopCountdown(); pause(); st.scrolled = 0; draw(); }

  function changeSpeed(f) { st.multiplier = TP.clampMultiplier(st.multiplier * f); recomputeSpeed(); draw(); }

  function changeFont(delta) {
    st.fontSize = TP.clampFontSize(st.fontSize + delta);
    renderText();
    relayout();
    if (native) window.tpNative.fontChanged(st.fontSize);
    else if (library) { library.settings.fontSize = st.fontSize; Storage2.save(library); }
  }

  function close() {
    stopCountdown(); pause(); hideLayout();
    if (native) window.tpNative.closePrompter();
    else location.href = 'index.html';
  }

  // Mantém a tela do tablet/celular acesa enquanto rola
  let wakeLock = null;
  async function keepAwake(on) {
    if (native || !('wakeLock' in navigator)) return;
    try {
      if (on && !wakeLock) wakeLock = await navigator.wakeLock.request('screen');
      if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch { wakeLock = null; }
  }

  function showHint(text) {
    hint.textContent = text;
    hint.classList.remove('hidden');
    clearTimeout(showHint.t);
    showHint.t = setTimeout(() => hint.classList.add('hidden'), 1400);
  }

  // ---------- Posição e tamanho (app) ----------

  async function openLayout() {
    if (!native) return;
    const displays = await window.tpNative.getDisplays();
    const pills = $('screenPills');
    pills.replaceChildren();
    $('screensTitle').classList.toggle('hidden', displays.length < 2);
    if (displays.length > 1) {
      for (const d of displays) {
        const b = document.createElement('button');
        b.textContent = d.label;
        b.classList.toggle('active', d.current);
        b.onclick = () => { setLayout({ displayId: d.id }); showHint('Movido para ' + d.label); };
        pills.append(b);
      }
    }
    markLayout();
    layoutPanel.classList.remove('hidden');
    draw();
  }
  function hideLayout() { layoutPanel.classList.add('hidden'); draw(); }
  function markLayout() {
    document.querySelectorAll('#screenMap button').forEach((b) => b.classList.toggle('active', b.dataset.pos === st.position));
    document.querySelectorAll('#sizePills button').forEach((b) => b.classList.toggle('active', b.dataset.size === st.size));
  }
  function setLayout(opts) {
    if (!native) return;
    if (opts.position) st.position = opts.position;
    if (opts.size) st.size = opts.size;
    window.tpNative.setLayout(opts);
    markLayout();
  }
  document.querySelectorAll('#screenMap button').forEach((b) =>
    b.addEventListener('click', () => { setLayout({ position: b.dataset.pos }); showHint(TP.POSITIONS[b.dataset.pos]); }));
  document.querySelectorAll('#sizePills button').forEach((b) =>
    b.addEventListener('click', () => { setLayout({ size: b.dataset.size }); showHint('Tamanho: ' + TP.SIZES[b.dataset.size]); }));

  // Alça de redimensionar: arrastar o canto
  const grip = $('grip');
  grip.addEventListener('pointerdown', async (e) => {
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    const start = { x: e.screenX, y: e.screenY, w: window.outerWidth, h: window.outerHeight };
    let pending = false;
    const move = (ev) => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        window.tpNative.resizePrompter(start.w + (ev.screenX - start.x), start.h + (ev.screenY - start.y));
      });
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      st.position = null; st.size = null; markLayout();
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
  });

  // ---------- Entrada: mouse, toque, teclado ----------

  $('closeBtn').onclick = close;
  $('restartBtn').onclick = restart;
  playBtn.onclick = togglePlay;
  $('slowerBtn').onclick = () => changeSpeed(1 / 1.1);
  $('fasterBtn').onclick = () => changeSpeed(1.1);
  $('smallerBtn').onclick = () => changeFont(-2);
  $('largerBtn').onclick = () => changeFont(2);
  $('layoutBtn').onclick = () => (layoutPanel.classList.contains('hidden') ? openLayout() : hideLayout());
  $('layoutClose').onclick = hideLayout;
  $('fullscreenBtn').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}));

  root.addEventListener('mouseenter', () => { st.hovering = true; draw(); });
  root.addEventListener('mouseleave', () => { st.hovering = false; draw(); });

  // Roda do mouse / trackpad: ajusta a posição na mão
  viewport.addEventListener('wheel', (e) => { e.preventDefault(); st.scrolled += e.deltaY; draw(); }, { passive: false });

  // Toque (navegador): tocar = começar/pausar; arrastar = rolar na mão
  if (!native) {
    let startY = 0, startScroll = 0, moved = false, id = null;
    viewport.addEventListener('pointerdown', (e) => {
      id = e.pointerId; startY = e.clientY; startScroll = st.scrolled; moved = false;
    });
    viewport.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const dy = e.clientY - startY;
      if (Math.abs(dy) > 8) moved = true;
      if (moved) { st.scrolled = startScroll - dy; draw(); }
    });
    viewport.addEventListener('pointerup', (e) => {
      if (e.pointerId !== id) return;
      id = null;
      if (!moved) togglePlay();
    });
  }

  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod) {
      const sizes = { '1': 'small', '2': 'medium', '3': 'large', '4': 'fullWidth' };
      const positions = { ArrowUp: 'topCenter', ArrowDown: 'bottomCenter', ArrowLeft: 'topLeft', ArrowRight: 'topRight', '0': 'center' };
      if (e.key === '=' || e.key === '+') { e.preventDefault(); changeFont(2); }
      else if (e.key === '-') { e.preventDefault(); changeFont(-2); }
      else if (native && sizes[e.key]) { e.preventDefault(); setLayout({ size: sizes[e.key] }); showHint('Tamanho: ' + TP.SIZES[sizes[e.key]]); }
      else if (native && positions[e.key]) { e.preventDefault(); setLayout({ position: positions[e.key] }); showHint(TP.POSITIONS[positions[e.key]]); }
      else if (e.key === 'w') { e.preventDefault(); close(); }
      return;
    }
    switch (e.key) {
      case ' ': e.preventDefault(); togglePlay(); break;
      case 'ArrowUp': e.preventDefault(); changeSpeed(1.1); break;
      case 'ArrowDown': e.preventDefault(); changeSpeed(1 / 1.1); break;
      case 'r': case 'R': restart(); break;
      case 'Escape': if (!layoutPanel.classList.contains('hidden')) hideLayout(); else close(); break;
    }
  });

  new ResizeObserver(() => relayout()).observe(viewport);

  // ---------- Configuração (roteiro + preferências) ----------

  function configure({ script, settings, layout, debug }) {
    st.text = script.body;
    st.fontSize = TP.clampFontSize(settings.fontSize);
    st.countdownOn = settings.countdown !== false;
    st.duration = TP.effectiveDuration(settings, script);
    if (native) root.style.setProperty('--bg-alpha', Math.min(1, Math.max(0.4, settings.backgroundOpacity)));
    if (layout) { st.position = layout.position; st.size = layout.size; }
    renderText();
    relayout();
    if (debug) {
      if (debug.seek != null) { st.scrolled = debug.seek * distance(); draw(); }
      if (debug.countdown) startCountdown();
      if (debug.layout) openLayout();
    }
    window.__tpReady = true;
  }

  if (native) {
    window.tpNative.onConfigure(configure);
    window.tpNative.onLayoutState((l) => { st.position = l.position; st.size = l.size; markLayout(); });
    window.tpNative.onPauseRequest(() => { stopCountdown(); pause(); });
  } else {
    Storage2.load().then((lib) => {
      library = lib;
      const params = new URLSearchParams(location.search);
      const script = lib.scripts.find((s) => s.id === params.get('id')) || TP.selected(lib);
      const debug = params.has('seek') ? { seek: Number(params.get('seek')) } : null;
      configure({ script, settings: lib.settings, debug });
    });
  }

  // para testes automáticos
  window.__tp = { st, togglePlay, changeSpeed, changeFont, restart, progress, distance, relayout };
})();
