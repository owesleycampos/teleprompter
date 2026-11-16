// Editor de roteiros — o mesmo no app (Mac/Windows) e no navegador.
(() => {
  const native = !!window.tpNative;
  const touch = matchMedia('(pointer: coarse)').matches;
  document.body.classList.add(native ? 'native' : 'web');
  if (touch) document.body.classList.add('touch');
  if (native) document.body.classList.add(window.tpNative.platform === 'darwin' ? 'mac' : 'win');

  const $ = (id) => document.getElementById(id);
  const list = $('list'), listSelect = $('listSelect'), titleEl = $('title'), bodyEl = $('body');
  const stats = $('stats'), durationEl = $('duration'), fontEl = $('font'), fontVal = $('fontVal');
  const opacityEl = $('opacity'), countdownEl = $('countdown');
  $('newBtn').innerHTML = ICONS.plus;
  $('deleteBtn').innerHTML = ICONS.trash;

  let lib = null;
  let saveTimer = 0;

  const current = () => TP.selected(lib);

  function subtitle(s) {
    const w = TP.wordCount(s.body);
    return `${w} ${w === 1 ? 'palavra' : 'palavras'} · ${TP.formatTime(TP.estimatedDuration(w))}`;
  }

  function renderList() {
    const items = TP.sortedScripts(lib);
    list.replaceChildren(...items.map((s) => {
      const li = document.createElement('li');
      li.dataset.id = s.id;
      li.classList.toggle('active', s.id === lib.selectedID);
      const t = document.createElement('div'); t.className = 't'; t.textContent = TP.displayTitle(s);
      const sub = document.createElement('div'); sub.className = 's'; sub.textContent = subtitle(s);
      li.append(t, sub);
      li.onclick = () => select(s.id);
      return li;
    }));
    listSelect.replaceChildren(...items.map((s) => {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = TP.displayTitle(s); o.selected = s.id === lib.selectedID;
      return o;
    }));
  }

  function refreshCurrentRow() {
    const s = current();
    const li = list.querySelector(`li[data-id="${CSS.escape(s.id)}"]`);
    if (li) { li.querySelector('.t').textContent = TP.displayTitle(s); li.querySelector('.s').textContent = subtitle(s); }
    const opt = listSelect.querySelector(`option[value="${CSS.escape(s.id)}"]`);
    if (opt) opt.textContent = TP.displayTitle(s);
  }

  function loadCurrent() {
    const s = current();
    titleEl.value = s.title;
    bodyEl.value = s.body;
    updateStats();
  }

  function updateStats() {
    const s = current();
    const w = TP.wordCount(s.body);
    let text = `${w} ${w === 1 ? 'palavra' : 'palavras'}  ·  leitura natural ≈ ${TP.formatTime(TP.estimatedDuration(w))}`;
    if (lib.settings.durationSeconds) text += `  ·  no teleprompter: ${TP.formatTime(lib.settings.durationSeconds)}`;
    stats.textContent = text;
  }

  function loadSettings() {
    const st = lib.settings;
    fontEl.value = st.fontSize;
    fontVal.textContent = Math.round(st.fontSize);
    opacityEl.value = st.backgroundOpacity;
    countdownEl.checked = st.countdown !== false;
    durationEl.value = st.durationSeconds ? TP.formatTime(st.durationSeconds) : '';
    durationEl.classList.remove('invalid');
  }

  function payload() { return { script: current(), settings: lib.settings }; }

  /** Salva logo depois que você para de digitar, e atualiza o teleprompter se estiver aberto. */
  function scheduleSave(live = false) {
    if (live && native) window.tpNative.updatePrompter(payload());
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 500);
  }
  function saveNow() {
    clearTimeout(saveTimer);
    Storage2.save(lib);
    if (native) window.tpNative.updatePrompter(payload());
  }

  function select(id) {
    if (id === lib.selectedID) return;
    lib.selectedID = id;
    renderList();
    loadCurrent();
    scheduleSave();
  }

  function newScript() {
    TP.addScript(lib);
    renderList();
    loadCurrent();
    titleEl.focus();
    scheduleSave();
  }

  function deleteScript() {
    const s = current();
    if (!confirm(`Apagar “${TP.displayTitle(s)}”?\n\nEsse roteiro será apagado de vez. Não dá para desfazer.`)) return;
    TP.deleteScript(lib, s.id);
    renderList();
    loadCurrent();
    saveNow();
  }

  function commitDuration() {
    const raw = durationEl.value.trim();
    if (!raw) { lib.settings.durationSeconds = null; }
    else {
      const d = TP.parseDuration(raw);
      if (d == null) { durationEl.classList.add('invalid'); return false; }
      lib.settings.durationSeconds = d;
    }
    loadSettings();
    updateStats();
    scheduleSave(true);
    return true;
  }

  function openPrompter() {
    commitDuration();
    saveNow();
    if (native) window.tpNative.openPrompter(payload());
    else location.href = 'prompter.html?id=' + encodeURIComponent(lib.selectedID);
  }

  // ---------- Eventos ----------
  bodyEl.addEventListener('input', () => { TP.updateScript(lib, lib.selectedID, { body: bodyEl.value }); updateStats(); refreshCurrentRow(); scheduleSave(); });
  titleEl.addEventListener('input', () => { TP.updateScript(lib, lib.selectedID, { title: titleEl.value }); refreshCurrentRow(); scheduleSave(); });
  titleEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); bodyEl.focus(); } });
  listSelect.addEventListener('change', () => select(listSelect.value));
  $('newBtn').onclick = newScript;
  $('deleteBtn').onclick = deleteScript;
  $('openBtn').onclick = openPrompter;
  durationEl.addEventListener('change', commitDuration);
  durationEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commitDuration(); durationEl.blur(); } });
  durationEl.addEventListener('input', () => durationEl.classList.remove('invalid'));
  fontEl.addEventListener('input', () => { lib.settings.fontSize = Number(fontEl.value); fontVal.textContent = fontEl.value; scheduleSave(true); });
  opacityEl.addEventListener('input', () => { lib.settings.backgroundOpacity = Number(opacityEl.value); scheduleSave(true); });
  countdownEl.addEventListener('change', () => { lib.settings.countdown = countdownEl.checked; scheduleSave(true); });

  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'Enter') { e.preventDefault(); openPrompter(); }
    else if (mod && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); newScript(); }
  });
  window.addEventListener('beforeunload', () => { if (saveTimer) saveNow(); });

  if (native) {
    window.tpNative.onFontFromPrompter((size) => { lib.settings.fontSize = size; loadSettings(); scheduleSave(); });
    window.tpNative.onMenu((cmd) => { if (cmd === 'new') newScript(); if (cmd === 'open') openPrompter(); });
  }

  Storage2.load().then((l) => {
    lib = l;
    renderList();
    loadCurrent();
    loadSettings();
    window.__tpEditorReady = true;
    if (native) window.tpNative.editorReady();
  });

  // para testes automáticos
  window.__editor = { get lib() { return lib; }, newScript, select, openPrompter, saveNow };
})();
