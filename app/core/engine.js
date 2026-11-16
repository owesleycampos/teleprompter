// Lógica pura do teleprompter — a mesma no app (Mac/Windows) e na versão web.
// Funciona como <script> no navegador (window.TP) e como módulo no Node (testes).
(function (root) {
  const TP = {};

  TP.WORDS_PER_MINUTE = 150;      // ritmo médio de fala em português
  TP.READING_LINE = 0.32;         // linha de leitura: terço de cima (perto da câmera)

  // ---------- Tempo e velocidade ----------

  TP.wordCount = (text) => (String(text || '').match(/\S+/g) || []).length;

  TP.estimatedDuration = (words, wpm = TP.WORDS_PER_MINUTE) => (wpm > 0 ? (words / wpm) * 60 : 0);

  /** Pixels por segundo para o texto inteiro passar em `duration` segundos. */
  TP.pixelsPerSecond = (contentHeight, viewportHeight, duration) => {
    const distance = Math.max(0, contentHeight - viewportHeight);
    return duration > 0 ? distance / duration : 0;
  };

  TP.remaining = (scrolled, contentHeight, viewportHeight, pps) => {
    const left = Math.max(0, contentHeight - viewportHeight - scrolled);
    return pps > 0 ? left / pps : 0;
  };

  TP.progress = (scrolled, contentHeight, viewportHeight) => {
    const distance = contentHeight - viewportHeight;
    if (distance <= 0) return 0;
    return Math.min(1, Math.max(0, scrolled / distance));
  };

  TP.clampMultiplier = (m) => Math.min(3, Math.max(0.3, m));
  TP.clampFontSize = (s) => Math.min(96, Math.max(18, s));

  TP.formatTime = (seconds) => {
    const total = Math.max(0, Math.round(seconds || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };

  /** Aceita "90", "1:30", "2m" ou "45s". Devolve segundos ou null. */
  TP.parseDuration = (s) => {
    const t = String(s || '').trim().toLowerCase().replace(',', '.');
    if (!t) return null;
    if (t.includes(':')) {
      const parts = t.split(':');
      if (parts.length !== 2 || parts.some((p) => p === '' || isNaN(p))) return null;
      const [m, sec] = parts.map(Number);
      if (m < 0 || sec < 0 || sec >= 60) return null;
      const total = m * 60 + sec;
      return total > 0 ? total : null;
    }
    let v;
    if (t.endsWith('m')) v = Number(t.slice(0, -1)) * 60;
    else if (t.endsWith('s')) v = Number(t.slice(0, -1));
    else v = Number(t);
    return Number.isFinite(v) && v > 0 ? v : null;
  };

  /** Junta linhas em branco repetidas e tira espaços das pontas. */
  TP.normalizeScript = (text) =>
    String(text || '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n');

  // ---------- Roteiros ----------

  TP.uuid = () =>
    (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      }));

  TP.WELCOME = [
    'Olá! Este é o seu teleprompter.',
    '',
    'No computador, ele fica na sua tela mas não aparece na gravação. Leia sempre na altura da marquinha à esquerda: ela fica perto da câmera, então seu olhar parece natural.',
    '',
    'O que já foi lido vai sumindo em cima. O que vem a seguir aparece embaixo.',
    '',
    'Espaço ou um toque na tela para começar ou pausar. Setas para cima e para baixo mudam a velocidade. R volta ao início.',
    '',
    'Agora é só colar o seu roteiro e gravar com calma. Respire, sorria e fale como se estivesse conversando com uma pessoa só.',
  ].join('\n');

  TP.defaultSettings = () => ({
    fontSize: 34,
    durationSeconds: null,      // null = automático pelo ritmo de fala
    backgroundOpacity: 0.94,
    countdown: true,
    mirror: false,
  });

  TP.newScript = (title = '', body = '') => ({ id: TP.uuid(), title, body, createdAt: Date.now() });

  TP.defaultLibrary = () => {
    const welcome = TP.newScript('Boas-vindas', TP.WELCOME);
    return { scripts: [welcome], selectedID: welcome.id, settings: TP.defaultSettings() };
  };

  /** Valida dados lidos do disco/navegador. Dado inválido → biblioteca padrão. */
  TP.validateLibrary = (raw) => {
    let lib = raw;
    if (typeof raw === 'string') {
      try { lib = JSON.parse(raw); } catch { return { library: TP.defaultLibrary(), recovered: true }; }
    }
    if (!lib || !Array.isArray(lib.scripts) || lib.scripts.length === 0) {
      return { library: TP.defaultLibrary(), recovered: raw != null };
    }
    const scripts = lib.scripts
      .filter((s) => s && typeof s.id === 'string')
      .map((s) => ({ id: s.id, title: String(s.title || ''), body: String(s.body || ''), createdAt: Number(s.createdAt) || 0 }));
    if (scripts.length === 0) return { library: TP.defaultLibrary(), recovered: true };
    const settings = Object.assign(TP.defaultSettings(), lib.settings || {});
    const selectedID = scripts.some((s) => s.id === lib.selectedID) ? lib.selectedID : TP.sortedScripts({ scripts })[0].id;
    return { library: { scripts, selectedID, settings }, recovered: false };
  };

  TP.sortedScripts = (lib) => [...lib.scripts].sort((a, b) => b.createdAt - a.createdAt);
  TP.selected = (lib) => lib.scripts.find((s) => s.id === lib.selectedID) || null;

  TP.addScript = (lib, title = '', body = '') => {
    const s = TP.newScript(title, body);
    // garante que o novo fica em primeiro mesmo se criado no mesmo milissegundo
    const newest = lib.scripts.reduce((m, x) => Math.max(m, x.createdAt), 0);
    if (s.createdAt <= newest) s.createdAt = newest + 1;
    lib.scripts.push(s);
    lib.selectedID = s.id;
    return s;
  };

  TP.updateScript = (lib, id, changes) => {
    const s = lib.scripts.find((x) => x.id === id);
    if (!s) return;
    if (changes.title != null) s.title = changes.title;
    if (changes.body != null) s.body = changes.body;
  };

  /** Apaga e seleciona o vizinho. Sempre sobra pelo menos um roteiro. */
  TP.deleteScript = (lib, id) => {
    const order = TP.sortedScripts(lib).map((s) => s.id);
    const pos = order.indexOf(id);
    lib.scripts = lib.scripts.filter((s) => s.id !== id);
    if (lib.scripts.length === 0) { TP.addScript(lib); return; }
    if (lib.selectedID === id) {
      const rest = TP.sortedScripts(lib);
      lib.selectedID = rest[Math.min(Math.max(pos, 0), rest.length - 1)].id;
    }
  };

  TP.displayTitle = (s) => {
    const t = String(s.title || '').trim();
    if (t) return t;
    const first = String(s.body || '').split('\n').map((l) => l.trim()).find(Boolean) || '';
    if (!first) return 'Sem título';
    return first.length > 40 ? first.slice(0, 40) + '…' : first;
  };

  TP.effectiveDuration = (settings, script) =>
    settings.durationSeconds || TP.estimatedDuration(TP.wordCount(script.body));

  // ---------- Posição e tamanho da janela (app de computador) ----------
  // Coordenadas de tela com origem no canto de cima à esquerda (como no Electron).

  TP.POSITIONS = {
    topCenter: 'No topo, centro (perto da câmera)',
    topLeft: 'No topo, à esquerda',
    topRight: 'No topo, à direita',
    center: 'No centro da tela',
    bottomCenter: 'Embaixo, centro',
  };
  TP.SIZES = { small: 'Pequeno', medium: 'Médio', large: 'Grande', fullWidth: 'Largura total' };
  TP.LAYOUT_MARGIN = 10;
  TP.MIN_SIZE = { width: 380, height: 180 };

  TP.layoutSize = (size, screen) => {
    const m = TP.LAYOUT_MARGIN;
    const raw = {
      small: { width: 480, height: 200 },
      medium: { width: 720, height: 300 },
      large: { width: 980, height: 420 },
      fullWidth: { width: screen.width - 2 * m, height: 300 },
    }[size] || { width: 720, height: 300 };
    return {
      width: Math.round(Math.max(TP.MIN_SIZE.width, Math.min(raw.width, screen.width - 2 * m))),
      height: Math.round(Math.max(TP.MIN_SIZE.height, Math.min(raw.height, screen.height - 2 * m))),
    };
  };

  TP.layoutFrame = (position, size, screen) => {
    const m = TP.LAYOUT_MARGIN;
    const w = Math.min(size.width, screen.width - 2 * m);
    const h = Math.min(size.height, screen.height - 2 * m);
    const left = screen.x + m;
    const centerX = screen.x + (screen.width - w) / 2;
    const right = screen.x + screen.width - m - w;
    const top = screen.y + m;
    const pos = {
      topCenter: [centerX, top],
      topLeft: [left, top],
      topRight: [right, top],
      center: [centerX, screen.y + (screen.height - h) / 2],
      bottomCenter: [centerX, screen.y + screen.height - m - h],
    }[position] || [centerX, top];
    return { x: Math.round(pos[0]), y: Math.round(pos[1]), width: Math.round(w), height: Math.round(h) };
  };

  /** Mantém a janela dentro da tela. */
  TP.clampFrame = (f, screen) => {
    const width = Math.min(f.width, screen.width);
    const height = Math.min(f.height, screen.height);
    const x = Math.min(Math.max(f.x, screen.x), screen.x + screen.width - width);
    const y = Math.min(Math.max(f.y, screen.y), screen.y + screen.height - height);
    return { x, y, width, height };
  };

  /** Interseção de dois retângulos (área), para achar em que tela a janela está. */
  TP.overlapArea = (a, b) => {
    const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = TP;
  else root.TP = TP;
})(typeof globalThis !== 'undefined' ? globalThis : this);
