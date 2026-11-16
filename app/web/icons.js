// Ícones em SVG (traço simples, herdam a cor do botão).
window.ICONS = (() => {
  const svg = (d, fill = false) =>
    `<svg viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  return {
    close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    back: svg('<path d="M15 5l-7 7 7 7"/>'),
    restart: svg('<path d="M6 5v14"/><path d="M19 5l-9 7 9 7z" fill="currentColor"/>'),
    play: svg('<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke-width="1.5"/>'),
    pause: svg('<path d="M8 5v14M16 5v14" stroke-width="3.2"/>'),
    minus: svg('<path d="M5 12h14"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    textSmaller: svg('<path d="M4 19l5-13 5 13M5.8 15h6.4" stroke-width="2"/><path d="M16 12h5" stroke-width="2"/>'),
    textLarger: svg('<path d="M3 20l6-16 6 16M5.2 15h7.6" stroke-width="2"/><path d="M16 9h6M19 6v6" stroke-width="2"/>'),
    layout: svg('<rect x="3" y="4" width="18" height="14" rx="2.5"/><rect x="7.5" y="6.5" width="9" height="4" rx="1" fill="currentColor" stroke="none"/><path d="M9 21h6"/>'),
    fullscreen: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  };
})();
