// js/app.js
import {
  listarEtiquetas, escutarProdutos, escutarCategorias, escutarMarcas,
  criarPedido, listarPedidosUsuario, listarEnderecos, criarEndereco, excluirEndereco,
  atualizarPerfilUsuario, obterPerfilUsuario
} from "./firestore.js";
import { renderizarGrade, aplicarFiltros, ordenarProdutos, obterFavoritos, alternarFavorito } from "./products.js";
import { buscarProdutos } from "./search.js";
import {
  obterCarrinho, adicionarAoCarrinho, atualizarQuantidade, calcularTotais, atualizarBadgeCarrinho,
  finalizarPedidoWhatsApp, falarSobreProduto, registrarLeadPerdidoSeNecessario
} from "./cart.js";
import { formatBRL, escHtml, getQueryParam, toast, podeExecutar, podeExecutarPersistente, mascararCPF, mascararCNPJ, mascararTelefone, pareceEmail } from "./utils.js";
import { ouvirEstadoAuth, ehAdmin, entrar, cadastrar, sair, usuarioAtual, perfilAtual, redefinirSenha, atualizarNomeAuth } from "./auth.js";
import { iniciarModais, abrirModal, fecharModal, trocarAba } from "./modal.js";
import { iniciarPainelAdmin } from "./dashboard.js";
import { iniciarOrcamento } from "./orcamento.js";
import { ICONS, icon } from "./icons.js";
import { STORE_CONFIG } from "../firebase/firebase-config.js";

let TODOS_PRODUTOS = [];
let filtrosAtivos = {};

function iconeParaCategoria(nome = "") {
  const n = nome.toLowerCase();
  if (n.includes("escolar")) return "backpack";
  if (n.includes("inform") || n.includes("tecnolog") || n.includes("computa")) return "laptop";
  if (n.includes("arte") || n.includes("criativ")) return "palette";
  if (n.includes("impress")) return "printer";
  if (n.includes("cadern") || n.includes("bloco")) return "notebook";
  if (n.includes("canet") || n.includes("escrita")) return "pen";
  if (n.includes("escritório") || n.includes("escritorio")) return "briefcase";
  if (n.includes("organiz")) return "archive";
  if (n.includes("presente") || n.includes("premium") || n.includes("kit")) return "gift";
  return "tag";
}

const EMOJI_POR_CATEGORIA = {
  backpack: "🎒",
  laptop: "💻",
  palette: "🎨",
  printer: "🖨️",
  notebook: "📓",
  pen: "🖊️",
  archive: "🗄️",
  gift: "🎁",
  tag: "🏷️",
};

const COR_POR_CATEGORIA = {
  backpack: "#dbeafe",
  laptop: "#e0e7ff",
  palette: "#fce7f3",
  printer: "#f1f5f9",
  notebook: "#fee2e2",
  pen: "#e0f2fe",
  briefcase: "#fef3c7",
  archive: "#f5f0e8",
  gift: "#ede9fe",
  tag: "#f1f5f9",
};

const TEXTO_POR_CATEGORIA = {
  backpack: "#1d4ed8",
  laptop: "#4338ca",
  palette: "#be185d",
  printer: "#334155",
  notebook: "#b91c1c",
  pen: "#0369a1",
  briefcase: "#a16207",
  archive: "#78716c",
  gift: "#6d28d9",
  tag: "#475569",
};

function corParaCategoria(nome = "") {
  return COR_POR_CATEGORIA[iconeParaCategoria(nome)] || COR_POR_CATEGORIA.tag;
}

function corTextoParaCategoria(nome = "") {
  return TEXTO_POR_CATEGORIA[iconeParaCategoria(nome)] || TEXTO_POR_CATEGORIA.tag;
}

function conteudoIconeCategoria(c) {
  if (c.imagem) return `<img class="category-card__img" src="${c.imagem}" alt="" loading="lazy">`;
  const custom = (c.emoji || "").trim();
  if (!custom) return icon(iconeParaCategoria(c.nome));
  if (custom.startsWith("<svg")) return custom;
  return escHtml(custom);
}

function aplicarIconesEstaticos() {
  document.querySelectorAll("[data-icon]").forEach(el => {
    const nome = el.dataset.icon;
    if (ICONS[nome] && !el.querySelector("svg")) {
      el.innerHTML = ICONS[nome];
      el.classList.add("icon");
    }
  });
  const logo = document.querySelector("#admin-logo-icon");
  if (logo && !logo.querySelector("svg")) logo.innerHTML = ICONS.logo;
  document.querySelectorAll(".modal__close").forEach(el => {
    if (!el.querySelector("svg")) el.innerHTML = ICONS.close;
  });
}

async function iniciar() {
  iniciarModais();
  aplicarIconesEstaticos();
  atualizarBadgeCarrinho();

  escutarProdutos((produtos) => {
    TODOS_PRODUTOS = produtos;
    // Home mostra só uma prévia (5 colunas x 2 linhas); o catálogo completo
    // fica na página dedicada /pages/catalogo.html.
    renderizarGrade(document.querySelector("#grade-produtos"), TODOS_PRODUTOS.slice(0, 10));
    aplicarBuscaEFiltros(document.querySelector("#busca-header")?.value || "");
    renderizarDestaques();
    renderizarRecentes();
  }, { apenasAtivos: true });

  escutarCategorias((categorias) => {
    renderizarFiltros(categorias);
    const catUrl = getQueryParam("categoria");
    if (catUrl && !window.__categoriaAplicadaDaUrl) {
      window.__categoriaAplicadaDaUrl = true;
      selecionarCategoria(decodeURIComponent(catUrl));
    }
  });

  configurarLinksEstaticos();
  configurarEventosCategorias();
  iniciarOrcamento();

  document.querySelector("#btn-sair-conta")?.addEventListener("click", () => {
    sair();
    fecharModal(document.querySelector("#modal-conta"));
  });

  document.querySelectorAll("[data-scroll-top]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  document.querySelectorAll("[data-bottom-nav]").forEach(el => {
    el.addEventListener("click", () => {
      document.querySelectorAll(".bottom-nav__item").forEach(i => i.classList.remove("is-active"));
      el.classList.add("is-active");
    });
  });

  document.querySelector("#bottom-nav-conta")?.addEventListener("click", () => {
    const modal = usuarioAtual
      ? document.querySelector("#modal-conta")
      : document.querySelector("#modal-login");
    if (modal) abrirModal(modal);
  });

  document.querySelector("#toggle-categorias-grid")?.addEventListener("click", () => {
    document.querySelector("#categorias")?.scrollIntoView({ behavior: "smooth" });
  });

  const inputBusca = document.querySelector("#busca-header");
  document.querySelector(".search-bar")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const termo = inputBusca?.value?.trim() || "";
    window.location.href = termo
      ? `/pages/catalogo.html?q=${encodeURIComponent(termo)}`
      : "/pages/catalogo.html";
  });

  configurarCarrinhoUI();
  configurarLogin();
  configurarModalAuth();
  configurarMenuConta();

  document.addEventListener("adicionar-carrinho", (e) => {
    adicionarAoCarrinho(e.detail, 1);
    toast("Produto adicionado ao carrinho.");
  });
  document.addEventListener("falar-produto", (e) => {
    falarSobreProduto(e.detail);
  });

  function dadosLeadAtual() {
    const nomeDigitado = document.querySelector("#nome-cliente")?.value?.trim();
    const nome = usuarioAtual
      ? (nomeDigitado && !pareceEmail(nomeDigitado) ? nomeDigitado
        : [usuarioAtual.displayName, perfilAtual?.nome, perfilAtual?.responsavel, perfilAtual?.razaoSocial].find(c => c && !pareceEmail(c)) || "")
      : (nomeDigitado && !pareceEmail(nomeDigitado) ? nomeDigitado : "");
    const telefone = perfilAtual?.telefone || "";
    return { nome, telefone };
  }

  window.addEventListener("beforeunload", () => registrarLeadPerdidoSeNecessario(dadosLeadAtual()));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") registrarLeadPerdidoSeNecessario(dadosLeadAtual());
  });
}

function aplicarBuscaEFiltros(termo = "") {
  const termoLimpo = termo.trim();
  const secao = document.querySelector("#resultados-busca");
  const temFiltro = !!termoLimpo || !!filtrosAtivos.categoria;

  if (!temFiltro) {
    if (secao) secao.hidden = true;
    return;
  }

  let lista = buscarProdutos(TODOS_PRODUTOS, termoLimpo);
  lista = aplicarFiltros(lista, filtrosAtivos);
  renderizarGrade(document.querySelector("#grade-resultados"), lista);

  const titulo = document.querySelector("#resultados-busca-titulo");
  if (titulo) {
    const partes = [];
    if (termoLimpo) partes.push(`"${termoLimpo}"`);
    if (filtrosAtivos.categoria) partes.push(filtrosAtivos.categoria);
    titulo.textContent = `Resultados para ${partes.join(" em ")} (${lista.length})`;
  }
  if (secao) secao.hidden = false;
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

function renderizarFiltros(categorias) {
  const seletor = document.querySelector("#filtro-categoria");
  if (seletor) {
    const valorAtual = seletor.value;
    seletor.innerHTML = `<option value="">Todas as categorias</option>` +
      categorias.map(c => `<option value="${escHtml(c.nome)}">${escHtml(c.nome)}</option>`).join("");
    seletor.value = valorAtual;
  }

  const navLinks = document.querySelector("#header-nav-links");
  if (navLinks) {
    navLinks.innerHTML = categorias.slice(0, 6)
      .map(c => `<button type="button" data-categoria-nome="${escHtml(c.nome)}">${escHtml(c.nome)}</button>`).join("");
  }

  const grid = document.querySelector("#grade-categorias");
  if (grid) {
    grid.innerHTML = categorias.length
      ? categorias.map(c => `
        <button type="button" class="category-card" data-categoria-nome="${escHtml(c.nome)}">
          <span class="category-card__icon" style="background:${corParaCategoria(c.nome)};color:${corTextoParaCategoria(c.nome)}">${conteudoIconeCategoria(c)}</span>
          <span>${escHtml(c.nome)}</span>
        </button>`).join("")
      : `<div class="empty-state">Nenhuma categoria cadastrada ainda.</div>`;
  }
}

function configurarEventosCategorias() {
  document.querySelector("#filtro-categoria")?.addEventListener("change", (e) => {
    filtrosAtivos.categoria = e.target.value || undefined;
    aplicarBuscaEFiltros(document.querySelector("#busca-header")?.value || "");
    document.querySelector("#resultados-busca")?.scrollIntoView({ behavior: "smooth" });
  });
  document.querySelector("#header-nav-links")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-categoria-nome]");
    if (btn) selecionarCategoria(btn.dataset.categoriaNome);
  });
  document.querySelector("#grade-categorias")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-categoria-nome]");
    if (btn) selecionarCategoria(btn.dataset.categoriaNome);
  });
  document.querySelector("#limpar-resultados")?.addEventListener("click", () => {
    filtrosAtivos.categoria = undefined;
    const seletor = document.querySelector("#filtro-categoria");
    if (seletor) seletor.value = "";
    const inputBusca = document.querySelector("#busca-header");
    if (inputBusca) inputBusca.value = "";
    aplicarBuscaEFiltros("");
  });
}

function selecionarCategoria(nome) {
  const seletor = document.querySelector("#filtro-categoria");
  if (seletor) seletor.value = nome;
  filtrosAtivos.categoria = nome || undefined;
  aplicarBuscaEFiltros(document.querySelector("#busca-header")?.value || "");
  document.querySelector("#resultados-busca")?.scrollIntoView({ behavior: "smooth" });
}

function configurarLinksEstaticos() {
  const numero = STORE_CONFIG.whatsapp;
  const mensagem = encodeURIComponent(`Olá! Vim do site da ${STORE_CONFIG.nome} e gostaria de fazer um pedido.`);
  document.querySelectorAll("#hero-whatsapp, #whatsapp-cta-link").forEach(a => {
    a.href = `https://wa.me/${numero}?text=${mensagem}`;
  });

  const marcasEl = document.querySelector("#marcas-parceiras");
  if (marcasEl) {
    escutarMarcas((marcas) => {
      const lista = [...marcas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      marcasEl.innerHTML = lista
        .map(m => `<span class="brands__badge"><img src="${m.logo || "/assets/images/placeholder.svg"}" alt="${escHtml(m.nome)}" loading="lazy"></span>`)
        .join("") || "";
    });
  }

  const depoimentos = document.querySelector("#depoimentos");
  if (depoimentos) {
    const lista = [
      { nome: "João Silva", texto: "Entrega super rápida e produtos de excelente qualidade. Recomendo!" },
      { nome: "Maria Fernanda", texto: "Ótimo atendimento no WhatsApp e preços muito justos." },
      { nome: "Carlos Eduardo", texto: "Minha papelaria preferida! Sempre encontro tudo o que preciso." }
    ];
    depoimentos.innerHTML = lista.map(d => `
      <div class="testimonial-card">
        <div class="testimonial-card__stars">${icon("star")}${icon("star")}${icon("star")}${icon("star")}${icon("star")}</div>
        <p>"${escHtml(d.texto)}"</p>
        <div class="testimonial-card__author">
          <span class="testimonial-card__avatar">${escHtml(d.nome.split(" ").map(p => p[0]).slice(0, 2).join(""))}</span>
          <strong>${escHtml(d.nome)}</strong>
        </div>
      </div>`).join("");
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
        <img src="${item.imagem || "/assets/images/placeholder.svg"}" alt="${escHtml(item.nome)}" loading="lazy">
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
    const campoNome = document.querySelector("#campo-nome-convidado");
    if (campoNome) campoNome.hidden = !!usuarioAtual;
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

  document.querySelector("#finalizar-pedido")?.addEventListener("click", async () => {
    const carrinho = obterCarrinho();
    if (!carrinho.length) { toast("Seu carrinho está vazio.", "error"); return; }
    if (!podeExecutar("finalizar-pedido", 5, 60_000)) {
      toast("Muitos pedidos em pouco tempo. Aguarde um instante.", "error");
      return;
    }
    const nome = document.querySelector("#nome-cliente")?.value?.trim();
    const candidatosPerfil = [usuarioAtual?.displayName, perfilAtual?.nome, perfilAtual?.responsavel, perfilAtual?.razaoSocial];
    const nomeDoPerfil = candidatosPerfil.find(c => c && !pareceEmail(c)) || "";
    const nomeParaPedido = usuarioAtual
      ? ((nome && !pareceEmail(nome)) ? nome : nomeDoPerfil)
      : (nome && !pareceEmail(nome) ? nome : "");
    if (usuarioAtual) {
      const { total } = calcularTotais();
      criarPedido({
        usuarioId: usuarioAtual.uid,
        nomeCliente: nomeParaPedido,
        itens: carrinho.map(i => ({ id: i.id, nome: i.nome, quantidade: i.quantidade, preco: i.preco })),
        total
      }).catch(() => {});
    }
    finalizarPedidoWhatsApp(nomeParaPedido);
    fechar();
  });
}

function configurarLogin() {
  let jaAbriuViaParam = false;
  ouvirEstadoAuth((usuario) => {
    const btnAdmin = document.querySelector("#abrir-admin");
    const btnEntrar = document.querySelector("#btn-entrar");
    const btnSair = document.querySelector("#btn-sair");
    const btnMinhaConta = document.querySelector("#btn-minha-conta");

    if (usuario) {
      btnEntrar?.setAttribute("hidden", "");
      btnSair?.removeAttribute("hidden");
      btnMinhaConta?.removeAttribute("hidden");
      const nomeEl = document.querySelector("#conta-nome");
      const emailEl = document.querySelector("#conta-email");
      if (nomeEl) nomeEl.textContent = usuario.displayName ? `Olá, ${usuario.displayName}!` : "Olá!";
      if (emailEl) emailEl.textContent = usuario.email || "";
      if (ehAdmin()) {
        btnAdmin?.removeAttribute("hidden");
        if (btnAdmin && !btnAdmin.dataset.bound) {
          btnAdmin.dataset.bound = "1";
          btnAdmin.addEventListener("click", async () => {
            const modal = document.querySelector("#modal-admin");
            abrirModal(modal);
            await iniciarPainelAdmin(modal);
          });
        }
      }
    } else {
      btnEntrar?.removeAttribute("hidden");
      btnSair?.setAttribute("hidden", "");
      btnMinhaConta?.setAttribute("hidden", "");
      btnAdmin?.setAttribute("hidden", "");
    }

    btnSair?.addEventListener("click", sair);

    // Veio de outra página (produto/catálogo) pedindo pra abrir um modal
    // específico — ex: /?abrir=login vindo do botão "Entrar" da produto.html.
    if (!jaAbriuViaParam) {
      jaAbriuViaParam = true;
      const abrir = getQueryParam("abrir");
      if (abrir === "login" && !usuario) {
        abrirModal(document.querySelector("#modal-login"));
      } else if (abrir === "conta" && usuario) {
        abrirModal(document.querySelector("#modal-conta"));
      } else if (abrir === "admin" && usuario && ehAdmin()) {
        const modal = document.querySelector("#modal-admin");
        abrirModal(modal);
        iniciarPainelAdmin(modal);
      }
      if (abrir) {
        const url = new URL(window.location.href);
        url.searchParams.delete("abrir");
        window.history.replaceState({}, "", url);
      }
    }
  });

  document.querySelectorAll("[data-tab-trigger]").forEach(tab => {
    tab.addEventListener("click", () => trocarAba(document.querySelector("#modal-admin"), tab.dataset.tabTrigger));
  });
}

function configurarModalAuth() {
  const modal = document.querySelector("#modal-login");
  if (!modal) return;

  function mostrarView(view) {
    modal.querySelector("#form-entrar-modal").hidden = view !== "entrar";
    modal.querySelector("#form-esqueci-senha").hidden = view !== "esqueci";
    modal.querySelector("#form-cadastrar-modal").hidden = view !== "cadastrar";
    modal.querySelector(".auth-tabs:not(.auth-tabs--tipo)").hidden = view === "esqueci";
  }

  modal.querySelectorAll("[data-auth-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      modal.querySelectorAll("[data-auth-tab]").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      mostrarView(btn.dataset.authTab);
    });
  });

  modal.querySelector("#link-esqueci-senha").addEventListener("click", () => mostrarView("esqueci"));
  modal.querySelector("#voltar-esqueci-senha").addEventListener("click", () => {
    modal.querySelectorAll("[data-auth-tab]").forEach(b => b.classList.toggle("is-active", b.dataset.authTab === "entrar"));
    mostrarView("entrar");
  });

  // mostrar/ocultar senha em qualquer campo do modal
  modal.querySelectorAll("[data-toggle-senha]").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = btn.previousElementSibling;
      const mostrando = input.type === "text";
      input.type = mostrando ? "password" : "text";
      btn.innerHTML = mostrando ? ICONS.eye : ICONS.eyeOff;
      btn.setAttribute("aria-label", mostrando ? "Mostrar senha" : "Ocultar senha");
    });
  });

  // pessoa física / empresa no cadastro
  modal.querySelectorAll("[data-tipo-conta]").forEach(btn => {
    btn.addEventListener("click", () => {
      modal.querySelectorAll("[data-tipo-conta]").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const tipo = btn.dataset.tipoConta;
      modal.querySelector('input[name="tipoConta"]').value = tipo;
      modal.querySelector('[data-campos-tipo="fisica"]').hidden = tipo !== "fisica";
      modal.querySelector('[data-campos-tipo="empresa"]').hidden = tipo !== "empresa";
    });
  });

  // máscaras de CPF, CNPJ e telefone, aplicadas enquanto a pessoa digita
  const campoCpf = modal.querySelector('input[name="cpf"]');
  campoCpf?.addEventListener("input", () => { campoCpf.value = mascararCPF(campoCpf.value); });

  const campoCnpj = modal.querySelector('input[name="cnpj"]');
  campoCnpj?.addEventListener("input", () => { campoCnpj.value = mascararCNPJ(campoCnpj.value); });

  modal.querySelectorAll('input[name="telefone"], input[name="telefoneEmpresa"]').forEach(campo => {
    campo.addEventListener("input", () => { campo.value = mascararTelefone(campo.value); });
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
      await entrar(form.email.value, form.senha.value, form.manterLogin.checked);
      fecharModal(modal);
      form.reset();
    } catch {
      erroEl.textContent = "Não foi possível entrar. Verifique seus dados.";
    }
  });

  modal.querySelector("#form-esqueci-senha").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const erroEl = modal.querySelector("#erro-esqueci-senha");
    const sucessoEl = modal.querySelector("#sucesso-esqueci-senha");
    erroEl.textContent = "";
    sucessoEl.hidden = true;

    const email = form.email.value.trim().toLowerCase();
    const chave = `reset-senha-${email}`;
    // até 5 tentativas por e-mail, depois bloqueia por 1h (persiste mesmo fechando a aba)
    if (!podeExecutarPersistente(chave, 5, 60 * 60_000)) {
      erroEl.textContent = "Muitas tentativas para este e-mail. Tente novamente mais tarde.";
      return;
    }
    try {
      await redefinirSenha(email);
      sucessoEl.textContent = "Link enviado! Pode levar alguns minutos — se não chegar, confira a caixa de spam/lixo eletrônico ou promoções.";
      sucessoEl.hidden = false;
      form.reset();
    } catch {
      erroEl.textContent = "Não foi possível enviar o link. Confira o e-mail digitado.";
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
    if (form.senha.value !== form.confirmarSenha.value) {
      erroEl.textContent = "As senhas não coincidem.";
      return;
    }
    const tipoConta = form.tipoConta.value;
    const dados = tipoConta === "empresa"
      ? {
          email: form.email.value, senha: form.senha.value, tipoConta,
          razaoSocial: form.razaoSocial.value.trim(),
          cnpj: form.cnpj.value.trim(),
          responsavel: form.responsavel.value.trim(),
          telefone: form.telefoneEmpresa.value.trim()
        }
      : {
          email: form.email.value, senha: form.senha.value, tipoConta,
          nome: form.nome.value.trim(),
          cpf: form.cpf.value.trim(),
          telefone: form.telefone.value.trim()
        };
    try {
      await cadastrar(dados);
      fecharModal(modal);
      form.reset();
    } catch {
      erroEl.textContent = "Não foi possível criar a conta.";
    }
  });
}

function formatarMesAno(isoString) {
  if (!isoString) return "";
  const data = new Date(isoString);
  if (isNaN(data)) return "";
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[data.getMonth()]}/${data.getFullYear()}`;
}

function formatarDataBR(isoDate) {
  if (!isoDate) return "";
  const [ano, mes, dia] = isoDate.split("-");
  if (!ano || !mes || !dia) return "";
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${parseInt(dia, 10)} de ${meses[parseInt(mes, 10) - 1]} de ${ano}`;
}

function renderizarPerfil() {
  if (!usuarioAtual) return;
  const primeiroNome = (perfilAtual?.nome || usuarioAtual.displayName || "").split(" ")[0];
  document.querySelector("#perfil-saudacao").textContent = primeiroNome ? `Olá, ${primeiroNome}! 👋` : "Olá! 👋";
  document.querySelector("#perfil-email-hero").textContent = usuarioAtual.email || "";
  document.querySelector("#perfil-membro-desde").textContent = perfilAtual?.criadoEm ? `Membro desde ${formatarMesAno(perfilAtual.criadoEm)}` : "";

  document.querySelector("#perfil-view-nome").textContent = perfilAtual?.nome || usuarioAtual.displayName || "Não informado";
  document.querySelector("#perfil-view-email").textContent = usuarioAtual.email || "—";
  document.querySelector("#perfil-view-telefone").textContent = perfilAtual?.telefone || "Não informado";
  document.querySelector("#perfil-view-nascimento").textContent = formatarDataBR(perfilAtual?.dataNascimento) || "Não informado";
}

async function dispararRedefinicaoSenha() {
  if (!usuarioAtual?.email) return;
  const chave = `reset-senha-${usuarioAtual.email.toLowerCase()}`;
  if (!podeExecutarPersistente(chave, 5, 60 * 60_000)) {
    toast("Muitas tentativas. Tente novamente mais tarde.", "error");
    return;
  }
  await redefinirSenha(usuarioAtual.email);
  toast("Link enviado! Se não chegar em alguns minutos, confira a caixa de spam ou promoções.");
}

function abrirSubModalConta(idModal) {
  fecharModal(document.querySelector("#modal-conta"));
  const modal = document.querySelector(idModal);
  if (modal) abrirModal(modal);
  return modal;
}

async function renderizarPedidos() {
  const container = document.querySelector("#lista-pedidos");
  if (!container || !usuarioAtual) return;
  container.innerHTML = `<div class="empty-state">Carregando...</div>`;
  const pedidos = await listarPedidosUsuario(usuarioAtual.uid);
  container.innerHTML = pedidos.length ? pedidos.map(p => `
    <div class="pedido-card">
      <div class="pedido-card__head">
        <strong>${formatBRL(p.total || 0)}</strong>
        <span class="pedido-card__status">${escHtml(p.status || "pendente")}</span>
      </div>
      <p class="pedido-card__itens">${(p.itens || []).map(i => `${i.quantidade}x ${escHtml(i.nome)}`).join(", ")}</p>
    </div>`).join("") : `<div class="empty-state">Você ainda não fez nenhum pedido.</div>`;
}

async function renderizarEnderecos() {
  const lista = document.querySelector("#lista-enderecos");
  if (!lista || !usuarioAtual) return;
  const enderecos = await listarEnderecos(usuarioAtual.uid);
  lista.innerHTML = enderecos.length ? enderecos.map(e => `
    <li class="endereco-card" data-id="${e.id}">
      <div class="endereco-card__info">
        <strong>${escHtml(e.apelido)}</strong>
        <span>${escHtml(e.rua)}, ${escHtml(e.numero)} - ${escHtml(e.bairro)}, ${escHtml(e.cidade)}${e.cep ? " - " + escHtml(e.cep) : ""}</span>
      </div>
      <button type="button" data-excluir-endereco="${e.id}" class="account-menu__icon">${icon("trash")}</button>
    </li>`).join("") : `<div class="empty-state">Nenhum endereço cadastrado ainda.</div>`;

  lista.querySelectorAll("[data-excluir-endereco]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await excluirEndereco(btn.dataset.excluirEndereco);
      renderizarEnderecos();
    });
  });
}

async function renderizarFavoritos() {
  const container = document.querySelector("#lista-favoritos");
  if (!container) return;
  const ids = obterFavoritos();
  const produtos = TODOS_PRODUTOS.filter(p => ids.includes(p.id));
  container.innerHTML = produtos.length ? produtos.map(p => `
    <div class="favorito-card" data-id="${p.id}">
      <img src="${p.imagem || "/assets/images/placeholder.svg"}" alt="${escHtml(p.nome)}" loading="lazy">
      <div class="favorito-card__info">
        <strong>${escHtml(p.nome)}</strong>
        <span>${formatBRL(p.preco)}</span>
      </div>
      <div class="favorito-card__acoes">
        <button type="button" data-add-favorito="${p.id}" class="account-menu__icon" aria-label="Adicionar ao carrinho">${icon("cart")}</button>
        <button type="button" data-remover-favorito="${p.id}" class="account-menu__icon" aria-label="Remover dos favoritos">${icon("trash")}</button>
      </div>
    </div>`).join("") : `<div class="empty-state">Você ainda não favoritou nenhum produto.</div>`;

  container.querySelectorAll("[data-remover-favorito]").forEach(btn => {
    btn.addEventListener("click", () => {
      alternarFavorito(btn.dataset.removerFavorito);
      renderizarFavoritos();
    });
  });
  container.querySelectorAll("[data-add-favorito]").forEach(btn => {
    btn.addEventListener("click", () => {
      const produto = TODOS_PRODUTOS.find(p => p.id === btn.dataset.addFavorito);
      if (produto) { adicionarAoCarrinho(produto, 1); toast("Produto adicionado ao carrinho."); }
    });
  });
}

function configurarMenuConta() {
  document.querySelector("#btn-abrir-perfil")?.addEventListener("click", () => {
    abrirSubModalConta("#modal-perfil");
    renderizarPerfil();
  });
  document.querySelector("#btn-abrir-perfil")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.target.click(); }
  });

  document.querySelector("#btn-editar-perfil")?.addEventListener("click", () => {
    const form = document.querySelector("#form-editar-perfil");
    form.nome.value = perfilAtual?.nome || usuarioAtual?.displayName || "";
    form.telefone.value = perfilAtual?.telefone || "";
    form.dataNascimento.value = perfilAtual?.dataNascimento || "";
    document.querySelector("#perfil-visualizacao").hidden = true;
    document.querySelector("#btn-editar-perfil").hidden = true;
    form.hidden = false;
    form.nome.focus();
  });

  document.querySelector("#btn-cancelar-editar-perfil")?.addEventListener("click", () => {
    document.querySelector("#form-editar-perfil").hidden = true;
    document.querySelector("#perfil-visualizacao").hidden = false;
    document.querySelector("#btn-editar-perfil").hidden = false;
  });

  document.querySelector('#form-editar-perfil input[name="telefone"]')?.addEventListener("input", (e) => {
    e.target.value = mascararTelefone(e.target.value);
  });

  document.querySelector("#form-editar-perfil")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!usuarioAtual) return;
    const form = e.target;
    const nome = form.nome.value.trim();
    const dados = {
      nome,
      telefone: form.telefone.value.trim(),
      dataNascimento: form.dataNascimento.value
    };
    await atualizarPerfilUsuario(usuarioAtual.uid, dados);
    if (nome) await atualizarNomeAuth(nome);
    if (perfilAtual) Object.assign(perfilAtual, dados);

    document.querySelector("#conta-nome").textContent = nome ? `Olá, ${nome}!` : "Olá!";
    form.hidden = true;
    document.querySelector("#perfil-visualizacao").hidden = false;
    document.querySelector("#btn-editar-perfil").hidden = false;
    renderizarPerfil();
    toast("Perfil atualizado.");
  });

  document.querySelector("#btn-alterar-senha-perfil")?.addEventListener("click", dispararRedefinicaoSenha);

  document.querySelector("#btn-abrir-pedidos")?.addEventListener("click", () => {
    abrirSubModalConta("#modal-pedidos");
    renderizarPedidos();
  });

  document.querySelector("#btn-abrir-enderecos")?.addEventListener("click", () => {
    abrirSubModalConta("#modal-enderecos");
    renderizarEnderecos();
  });

  document.querySelector("#btn-abrir-pagamento")?.addEventListener("click", async () => {
    abrirSubModalConta("#modal-pagamento");
    if (usuarioAtual) {
      const perfil = await obterPerfilUsuario(usuarioAtual.uid);
      const form = document.querySelector("#form-pagamento");
      if (perfil?.formaPagamentoPreferida && form) {
        const input = form.querySelector(`input[value="${perfil.formaPagamentoPreferida}"]`);
        if (input) input.checked = true;
      }
    }
  });

  document.querySelector("#btn-abrir-favoritos")?.addEventListener("click", () => {
    abrirSubModalConta("#modal-favoritos");
    renderizarFavoritos();
  });

  document.querySelector("#btn-abrir-configuracoes")?.addEventListener("click", async () => {
    abrirSubModalConta("#modal-configuracoes");
    if (usuarioAtual) {
      const perfil = await obterPerfilUsuario(usuarioAtual.uid);
      const toggle = document.querySelector("#toggle-notificacoes");
      if (toggle) toggle.checked = !!perfil?.notificacoesPromocoes;
    }
  });

  document.querySelector("#form-endereco")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!usuarioAtual) return;
    const form = e.target;
    await criarEndereco(usuarioAtual.uid, {
      apelido: form.apelido.value.trim(),
      rua: form.rua.value.trim(),
      numero: form.numero.value.trim(),
      bairro: form.bairro.value.trim(),
      cidade: form.cidade.value.trim(),
      cep: form.cep.value.trim()
    });
    form.reset();
    renderizarEnderecos();
    toast("Endereço salvo.");
  });

  document.querySelector("#form-pagamento")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!usuarioAtual) return;
    const forma = e.target.forma.value;
    if (!forma) { toast("Escolha uma forma de pagamento.", "error"); return; }
    await atualizarPerfilUsuario(usuarioAtual.uid, { formaPagamentoPreferida: forma });
    toast("Preferência salva.");
  });

  document.querySelector("#toggle-notificacoes")?.addEventListener("change", async (e) => {
    if (!usuarioAtual) return;
    await atualizarPerfilUsuario(usuarioAtual.uid, { notificacoesPromocoes: e.target.checked });
    toast("Preferência atualizada.");
  });

  document.querySelector("#btn-alterar-senha")?.addEventListener("click", dispararRedefinicaoSenha);
}

iniciar();
