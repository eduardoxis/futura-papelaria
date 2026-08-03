// js/app.js
import { listarProdutos, listarCategorias, listarEtiquetas } from "./firestore.js";
import { renderizarGrade, aplicarFiltros, ordenarProdutos } from "./products.js";
import { buscarProdutos, ativarBuscaTempoReal } from "./search.js";
import {
  obterCarrinho, adicionarAoCarrinho, atualizarQuantidade, calcularTotais, atualizarBadgeCarrinho,
  finalizarPedidoWhatsApp, falarSobreProduto, registrarLeadPerdidoSeNecessario
} from "./cart.js";
import { formatBRL, escHtml, toast, podeExecutar } from "./utils.js";
import { ouvirEstadoAuth, ehAdmin, entrar, cadastrar, sair } from "./auth.js";
import { iniciarModais, abrirModal, fecharModal, trocarAba } from "./modal.js";
import { iniciarPainelAdmin } from "./dashboard.js";

let TODOS_PRODUTOS = [];
let filtrosAtivos = {};

async function iniciar() {
  iniciarModais();
  atualizarBadgeCarrinho();

  TODOS_PRODUTOS = await listarProdutos({ apenasAtivos: true });
  renderizarGrade(document.querySelector("#grade-produtos"), TODOS_PRODUTOS);
  renderizarDestaques();
  renderizarRecentes();
  await renderizarFiltros();

  const inputBusca = document.querySelector("#busca-header");
  if (inputBusca) {
    ativarBuscaTempoReal(inputBusca, (termo) => aplicarBuscaEFiltros(termo));
  }

  configurarCarrinhoUI();
  configurarLogin();
  configurarModalAuth();

  document.addEventListener("adicionar-carrinho", (e) => {
    adicionarAoCarrinho(e.detail, 1);
    toast("Produto adicionado ao carrinho.");
  });
  document.addEventListener("falar-produto", (e) => {
    falarSobreProduto(e.detail);
  });

  window.addEventListener("beforeunload", () => registrarLeadPerdidoSeNecessario());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") registrarLeadPerdidoSeNecessario();
  });
}

function aplicarBuscaEFiltros(termo = "") {
  let lista = buscarProdutos(TODOS_PRODUTOS, termo);
  lista = aplicarFiltros(lista, filtrosAtivos);
  renderizarGrade(document.querySelector("#grade-produtos"), lista);
}

function renderizarDestaques() {
  const container = document.querySelector("#grade-destaques");
  if (!container) return;
  const destaques = TODOS_PRODUTOS.filter(p => (p.etiquetas || []).includes("Mais Vendido") || (p.etiquetas || []).includes("Promoção")).slice(0, 8);
  renderizarGrade(container, destaques.length ? destaques : TODOS_PRODUTOS.slice(0, 8));
}

function renderizarRecentes() {
  const container = document.querySelector("#grade-recentes");
  if (!container) return;
  const recentes = ordenarProdutos(TODOS_PRODUTOS, "recentes").slice(0, 8);
  renderizarGrade(container, recentes);
}

async function renderizarFiltros() {
  const categorias = await listarCategorias();
  const seletor = document.querySelector("#filtro-categoria");
  if (seletor) {
    seletor.innerHTML = `<option value="">Todas as categorias</option>` +
      categorias.map(c => `<option value="${escHtml(c.nome)}">${escHtml(c.nome)}</option>`).join("");
    seletor.addEventListener("change", () => {
      filtrosAtivos.categoria = seletor.value || undefined;
      aplicarBuscaEFiltros(document.querySelector("#busca-header")?.value || "");
    });
  }
}

function configurarCarrinhoUI() {
  const drawer = document.querySelector("#cart-drawer");
  const overlay = document.querySelector("#cart-overlay");
  const abrirBtn = document.querySelector("#abrir-carrinho");
  const fecharBtn = document.querySelector("#fechar-carrinho");

  function renderCarrinho() {
    const carrinho = obterCarrinho();
    const lista = document.querySelector("#itens-carrinho");
    const { subtotal, total } = calcularTotais();
    lista.innerHTML = carrinho.map(item => `
      <div class="cart-item" data-id="${item.id}">
        <img src="${item.imagem || "/assets/images/placeholder.svg"}" alt="${escHtml(item.nome)}">
        <div>
          <div class="cart-item__name">${escHtml(item.nome)}</div>
          <div class="cart-item__brand">${escHtml(item.marca)}</div>
          <div class="qty-stepper">
            <button data-diminuir>-</button>
            <input type="number" value="${item.quantidade}" min="1" data-qtd>
            <button data-aumentar>+</button>
          </div>
        </div>
        <strong>${formatBRL(item.preco * item.quantidade)}</strong>
      </div>`).join("") || `<p class="empty-state">Seu carrinho está vazio.</p>`;

    document.querySelector("#subtotal-carrinho").textContent = formatBRL(subtotal);
    document.querySelector("#total-carrinho").textContent = formatBRL(total);

    lista.querySelectorAll(".cart-item").forEach(el => {
      const id = el.dataset.id;
      const input = el.querySelector("[data-qtd]");
      el.querySelector("[data-aumentar]").addEventListener("click", () => {
        atualizarQuantidade(id, parseInt(input.value, 10) + 1);
        renderCarrinho();
      });
      el.querySelector("[data-diminuir]").addEventListener("click", () => {
        atualizarQuantidade(id, parseInt(input.value, 10) - 1);
        renderCarrinho();
      });
      input.addEventListener("change", () => {
        atualizarQuantidade(id, parseInt(input.value, 10) || 0);
        renderCarrinho();
      });
    });
  }

  function abrir() {
    renderCarrinho();
    drawer.classList.add("is-open");
    overlay.classList.add("is-open");
  }
  function fechar() {
    drawer.classList.remove("is-open");
    overlay.classList.remove("is-open");
  }

  abrirBtn?.addEventListener("click", abrir);
  fecharBtn?.addEventListener("click", fechar);
  overlay?.addEventListener("click", fechar);

  document.querySelector("#finalizar-pedido")?.addEventListener("click", () => {
    if (!obterCarrinho().length) { toast("Seu carrinho está vazio.", "error"); return; }
    if (!podeExecutar("finalizar-pedido", 5, 60_000)) {
      toast("Muitos pedidos em pouco tempo. Aguarde um instante.", "error");
      return;
    }
    const nome = document.querySelector("#nome-cliente")?.value?.trim();
    finalizarPedidoWhatsApp(nome);
    fechar();
  });
}

function configurarLogin() {
  ouvirEstadoAuth((usuario) => {
    const btnAdmin = document.querySelector("#abrir-admin");
    const btnEntrar = document.querySelector("#btn-entrar");
    const btnSair = document.querySelector("#btn-sair");

    if (usuario) {
      btnEntrar?.setAttribute("hidden", "");
      btnSair?.removeAttribute("hidden");
      if (ehAdmin()) {
        btnAdmin?.removeAttribute("hidden");
        btnAdmin?.addEventListener("click", async () => {
          const modal = document.querySelector("#modal-admin");
          abrirModal(modal);
          await iniciarPainelAdmin(modal);
        }, { once: true });
      }
    } else {
      btnEntrar?.removeAttribute("hidden");
      btnSair?.setAttribute("hidden", "");
      btnAdmin?.setAttribute("hidden", "");
    }

    btnSair?.addEventListener("click", sair);
  });

  document.querySelectorAll("[data-tab-trigger]").forEach(tab => {
    tab.addEventListener("click", () => trocarAba(document.querySelector("#modal-admin"), tab.dataset.tabTrigger));
  });
}

function configurarModalAuth() {
  const modal = document.querySelector("#modal-login");
  if (!modal) return;

  modal.querySelectorAll("[data-auth-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      modal.querySelectorAll("[data-auth-tab]").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      modal.querySelector("#form-entrar-modal").hidden = btn.dataset.authTab !== "entrar";
      modal.querySelector("#form-cadastrar-modal").hidden = btn.dataset.authTab !== "cadastrar";
    });
  });

  modal.querySelector("#form-entrar-modal").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const erroEl = modal.querySelector("#erro-entrar-modal");
    erroEl.textContent = "";
    if (!podeExecutar("login", 5, 60_000)) {
      erroEl.textContent = "Muitas tentativas. Aguarde um minuto e tente novamente.";
      return;
    }
    try {
      await entrar(form.email.value, form.senha.value);
      fecharModal(modal);
      form.reset();
    } catch {
      erroEl.textContent = "Não foi possível entrar. Verifique seus dados.";
    }
  });

  modal.querySelector("#form-cadastrar-modal").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const erroEl = modal.querySelector("#erro-cadastrar-modal");
    erroEl.textContent = "";
    if (!podeExecutar("cadastrar", 3, 60_000)) {
      erroEl.textContent = "Muitas tentativas. Aguarde um minuto e tente novamente.";
      return;
    }
    try {
      await cadastrar(form.nome.value, form.email.value, form.senha.value);
      fecharModal(modal);
      form.reset();
    } catch {
      erroEl.textContent = "Não foi possível criar a conta.";
    }
  });
}

iniciar();
