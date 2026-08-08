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
 * Igual a podeExecutar(), mas persiste em localStorage (sobrevive a fechar
 * a aba/navegador). Usado para limitar por e-mail ações sensíveis como
 * pedidos de redefinição de senha, dificultando spam mesmo reabrindo o site.
 */
export function podeExecutarPersistente(chave, limite = 5, janelaMs = 60 * 60_000) {
  const agora = Date.now();
  const registro = JSON.parse(localStorage.getItem(`ratelimit_${chave}`) || "[]")
    .filter(t => agora - t < janelaMs);

  if (registro.length >= limite) return false;

  registro.push(agora);
  localStorage.setItem(`ratelimit_${chave}`, JSON.stringify(registro));
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
/**
 * Converte uma imagem (File) para WebP no navegador, redimensionando pela
 * largura máxima e aplicando compressão de qualidade. Retorna um Blob.
 * Usado antes do upload para o serviço externo de hospedagem de imagens
 * (nunca salvamos base64 no Firestore nem usamos Firebase Storage).
 */
export function converterParaWebP(file, maxWidth = 800, qualidade = 0.8) {
  return converterParaFormato(file, "image/webp", maxWidth, qualidade);
}

/**
 * Mesma lógica de converterParaWebP, mas gera PNG — usado para imagens de
 * categoria/marca, que costumam ser logos com fundo transparente e ficam
 * melhor em PNG do que recomprimidas em WebP com perdas.
 */
export function converterParaPNG(file, maxWidth = 500) {
  return converterParaFormato(file, "image/png", maxWidth, 1);
}

function converterParaFormato(file, mime, maxWidth, qualidade) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error(`Falha ao gerar ${mime}`))),
          mime,
          qualidade
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Pede confirmação através de um modal (não usa o confirm() nativo do
 * navegador). Retorna uma Promise<boolean> resolvida conforme a escolha.
 */
export function confirmarAcao(mensagem, { titulo = "Confirmar ação", textoConfirmar = "Remover", textoCancelar = "Cancelar" } = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "dialog-form dialog-confirm";
    dialog.innerHTML = `
      <div class="confirm-box">
        <h3>${escHtml(titulo)}</h3>
        <p>${escHtml(mensagem)}</p>
        <div class="form-actions">
          <button type="button" data-confirm-nao>${escHtml(textoCancelar)}</button>
          <button type="button" class="btn-primary btn-perigo" data-confirm-sim>${escHtml(textoConfirmar)}</button>
        </div>
      </div>`;
    document.body.appendChild(dialog);
    dialog.showModal();

    const finalizar = (resultado) => {
      dialog.close();
      dialog.remove();
      resolve(resultado);
    };
    dialog.querySelector("[data-confirm-sim]").addEventListener("click", () => finalizar(true));
    dialog.querySelector("[data-confirm-nao]").addEventListener("click", () => finalizar(false));
    dialog.addEventListener("cancel", () => finalizar(false));
  });
}

export function compressImageToBase64(file, maxWidth = 800, quality = 0.7, format = "jpeg") {
  // Mantida apenas para compatibilidade com dados antigos que ainda tenham
  // imagens em base64 no Firestore (ver migrarImagensAntigas em cloudinary.js).
  // Novos uploads NÃO devem usar esta função — usar converterParaWebP().
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
