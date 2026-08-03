// js/icons.js
// Ícones SVG (stroke, estilo Feather) usados no Painel Administrativo.
// Todos herdam a cor via currentColor — nada de emojis.

export const ICONS = {
  logo: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3v5h5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 12.5h4M8.5 15.5h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,

  close: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,

  home: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 11.5 12 4l8 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  box: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 7.5 12 3l8.5 4.5V16.5L12 21l-8.5-4.5V7.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3.8 7.3 12 12l8.2-4.7M12 12v9" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,

  tag: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.5 3.5H5a1.5 1.5 0 0 0-1.5 1.5v6.5a1 1 0 0 0 .3.7l9 9a1 1 0 0 0 1.4 0l7-7a1 1 0 0 0 0-1.4l-9-9a1 1 0 0 0-.7-.3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/></svg>`,

  bookmark: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,

  archive: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3.5" y="4" width="17" height="4.5" rx="1" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 8.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V8.5" stroke="currentColor" stroke-width="1.8"/><path d="M10 12.5h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,

  users: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 20c.6-3.3 3-5 5.5-5s4.9 1.7 5.5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15.5 5.3a3.2 3.2 0 0 1 0 6.2M18 20c-.4-2.3-1.5-3.9-3.2-4.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,

  userPlus: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 20c.6-3.3 3-5 5.5-5s4.9 1.7 5.5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 8v6M21.5 11h-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,

  trendingUp: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 16.5 10 10l4 4 6.5-6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 7.5h5v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  chevronRight: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  chevronLeft: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  search: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-4.3-4.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,

  sort: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 4v16M7 4 3.5 7.5M7 4l3.5 3.5M17 20V4m0 16 3.5-3.5M17 20l-3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  plus: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,

  pencil: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 20l.9-3.9L16.4 4.6a1.5 1.5 0 0 1 2.1 0l1 1a1.5 1.5 0 0 1 0 2.1L8 19.1 4 20Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m14.5 6.5 3 3" stroke="currentColor" stroke-width="1.7"/></svg>`,

  copy: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.7"/><path d="M15 9V5.5A1.5 1.5 0 0 0 13.5 4H5.5A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15H9" stroke="currentColor" stroke-width="1.7"/></svg>`,

  trash: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.5 7h15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" stroke="currentColor" stroke-width="1.8"/><path d="M7 7l1 12.5a1.5 1.5 0 0 0 1.5 1.4h5a1.5 1.5 0 0 0 1.5-1.4L17 7" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 10.5v6M14 10.5v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,

  inboxEmpty: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 27 20 12h24l8 15" stroke="currentColor" stroke-width="2" stroke-linejoin="round" opacity="0.5"/><path d="M10 27h12l3 6h14l3-6h12v22a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3V27Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M22 8 20 5M42 8l2-3M32 6V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/></svg>`,

  gridEmpty: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="44" height="44" rx="6" stroke="currentColor" stroke-width="2" opacity="0.5"/><path d="M22 26h8M22 34h20M22 42h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,

  user: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="8" r="3.6" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 20c.8-4 3.7-6 7.5-6s6.7 2 7.5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,

  cart: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 4h2l1.6 10.2a2 2 0 0 0 2 1.7h8.1a2 2 0 0 0 2-1.6l1.3-6.8H6.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="20" r="1.4" fill="currentColor"/><circle cx="17.5" cy="20" r="1.4" fill="currentColor"/></svg>`,

  menu: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,

  grid: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/></svg>`,

  whatsapp: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 17.5 5 21l3.6-1.4A8 8 0 1 0 5.9 16.3l.6 1.2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 10c0 3.3 2.2 5.5 5.3 5.5.7 0 1-.5.9-1.1l-.2-1-1.7-.6c-.3-.1-.6 0-.8.2l-.4.5A5 5 0 0 1 9.9 11l.5-.4c.2-.2.3-.5.2-.8L10 8.1c-.1-.5-.5-.7-1-.6C8 7.7 9 9 9 10Z" fill="currentColor"/></svg>`,

  truck: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h10v9H3z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M13 10h4l3 3v2h-7z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="7" cy="17.5" r="1.6" stroke="currentColor" stroke-width="1.6"/><circle cx="17" cy="17.5" r="1.6" stroke="currentColor" stroke-width="1.6"/></svg>`,

  creditCard: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M3 10.5h18" stroke="currentColor" stroke-width="1.7"/><path d="M6.5 14.5h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,

  shieldCheck: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3.5 19 6v6c0 4.5-3 7.2-7 8.5-4-1.3-7-4-7-8.5V6l7-2.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9 12 2 2 4-4.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  headset: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 13v-1a8 8 0 0 1 16 0v1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><rect x="3" y="13" width="4" height="6" rx="1.4" stroke="currentColor" stroke-width="1.7"/><rect x="17" y="13" width="4" height="6" rx="1.4" stroke="currentColor" stroke-width="1.7"/><path d="M19 19.5v.5a3 3 0 0 1-3 3h-2.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,

  mail: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5.5" width="18" height="13" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,

  instagram: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.7"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor"/></svg>`,

  facebook: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.5 21v-7.2h2.4l.4-2.8h-2.8V9.2c0-.8.2-1.4 1.4-1.4h1.5V5.3c-.3 0-1.1-.1-2.1-.1-2.1 0-3.6 1.3-3.6 3.7v2.1H9.3v2.8h2.4V21h2.8Z" fill="currentColor"/></svg>`,

  star: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="m12 3 2.7 5.9 6.3.7-4.7 4.4 1.3 6.3L12 17.2 6.4 20.3l1.3-6.3-4.7-4.4 6.3-.7L12 3Z"/></svg>`,

  backpack: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 8V6a4 4 0 0 1 8 0v2" stroke="currentColor" stroke-width="1.7"/><path d="M6.5 8h11a2 2 0 0 1 2 2v8a2.5 2.5 0 0 1-2.5 2.5h-10A2.5 2.5 0 0 1 4.5 18v-8a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.5 12.5h5M9.5 20.5v-4h5v4" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,

  laptop: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4.5" y="5" width="15" height="10" rx="1.3" stroke="currentColor" stroke-width="1.7"/><path d="M2.5 19h19l-1.6-3H4.1L2.5 19Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,

  palette: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3.5a8.5 8 0 1 0 0 16c1.4 0 2-1 1.1-2-.6-.7-.2-1.8.8-1.8H16a4 4 0 0 0 4-4c0-4.5-3.6-8.2-8-8.2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="8" cy="10.5" r="1.1" fill="currentColor"/><circle cx="11.5" cy="7.7" r="1.1" fill="currentColor"/><circle cx="15.3" cy="9.3" r="1.1" fill="currentColor"/><circle cx="9" cy="14.5" r="1.1" fill="currentColor"/></svg>`,

  printer: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 8.5V4h11v4.5" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><rect x="3.5" y="8.5" width="17" height="7.5" rx="1.5" stroke="currentColor" stroke-width="1.7"/><rect x="6.5" y="13" width="11" height="7" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="17" cy="11.3" r="0.9" fill="currentColor"/></svg>`,

  notebook: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="3.5" width="14" height="17" rx="1.5" stroke="currentColor" stroke-width="1.7"/><path d="M9 3.5v17" stroke="currentColor" stroke-width="1.7"/><path d="M12.5 8h3M12.5 11.5h3M12.5 15h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,

  pen: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 15.5 15.5 6l2.5 2.5L8.5 18H6v-2.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M13.5 8 16 10.5" stroke="currentColor" stroke-width="1.7"/><path d="M4 21h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,

  gift: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3.5" y="9.5" width="17" height="4" rx="1" stroke="currentColor" stroke-width="1.7"/><path d="M5 13.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6.5" stroke="currentColor" stroke-width="1.7"/><path d="M12 9.5V21" stroke="currentColor" stroke-width="1.7"/><path d="M12 9.5c-2.5 0-4.5-1-4.5-3S9 3.5 10 4.5s2 3 2 5Zm0 0c2.5 0 4.5-1 4.5-3S15 3.5 14 4.5s-2 3-2 5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,

  phone: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="7" y="2.5" width="10" height="19" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M11 18.5h2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,

  clipboardList: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="4.5" width="14" height="16" rx="2" stroke="currentColor" stroke-width="1.7"/><rect x="9" y="3" width="6" height="3" rx="1" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,

  messageSquare: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 5.5h16v10.5H9l-4 3.5v-3.5H4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
};

/** Retorna um <span> com o ícone pronto para inserir no innerHTML. */
export function icon(name, cls = "") {
  return `<span class="icon${cls ? " " + cls : ""}" aria-hidden="true">${ICONS[name] || ""}</span>`;
}
