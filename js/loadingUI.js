// js/utils/loadingUI.js
//
// Loading global com o personagem "30 anos" + barra de progresso no topo,
// ligado ao estado real do loadingManager.
// Não cria elementos duplicados quando importado por páginas diferentes.

import { onLoadingChange } from "./loadingManager.js";

const OVERLAY_ID = "loading-global-overlay";
const BAR_ID = "loading-global-bar";

const CENA_SVG = `<svg class="sc" viewBox="0 0 330 290" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
<g fill="none" stroke="#0f1b3d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <g class="pend">
    <path d="M272 0V82"/>
    <circle cx="272" cy="82" r="3.5" fill="#fff"/>
    <path d="M258 112C258 94 262 85 272 85C282 85 286 94 286 112Z" fill="#ffc83d"/>
    <path d="M253 112H291"/>
    <g class="clap"><circle cx="272" cy="119" r="4.5" fill="#0f1b3d"/></g>
  </g>
  <path d="M30 270H246M260 270H272"/>
  <path d="M68 226V268M262 226V268"/>
  <g class="legL"><rect x="132" y="200" width="16" height="48" rx="8" fill="#3b4f8f"/><rect x="126" y="244" width="28" height="14" rx="7" fill="#ef4444"/></g>
  <g class="legR"><rect x="182" y="200" width="16" height="48" rx="8" fill="#3b4f8f"/><rect x="176" y="244" width="28" height="14" rx="7" fill="#ef4444"/></g>
  <path d="M122 152Q122 138 138 138H192Q208 138 208 152V194H122Z" fill="#1f4fd8"/>
  <text x="165" y="174" text-anchor="middle" font-size="18" font-weight="800" fill="#fff" stroke="none">30</text>
  <rect x="156" y="124" width="18" height="18" rx="4" fill="#ffd9b8"/>
  <g class="head">
    <circle cx="129" cy="102" r="6.5" fill="#ffd9b8"/>
    <circle cx="201" cy="102" r="6.5" fill="#ffd9b8"/>
    <ellipse cx="165" cy="98" rx="36" ry="34" fill="#ffd9b8"/>
    <path d="M129 94C124 62 148 56 168 58C190 56 208 68 201 94C196 84 188 78 178 77C164 86 144 84 129 94Z" fill="#0f1b3d"/>
    <path d="M166 58Q160 48 170 46"/>
    <circle cx="150" cy="104" r="11" fill="#fff" fill-opacity=".65"/>
    <circle cx="180" cy="104" r="11" fill="#fff" fill-opacity=".65"/>
    <path d="M161 104H169"/>
    <g class="eyes"><circle class="pu" cx="150" cy="106" r="3.2" fill="#0f1b3d" stroke="none"/><circle class="pu" cx="180" cy="106" r="3.2" fill="#0f1b3d" stroke="none"/></g>
    <path d="M158 122Q165 127 172 122"/>
    <circle cx="139" cy="116" r="4.5" fill="#ff9fa8" fill-opacity=".75" stroke="none"/>
    <circle cx="191" cy="116" r="4.5" fill="#ff9fa8" fill-opacity=".75" stroke="none"/>
  </g>
  <path d="M80 188H250L278 214H52Z" fill="#c9d9ff"/>
  <rect x="52" y="214" width="226" height="11" rx="4" fill="#9db8f5"/>
  <path d="M112 190H224L236 213H100Z" fill="#fff"/>
  <path d="M126 190v-5M146 190v-5M166 190v-5M186 190v-5M206 190v-5" stroke-width="2.5"/>
  <path d="M110 197H226M105 205H231M101 212H235" stroke="#bcd0ff" stroke-width="1.5"/>
  <path class="wr" pathLength="100" d="M114 205q4 -6 8 0t8 0t8 0t8 0t8 0t8 0t8 0t8 0t8 0t8 0" stroke="#1f4fd8" stroke-width="2.4"/>
  <path d="M193 152L205 198" stroke-width="16"/>
  <path d="M193 152L205 198" stroke="#2f6bf0" stroke-width="10"/>
  <circle cx="205" cy="200" r="7.5" fill="#ffd9b8"/>
  <rect class="arm" x="137" y="146" width="60" height="12" rx="6" fill="#2f6bf0"/>
  <g class="hand">
    <path d="M114 205L138 181" stroke-width="8"/>
    <path d="M114 205L138 181" stroke="#ffc83d" stroke-width="3"/>
    <path d="M138 181L143 176" stroke="#ff9fa8" stroke-width="5"/>
    <circle cx="122" cy="197" r="7.5" fill="#ffd9b8"/>
  </g>
</g>
</svg>`;

function garantirEstilos() {
  if (document.getElementById("loading-global-style")) return;
  const style = document.createElement("style");
  style.id = "loading-global-style";
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      background: rgba(255, 255, 255, .95);
      -webkit-backdrop-filter: blur(6px);
      backdrop-filter: blur(6px);
      pointer-events: none;
      visibility: hidden;
      opacity: 0;
      transition: opacity .35s, visibility 0s linear .35s;
    }
    #${OVERLAY_ID}.ativo {
      visibility: visible;
      opacity: 1;
      transition: opacity .25s, visibility 0s;
    }
    #${OVERLAY_ID} .lgl-scene {
      width: min(88vw, 370px);
      padding: 16px 18px 22px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    #${OVERLAY_ID} .lgl-sc { display: block; width: 100%; height: auto; overflow: visible; }
    #${OVERLAY_ID} .lgl-sc .pend  { transform-origin: 272px 0;     animation: lgl-swing 2.2s ease-in-out infinite; }
    #${OVERLAY_ID} .lgl-sc .clap  { transform-origin: 272px 112px; animation: lgl-clap 2.2s ease-in-out -.25s infinite; }
    #${OVERLAY_ID} .lgl-sc .head  { transform-origin: 165px 134px; animation: lgl-bob 1.6s ease-in-out infinite; }
    #${OVERLAY_ID} .lgl-sc .eyes  { transform-origin: 165px 106px; animation: lgl-blink 3.6s infinite; }
    #${OVERLAY_ID} .lgl-sc .pu    { animation: lgl-scan 1.1s linear infinite; }
    #${OVERLAY_ID} .lgl-sc .legL  { transform-origin: 140px 226px; animation: lgl-kick 1.3s ease-in-out infinite; }
    #${OVERLAY_ID} .lgl-sc .legR  { transform-origin: 190px 226px; animation: lgl-kick 1.3s ease-in-out -.65s infinite; }
    #${OVERLAY_ID} .lgl-sc .arm   { transform-origin: 137px 152px; vector-effect: non-scaling-stroke; animation: lgl-wrarm 2.6s linear infinite; }
    #${OVERLAY_ID} .lgl-sc .hand  { animation: lgl-wrhand 2.6s linear infinite; }
    #${OVERLAY_ID} .lgl-sc .wr    { stroke-dasharray: 100; animation: lgl-wrline 2.6s linear infinite; }
    #${OVERLAY_ID} .lgl-lt {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 19px;
      color: #0f1b3d;
      text-transform: lowercase;
    }
    #${OVERLAY_ID} .lgl-dots { display: inline-flex; gap: 4px; }
    #${OVERLAY_ID} .lgl-dots i {
      width: 6px; height: 6px; border-radius: 50%;
      background: #1f4fd8;
      animation: lgl-bn 1s ease-in-out infinite;
    }
    #${OVERLAY_ID} .lgl-dots i:nth-child(2) { animation-delay: .15s; }
    #${OVERLAY_ID} .lgl-dots i:nth-child(3) { animation-delay: .3s; }

    #${BAR_ID} {
      position: fixed;
      top: env(safe-area-inset-top, 0px);
      left: 0;
      height: 3px;
      width: 0;
      z-index: 100001;
      background: linear-gradient(90deg, #1f4fd8, #60a5fa);
      border-radius: 0 3px 3px 0;
      pointer-events: none;
    }
    #${BAR_ID}.run  { width: 85%; transition: width 2.2s cubic-bezier(.1, .6, .2, 1); }
    #${BAR_ID}.done { width: 100%; opacity: 0; transition: width .2s, opacity .4s .25s; }

    @keyframes lgl-swing { 0%, 100% { transform: rotate(-20deg); } 50% { transform: rotate(20deg); } }
    @keyframes lgl-clap  { 0%, 100% { transform: rotate(12deg); }  50% { transform: rotate(-12deg); } }
    @keyframes lgl-bob   { 0%, 100% { transform: translateY(0) rotate(-1.5deg); } 50% { transform: translateY(2px) rotate(1.5deg); } }
    @keyframes lgl-blink { 0%, 90%, 100% { transform: scaleY(1); } 94% { transform: scaleY(.1); } }
    @keyframes lgl-scan  { 0% { transform: translateX(-2.6px); } 80%, 100% { transform: translateX(2.6px); } }
    @keyframes lgl-kick  { 0%, 100% { transform: rotate(6deg); } 50% { transform: rotate(-10deg); } }
    @keyframes lgl-wrarm {
      0%, 100% { transform: rotate(108.4deg) scale(.79, 1); }
      21.25% { transform: rotate(83.7deg) scale(.755, 1); }
      42.5%  { transform: rotate(60.9deg) scale(.858, 1); }
      63.75% { transform: rotate(45deg) scale(1.061, 1); }
      85%    { transform: rotate(34.7deg) scale(1.318, 1); }
      88.75% { transform: rotate(45deg) scale(1.061, 1); }
      92.5%  { transform: rotate(60.9deg) scale(.858, 1); }
      96.25% { transform: rotate(83.7deg) scale(.755, 1); }
    }
    @keyframes lgl-wrhand { 0%, 100% { transform: translateX(0); } 85% { transform: translateX(80px); } }
    @keyframes lgl-wrline {
      0% { stroke-dashoffset: 100; opacity: 1; }
      85%, 93% { stroke-dashoffset: 0; opacity: 1; }
      100% { stroke-dashoffset: 0; opacity: 0; }
    }
    @keyframes lgl-bn { 0%, 80%, 100% { transform: translateY(0); opacity: .45; } 40% { transform: translateY(-6px); opacity: 1; } }

    @media (prefers-reduced-motion: reduce) {
      #${OVERLAY_ID} .lgl-sc * { animation: none !important; }
      #${OVERLAY_ID} .lgl-dots i { animation-duration: 3.5s; }
    }
  `;
  document.head.appendChild(style);
}

function garantirElementos() {
  garantirEstilos();

  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="lgl-scene" role="status" aria-label="Carregando">
        ${CENA_SVG.replace("<svg ", '<svg class="lgl-sc" ').replace('class="sc"', "")}
        <div class="lgl-lt"><span data-lgl-msg>Carregando</span><span class="lgl-dots" aria-hidden="true"><i></i><i></i><i></i></span></div>
      </div>`;
    document.body.appendChild(overlay);
  }

  let barra = document.getElementById(BAR_ID);
  if (!barra) {
    barra = document.createElement("div");
    barra.id = BAR_ID;
    barra.setAttribute("aria-hidden", "true");
    document.body.appendChild(barra);
  }

  return { overlay, barra };
}

// Texto exibido conforme a operação em andamento (as chaves vêm do loadingManager)
function mensagemPara(chaves = {}) {
  const nomes = Object.keys(chaves);
  if (nomes.some((k) => /busca|buscar/i.test(k))) return "Buscando produtos";
  if (nomes.some((k) => /produto|marca|categoria/i.test(k))) return "Carregando catálogo";
  if (nomes.some((k) => /^sair$/i.test(k))) return "Saindo";
  if (nomes.some((k) => /^salvar|^atualizar/i.test(k))) return "Salvando";
  return "Carregando";
}

let barraVisivel = false;

function definirVisibilidade({ overlay, barra }, state) {
  const visivel = !!state.visivel;

  overlay.classList.toggle("ativo", visivel);
  overlay.setAttribute("aria-hidden", String(!visivel));

  if (visivel) {
    const msg = overlay.querySelector("[data-lgl-msg]");
    if (msg) msg.textContent = mensagemPara(state.chaves);
  }

  if (visivel && !barraVisivel) {
    barra.className = "";
    void barra.offsetWidth; // reinicia a transição da barra
    barra.classList.add("run");
  } else if (!visivel && barraVisivel) {
    barra.classList.remove("run");
    barra.classList.add("done");
  }
  barraVisivel = visivel;
}

let iniciado = false;

/** Liga o indicador central ao loading real da aplicação. */
export function iniciarLoadingGlobal() {
  if (iniciado) return;
  iniciado = true;

  const start = () => {
    const els = garantirElementos();
    onLoadingChange((state) => definirVisibilidade(els, state));
  };

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
}

/** Mostra o mesmo indicador em uma operação bloqueante explícita. */
export function mostrarBloqueio() {
  const els = garantirElementos();
  definirVisibilidade(els, { visivel: true, chaves: {} });
  return () => definirVisibilidade(els, { visivel: false, chaves: {} });
}
