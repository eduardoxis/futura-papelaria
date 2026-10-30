// js/utils/intro.js
//
// Animações da home:
//  - Abertura com a logo "Futura 30 anos" (1x por sessão, com botão "Pular")
//  - Balanço + confete recorrente na logo do header
//
// Carregado separadamente do app.js de propósito: não depende do Firebase
// e começa a rodar logo que o HTML é lido.

const html = document.documentElement;
const intro = document.getElementById("intro");

/* ===== Ajuste os tempos da animação da logo aqui (em segundos) ===== */
const PRIMEIRA_VEZ = 10;  // 1ª balançada, contada a partir do fim da abertura
const INTERVALO = 40;     // intervalo entre uma balançada e a próxima
const MAXIMO = 0;         // máximo de vezes por visita (0 = sem limite)

const DURACAO_ABERTURA_MS = 3700;
const reduzirMovimento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ---------- 1. Abertura ---------- */
let timerAbertura = null;

function abertura() {
  return html.classList.contains("intro-on") && !html.classList.contains("site-in");
}

function mostrarSite() {
  clearTimeout(timerAbertura);
  intro?.classList.add("out");
  html.classList.add("site-in");
}

function iniciarAbertura() {
  if (!intro || !html.classList.contains("intro-on")) return;

  try { sessionStorage.setItem("futura-intro", "1"); } catch { /* modo privado: ignora */ }

  document.getElementById("intro-pular")?.addEventListener("click", mostrarSite);

  const tocar = () => {
    intro.classList.add("go");
    timerAbertura = setTimeout(mostrarSite, DURACAO_ABERTURA_MS);
  };

  // espera as fontes (no máximo 1,2s) para a entrada em cascata não "pular"
  const fontes = document.fonts?.ready ?? Promise.resolve();
  Promise.race([fontes, new Promise((r) => setTimeout(r, 1200))]).then(tocar);
}

/* ---------- 2. Balanço + confete na logo ---------- */
const CORES = ["#1f4fd8", "#0f1b3d", "#22c55e", "#60a5fa", "#f59e0b", "#ef4444"];

function iniciarLogoAnimada() {
  const marca = document.querySelector(".logo__mark");
  const nome = document.querySelector(".logo__text");
  const logo = document.querySelector(".logo");
  const busca = document.getElementById("busca-header");
  if (!marca || !nome || !logo) return;

  let confete = logo.querySelector(".logo__confetti");
  if (!confete) {
    confete = document.createElement("span");
    confete.className = "logo__confetti";
    confete.setAttribute("aria-hidden", "true");
    logo.appendChild(confete);
  }

  let timer = null;
  let contagem = 0;

  function soltarConfete() {
    confete.innerHTML = "";
    if (reduzirMovimento) return;
    for (let i = 0; i < 36; i++) {
      const s = document.createElement("span");
      const dur = (1.5 + Math.random() * 0.6).toFixed(2);
      const atraso = (Math.random() * 0.15).toFixed(2);
      const x = Math.round((Math.random() * 2 - 1) * 120);
      const y = Math.round(15 + Math.random() * 40);
      const g = Math.round(70 + Math.random() * 70);
      const r = Math.round((Math.random() * 2 - 1) * 600);
      s.style.cssText =
        `background:${CORES[i % 6]};` +
        (i % 3 === 0 ? "border-radius:50%;width:7px;height:7px;" : "") +
        `--x:${x}px;--y:-${y}px;--g:${g}px;--r:${r}deg;` +
        `animation:logo-burst ${dur}s ${atraso}s cubic-bezier(.2,.7,.3,1) both`;
      confete.appendChild(s);
    }
    setTimeout(() => { confete.innerHTML = ""; }, 2400);
  }

  function disparar() {
    [marca, nome].forEach((el) => {
      el.classList.remove("wiggle");
      void el.offsetWidth; // reinicia a animação
      el.classList.add("wiggle");
    });
    soltarConfete();
  }

  function agendar(segundos) {
    clearTimeout(timer);
    timer = setTimeout(tick, segundos * 1000);
  }

  function tick() {
    // não dispara durante a abertura, com a aba em segundo plano
    // ou enquanto a pessoa digita na busca
    if (document.hidden || abertura() || document.activeElement === busca) {
      agendar(5);
      return;
    }
    disparar();
    contagem++;
    if (!MAXIMO || contagem < MAXIMO) agendar(INTERVALO);
  }

  agendar(PRIMEIRA_VEZ);
}

iniciarAbertura();
iniciarLogoAnimada();
