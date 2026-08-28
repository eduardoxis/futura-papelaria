// js/utils/loadingUI.js
//
// Renderiza UM overlay global de loading, ligado ao estado real do
// loadingManager. Não cria elementos duplicados mesmo se chamado mais
// de uma vez (ex: import em páginas diferentes).

import { onLoadingChange } from "./loadingManager.js";

const OVERLAY_ID = "loading-global-overlay";
const BAR_ID = "loading-global-bar";

function garantirEstilos() {
  if (document.getElementById("loading-global-style")) return;
  const style = document.createElement("style");
  style.id = "loading-global-style";
  style.textContent = `
    #${BAR_ID} {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 3px;
      z-index: 99999;
      pointer-events: none;
      opacity: 0;
      transition: opacity .15s ease;
    }
    #${BAR_ID}.ativo { opacity: 1; }
    #${BAR_ID} .loading-global-bar-track {
      position: absolute;
      inset: 0;
      overflow: hidden;
      background: rgba(37, 99, 235, .12);
    }
    #${BAR_ID} .loading-global-bar-fill {
      position: absolute;
      top: 0; bottom: 0; left: 0;
      width: 40%;
      background: #2563eb;
      border-radius: 2px;
      animation: loadingGlobalSlide 1.1s ease-in-out infinite;
    }
    @keyframes loadingGlobalSlide {
      0%   { left: -40%; width: 40%; }
      50%  { left: 30%;  width: 55%; }
      100% { left: 100%; width: 40%; }
    }

    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      z-index: 99998;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, .55);
      backdrop-filter: blur(1px);
      pointer-events: none;
    }
    #${OVERLAY_ID}.ativo { display: flex; }
    #${OVERLAY_ID} .loading-global-spinner {
      position: relative;
      width: 50px;
      height: 50px;
    }
    #${OVERLAY_ID} .loading-global-spinner span {
      position: absolute;
      top: 0;
      left: 50%;
      width: 9px;
      height: 9px;
      margin-left: -4.5px;
      border-radius: 50%;
      background: #2563eb;
      transform-origin: 4.5px 25px;
      animation: loadingGlobalDotsFade 1s linear infinite;
    }
    #${OVERLAY_ID} .loading-global-spinner span:nth-child(1)  { transform: rotate(0deg);   animation-delay: -0.875s; }
    #${OVERLAY_ID} .loading-global-spinner span:nth-child(2)  { transform: rotate(45deg);  animation-delay: -0.75s; }
    #${OVERLAY_ID} .loading-global-spinner span:nth-child(3)  { transform: rotate(90deg);  animation-delay: -0.625s; }
    #${OVERLAY_ID} .loading-global-spinner span:nth-child(4)  { transform: rotate(135deg); animation-delay: -0.5s; }
    #${OVERLAY_ID} .loading-global-spinner span:nth-child(5)  { transform: rotate(180deg); animation-delay: -0.375s; }
    #${OVERLAY_ID} .loading-global-spinner span:nth-child(6)  { transform: rotate(225deg); animation-delay: -0.25s; }
    #${OVERLAY_ID} .loading-global-spinner span:nth-child(7)  { transform: rotate(270deg); animation-delay: -0.125s; }
    #${OVERLAY_ID} .loading-global-spinner span:nth-child(8)  { transform: rotate(315deg); animation-delay: 0s; }
    @keyframes loadingGlobalDotsFade {
      0%   { opacity: 1; }
      100% { opacity: 0.15; }
    }

    @media (prefers-reduced-motion: reduce) {
      #${BAR_ID} .loading-global-bar-fill,
      #${OVERLAY_ID} .loading-global-spinner span {
        animation-duration: 2.2s;
      }
    }
  `;
  document.head.appendChild(style);
}

function garantirElementos() {
  garantirEstilos();

  let bar = document.getElementById(BAR_ID);
  if (!bar) {
    bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.setAttribute("aria-hidden", "true");
    bar.innerHTML = `<div class="loading-global-bar-track"><div class="loading-global-bar-fill"></div></div>`;
    document.body.appendChild(bar);
  }

  // Overlay central de bloqueio: só usado em operações "bloqueantes"
  // explícitas (ex: salvando um formulário). A barra do topo é o
  // indicador padrão pra não atrapalhar leitura/navegação.
  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `<div class="loading-global-spinner" role="status" aria-label="Carregando">${Array.from({ length: 8 }, () => "<span></span>").join("")}</div>`;
    document.body.appendChild(overlay);
  }

  return { bar, overlay };
}

let iniciado = false;

/**
 * Liga a barra de progresso global ao estado real do loadingManager.
 * Chamar uma vez por página (chamadas extras são ignoradas).
 */
export function iniciarLoadingGlobal() {
  if (iniciado) return;
  iniciado = true;

  const start = () => {
    const { bar } = garantirElementos();
    onLoadingChange((state) => {
      bar.classList.toggle("ativo", state.visivel);
    });
  };

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
}

/**
 * Overlay de bloqueio central — pra usar em operações pontuais que
 * exigem impedir nova interação (ex: salvando produto, excluindo item).
 * Retorna função pra esconder.
 */
export function mostrarBloqueio() {
  const { overlay } = garantirElementos();
  overlay.classList.add("ativo");
  return () => overlay.classList.remove("ativo");
}
