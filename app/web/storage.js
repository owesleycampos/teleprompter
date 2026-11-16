// Onde os roteiros ficam salvos:
// - no app (Mac/Windows): num arquivo JSON na pasta de dados do app
// - no navegador (tablet/celular): no armazenamento local do navegador
window.Storage2 = (() => {
  const KEY = 'teleprompter-library-v1';
  const native = !!window.tpNative;

  async function load() {
    let raw = null;
    if (native) raw = await window.tpNative.loadLibrary();
    else {
      try { raw = localStorage.getItem(KEY); } catch { raw = null; }
    }
    return TP.validateLibrary(raw).library;
  }

  async function save(lib) {
    const json = JSON.stringify(lib);
    if (native) return window.tpNative.saveLibrary(json);
    try { localStorage.setItem(KEY, json); } catch { /* modo privado: segue sem salvar */ }
  }

  return { load, save, native };
})();
