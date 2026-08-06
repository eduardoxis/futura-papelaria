// js/utils.js
export function escHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatBRL(value = 0) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("pt-BR");
}

export function slugify(text = "") {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function generateCode(prefix = "PROD") {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function toast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Limitador simples de ações no cliente (ex.: evitar múltiplos cliques em
 * "Finalizar pedido" ou tentativas repetidas de login). Isto é apenas uma
 * camada de UX — a proteção real contra abuso/spam deve vir do Firebase
 * App Check e das Firestore Security Rules (veja SECURITY.md).
 * @param {string} chave identificador único da ação (ex.: "login", "finalizar-pedido")
 * @param {number} limite quantidade máxima de execuções permitidas
 * @param {number} janelaMs período em milissegundos para o limite
 * @returns {boolean} true se a ação pode ser executada agora
 */
export function podeExecutar(chave, limite = 5, janelaMs = 60_000) {
  const agora = Date.now();
  const registro = JSON.parse(sessionStorage.getItem(`ratelimit_${chave}`) || "[]")
    .filter(t => agora - t < janelaMs);

  if (registro.length >= limite) return false;

  registro.push(agora);
  sessionStorage.setItem(`ratelimit_${chave}`, JSON.stringify(registro));
  return true;
}

/**
 * Comprime uma imagem (File) e retorna uma string Base64 (JPEG) já reduzida,
 * para caber com folga dentro do limite de 1MB por documento do Firestore.
 * @param {File} file
 * @param {number} maxWidth
 * @param {number} quality 0..1
 * @returns {Promise<string>} data URL base64
 */
export function compressImageToBase64(file, maxWidth = 800, quality = 0.7, format = "jpeg") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const mime = format === "png" ? "image/png" : "image/jpeg";
        resolve(canvas.toDataURL(mime, quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
