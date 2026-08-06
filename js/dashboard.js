// js/dashboard.js
import {
  listarProdutos, criarProduto, atualizarProduto, excluirProduto, duplicarProduto,
  listarCategorias, criarCategoria, atualizarCategoria, excluirCategoria,
  listarEtiquetas, criarEtiqueta, excluirEtiqueta,
  listarMarcas, criarMarca, atualizarMarca, excluirMarca,
  ajustarEstoque, listarUsuarios
} from "./firestore.js";
import { formatBRL, escHtml, generateCode, compressImageToBase64, toast } from "./utils.js";
import { carregarPainelLeads } from "./leads.js";
import { ICONS, icon } from "./icons.js";

let cacheProdutos = [];
let cacheCategorias = [];
let cacheEtiquetas = [];

export async function iniciarPainelAdmin(root) {
  await carregarDashboard(root.querySelector("#painel-dashboard"));
  await carregarAbaProdutos(root.querySelector("#painel-produtos"));
  await carregarAbaCategorias(root.querySelector("#painel-categorias"));
  await carregarAbaMarcas(root.querySelector("#painel-marcas"));
  await carregarAbaEtiquetas(root.querySelector("#painel-etiquetas"));
  await carregarAbaEstoque(root.querySelector("#painel-estoque"));
  await carregarPainelLeads(root.querySelector("#painel-leads"));
  await carregarAbaUsuarios(root.querySelector("#painel-usuarios"));
}

// ---------- DASHBOARD ----------
async function carregarDashboard(container) {
  if (!container) return;
  const produtos = await listarProdutos({ apenasAtivos: false });
  const categorias = await listarCategorias();
  const usuarios = await listarUsuarios();
  const semEstoque = produtos.filter(p => Number(p.quantidade) <= 0).length;
  const maisVistos = [...produtos].sort((a, b) => (b.visualizacoes || 0) - (a.visualizacoes || 0)).slice(0, 5);
  const maisCompartilhados = [...produtos].sort((a, b) => (b.compartilhamentos || 0) - (a.compartilhamentos || 0)).slice(0, 5);

  container.innerHTML = `
    <div class="admin-panel-head">
      <h1>Dashboard</h1>
      <p>Visão geral do desempenho da sua loja.</p>
    </div>
    <div class="dash-grid">
      <div class="stat-card"><span>${produtos.length}</span><label>Produtos</label></div>
      <div class="stat-card"><span>${categorias.length}</span><label>Categorias</label></div>
      <div class="stat-card"><span>${produtos.reduce((a, p) => a + Number(p.quantidade || 0), 0)}</span><label>Itens em estoque</label></div>
      <div class="stat-card stat-card--warn"><span>${semEstoque}</span><label>Sem estoque</label></div>
      <div class="stat-card"><span>${usuarios.length}</span><label>Usuários</label></div>
    </div>
    <div class="dash-lists">
      <div class="dash-list">
        <h4>Produtos mais vistos</h4>
        <ol>${maisVistos.map(p => `<li>${escHtml(p.nome)} <span>${p.visualizacoes || 0}</span></li>`).join("") || "<li>Sem dados ainda</li>"}</ol>
      </div>
      <div class="dash-list">
        <h4>Produtos mais compartilhados</h4>
        <ol>${maisCompartilhados.map(p => `<li>${escHtml(p.nome)} <span>${p.compartilhamentos || 0}</span></li>`).join("") || "<li>Sem dados ainda</li>"}</ol>
      </div>
    </div>`;
}

// ---------- PRODUTOS ----------
async function carregarAbaProdutos(container) {
  if (!container) return;
  cacheProdutos = await listarProdutos({ apenasAtivos: false });
  cacheCategorias = await listarCategorias();
  cacheEtiquetas = await listarEtiquetas();

  container.innerHTML = `
    <div class="admin-panel-head">
      <h1>Produtos</h1>
      <p>Adicione, edite e gerencie os produtos da sua loja.</p>
    </div>
    <div class="admin-toolbar">
      <div class="input-icon">
        ${icon("search")}
        <input type="text" id="busca-admin-produtos" placeholder="Pesquisar produtos..." autocomplete="off">
      </div>
      <div class="select-icon">
        ${icon("sort")}
        <select id="ordenar-admin-produtos">
          <option value="">Ordenar: Mais recentes</option>
          <option value="nome">Nome</option>
          <option value="preco_asc">Menor preço</option>
          <option value="preco_desc">Maior preço</option>
        </select>
      </div>
      <button class="btn-primary" id="btn-novo-produto">${icon("plus")}Novo produto</button>
    </div>
    <div class="table-wrap"><table class="admin-table" id="tabela-produtos">
      <thead><tr><th></th><th>Nome</th><th>Categoria</th><th>Preço</th><th>Qtd</th><th>Status</th><th>Ações</th></tr></thead>
      <tbody></tbody>
    </table></div>
    <p class="table-count" id="contagem-produtos"></p>
    <dialog id="dialog-produto" class="dialog-form"></dialog>`;

  renderizarTabelaProdutos(container, cacheProdutos);

  container.querySelector("#busca-admin-produtos").addEventListener("input", (e) => {
    const termo = e.target.value.toLowerCase();
    const filtrados = cacheProdutos.filter(p => p.nome.toLowerCase().includes(termo));
    renderizarTabelaProdutos(container, filtrados);
  });

  container.querySelector("#ordenar-admin-produtos").addEventListener("change", (e) => {
    const criterio = e.target.value;
    const lista = [...cacheProdutos];
    if (criterio === "nome") lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    if (criterio === "preco_asc") lista.sort((a, b) => a.preco - b.preco);
    if (criterio === "preco_desc") lista.sort((a, b) => b.preco - a.preco);
    renderizarTabelaProdutos(container, lista);
  });

  container.querySelector("#btn-novo-produto").addEventListener("click", () => abrirFormularioProduto(container));
}

function renderizarTabelaProdutos(container, produtos) {
  const tbody = container.querySelector("#tabela-produtos tbody");
  const contagem = container.querySelector("#contagem-produtos");
  if (contagem) contagem.textContent = `Mostrando ${produtos.length} de ${produtos.length} produtos`;

  tbody.innerHTML = produtos.map(p => `
    <tr data-id="${p.id}">
      <td><img class="thumb" src="${p.imagem || "/assets/images/placeholder.svg"}" alt=""></td>
      <td>${escHtml(p.nome)}</td>
      <td>${escHtml(p.categoria || "-")}</td>
      <td>${formatBRL(p.preco)}</td>
      <td>${p.quantidade ?? 0}</td>
      <td><span class="status-pill status-${p.status}">${escHtml(p.status)}</span></td>
      <td class="row-actions">
        <button data-action="editar" title="Editar">${icon("pencil")}</button>
        <button data-action="duplicar" title="Duplicar">${icon("copy")}</button>
        <button data-action="excluir" title="Excluir">${icon("trash")}</button>
      </td>
    </tr>`).join("") || `<tr><td colspan="7">
      <div class="empty-state">
        ${icon("gridEmpty", "empty-state__icon")}
        <strong>Nenhum produto cadastrado</strong>
        <p>Comece adicionando seu primeiro produto à sua loja.</p>
        <button type="button" class="btn-secondary" id="btn-primeiro-produto">${icon("plus")}Adicionar primeiro produto</button>
      </div>
    </td></tr>`;

  tbody.querySelector("#btn-primeiro-produto")?.addEventListener("click", () => abrirFormularioProduto(container));

  tbody.querySelectorAll("tr").forEach(tr => {
    const id = tr.dataset.id;
    const produto = produtos.find(p => p.id === id);
    tr.querySelector('[data-action="editar"]')?.addEventListener("click", () => abrirFormularioProduto(container, produto));
    tr.querySelector('[data-action="duplicar"]')?.addEventListener("click", async () => {
      await duplicarProduto(produto);
      toast("Produto duplicado.");
      carregarAbaProdutos(container);
    });
    tr.querySelector('[data-action="excluir"]')?.addEventListener("click", async () => {
      if (confirm(`Excluir "${produto.nome}"?`)) {
        await excluirProduto(id);
        toast("Produto excluído.");
        carregarAbaProdutos(container);
      }
    });
  });
}

async function abrirFormularioProduto(container, produto = null) {
  const dialog = container.querySelector("#dialog-produto");
  cacheCategorias = await listarCategorias();
  const opcoesCategoria = cacheCategorias.map(c => `<option value="${escHtml(c.nome)}" ${produto?.categoria === c.nome ? "selected" : ""}>${escHtml(c.nome)}</option>`).join("");
  const opcoesEtiquetas = cacheEtiquetas.map(e => `
    <label class="chip-check">
      <input type="checkbox" value="${escHtml(e.nome)}" ${(produto?.etiquetas || []).includes(e.nome) ? "checked" : ""}> ${escHtml(e.nome)}
    </label>`).join("");

  dialog.innerHTML = `
    <form id="form-produto" class="product-form">
      <h3>${produto ? "Editar produto" : "Novo produto"}</h3>
      <div class="form-grid">
        <label>Nome<input name="nome" required autocomplete="off" value="${escHtml(produto?.nome || "")}"></label>
        <label>Marca<input name="marca" autocomplete="off" value="${escHtml(produto?.marca || "")}"></label>
        <label>Preço (R$)<input name="preco" type="number" step="0.01" required value="${produto?.preco ?? ""}"></label>
        <label>Quantidade<input name="quantidade" type="number" required value="${produto?.quantidade ?? 0}"></label>
        <label>Categoria<select name="categoria"><option value="">Selecione</option>${opcoesCategoria}</select></label>
        <label>Status
          <select name="status">
            <option value="disponivel" ${produto?.status === "disponivel" ? "selected" : ""}>Disponível</option>
            <option value="sem_estoque" ${produto?.status === "sem_estoque" ? "selected" : ""}>Sem estoque</option>
            <option value="oculto" ${produto?.status === "oculto" ? "selected" : ""}>Oculto</option>
          </select>
        </label>
        <label>Código<input name="codigo" autocomplete="off" value="${escHtml(produto?.codigo || generateCode())}"></label>
        <label>Imagem<input name="imagem" type="file" accept="image/*"></label>
      </div>
      <label>Descrição<textarea name="descricao" rows="3">${escHtml(produto?.descricao || "")}</textarea></label>
      <fieldset class="chip-group"><legend>Etiquetas</legend>${opcoesEtiquetas || "<em>Nenhuma etiqueta cadastrada</em>"}</fieldset>
      <div class="form-actions">
        <button type="button" data-modal-close-dialog>Cancelar</button>
        <button type="submit" class="btn-primary">Salvar</button>
      </div>
    </form>`;

  dialog.showModal();
  dialog.querySelector("[data-modal-close-dialog]").addEventListener("click", () => dialog.close());

  dialog.querySelector("#form-produto").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const dados = {
      nome: form.nome.value.trim(),
      marca: form.marca.value.trim(),
      preco: parseFloat(form.preco.value),
      quantidade: parseInt(form.quantidade.value, 10),
      categoria: form.categoria.value,
      status: form.status.value,
      codigo: form.codigo.value.trim(),
      descricao: form.descricao.value.trim(),
      etiquetas: [...form.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value)
    };

    const arquivoImagem = form.imagem.files[0];
    if (arquivoImagem) {
      dados.imagem = await compressImageToBase64(arquivoImagem);
    } else if (produto?.imagem) {
      dados.imagem = produto.imagem;
    }

    if (produto) {
      await atualizarProduto(produto.id, dados);
      toast("Produto atualizado.");
    } else {
      await criarProduto(dados);
      toast("Produto cadastrado.");
    }
    dialog.close();
    carregarAbaProdutos(container);
  });
}

// ---------- CATEGORIAS ----------
async function carregarAbaCategorias(container) {
  if (!container) return;
  const categorias = await listarCategorias();
  container.innerHTML = `
    <div class="admin-panel-head">
      <h1>Categorias</h1>
      <p>Organize seus produtos em categorias e escolha um emoji para cada uma.</p>
    </div>
    <form id="form-categoria" class="inline-form">
      <textarea name="emoji" class="icon-input" placeholder="🏷️ ou cole um &lt;svg&gt;...&lt;/svg&gt;"></textarea>
      <input name="nome" placeholder="Nova categoria" required autocomplete="off">
      <button type="submit" class="btn-primary">${icon("plus")}Adicionar</button>
    </form>
    <ul class="chip-list chip-list--categorias">
      ${categorias.map(c => `
        <li data-id="${c.id}">
          <textarea class="icon-input" data-emoji-edit placeholder="🏷️ ou &lt;svg&gt;...">${escHtml(c.emoji || "")}</textarea>
          <span class="chip-list__nome">${escHtml(c.nome)}</span>
          <button data-id="${c.id}" title="Remover">${icon("close")}</button>
        </li>`).join("") || `<li class="chip-list__empty">Nenhuma categoria cadastrada.</li>`}
    </ul>`;

  container.querySelector("#form-categoria").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    await criarCategoria(form.nome.value.trim(), form.emoji.value.trim());
    cacheCategorias = await listarCategorias();
    carregarAbaCategorias(container);
  });

  container.querySelectorAll("[data-emoji-edit]").forEach(input => {
    const salvar = async () => {
      const id = input.closest("li").dataset.id;
      await atualizarCategoria(id, { emoji: input.value.trim() });
      cacheCategorias = await listarCategorias();
      toast("Emoji atualizado.");
    };
    input.addEventListener("change", salvar);
    input.addEventListener("blur", salvar);
  });

  container.querySelectorAll(".chip-list button[data-id]").forEach(btn =>
    btn.addEventListener("click", async () => {
      await excluirCategoria(btn.dataset.id);
      cacheCategorias = await listarCategorias();
      carregarAbaCategorias(container);
    })
  );
}

// ---------- MARCAS ----------
let cacheMarcas = [];

async function carregarAbaMarcas(container) {
  if (!container) return;
  cacheMarcas = (await listarMarcas()).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  container.innerHTML = `
    <div class="admin-panel-head">
      <h1>Marcas</h1>
      <p>Cadastre as marcas parceiras exibidas na loja, com nome e logo.</p>
    </div>
    <div class="admin-toolbar">
      <button class="btn-primary" id="btn-nova-marca">${icon("plus")}Nova marca</button>
    </div>
    <ul class="chip-list chip-list--marcas">
      ${cacheMarcas.map(m => `
        <li data-id="${m.id}">
          <img class="thumb" src="${m.logo || "/assets/images/placeholder.svg"}" alt="${escHtml(m.nome)}">
          <span class="chip-list__nome">${escHtml(m.nome)}</span>
          <button data-action="editar" title="Editar">${icon("pencil")}</button>
          <button data-action="excluir" title="Remover">${icon("close")}</button>
        </li>`).join("") || `<li class="chip-list__empty">Nenhuma marca cadastrada.</li>`}
    </ul>
    <dialog id="dialog-marca" class="dialog-form"></dialog>`;

  container.querySelector("#btn-nova-marca").addEventListener("click", () => abrirFormularioMarca(container));

  container.querySelectorAll(".chip-list--marcas li[data-id]").forEach(li => {
    const id = li.dataset.id;
    const marca = cacheMarcas.find(m => m.id === id);
    li.querySelector('[data-action="editar"]')?.addEventListener("click", () => abrirFormularioMarca(container, marca));
    li.querySelector('[data-action="excluir"]')?.addEventListener("click", async () => {
      if (confirm(`Remover a marca "${marca.nome}"?`)) {
        await excluirMarca(id);
        toast("Marca removida.");
        carregarAbaMarcas(container);
      }
    });
  });
}

async function abrirFormularioMarca(container, marca = null) {
  const dialog = container.querySelector("#dialog-marca");
  dialog.innerHTML = `
    <form id="form-marca" class="product-form">
      <h3>${marca ? "Editar marca" : "Nova marca"}</h3>
      <div class="form-grid">
        <label>Nome<input name="nome" required autocomplete="off" value="${escHtml(marca?.nome || "")}"></label>
        <label>Logo (imagem)<input name="logo" type="file" accept="image/*"></label>
      </div>
      ${marca?.logo ? `
        <div class="logo-atual" id="logo-atual-wrap">
          <img class="thumb" src="${marca.logo}" alt="">
          <button type="button" id="btn-remover-logo" class="btn-remover-logo" title="Apagar imagem">${icon("close")} Apagar imagem</button>
        </div>` : ""}
      <div class="form-actions">
        <button type="button" data-modal-close-dialog>Cancelar</button>
        <button type="submit" class="btn-primary">Salvar</button>
      </div>
    </form>`;

  dialog.showModal();
  dialog.querySelector("[data-modal-close-dialog]").addEventListener("click", () => dialog.close());

  let logoRemovida = false;
  dialog.querySelector("#btn-remover-logo")?.addEventListener("click", () => {
    logoRemovida = true;
    dialog.querySelector("#logo-atual-wrap").remove();
    toast("Imagem removida. Salve para confirmar.");
  });

  dialog.querySelector("#form-marca").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const dados = { nome: form.nome.value.trim() };

    const arquivoLogo = form.logo.files[0];
    if (arquivoLogo) {
      dados.logo = await compressImageToBase64(arquivoLogo, 500, 0.9, "png");
    } else if (logoRemovida) {
      dados.logo = "";
    } else if (marca?.logo) {
      dados.logo = marca.logo;
    }

    if (marca) {
      await atualizarMarca(marca.id, dados);
      toast("Marca atualizada.");
    } else {
      await criarMarca(dados);
      toast("Marca cadastrada.");
    }
    dialog.close();
    carregarAbaMarcas(container);
  });
}

// ---------- ETIQUETAS ----------
async function carregarAbaEtiquetas(container) {
  if (!container) return;
  const etiquetas = await listarEtiquetas();
  container.innerHTML = `
    <div class="admin-panel-head">
      <h1>Etiquetas</h1>
      <p>Destaque produtos com etiquetas personalizadas.</p>
    </div>
    <form id="form-etiqueta" class="inline-form">
      <input name="nome" placeholder="Nova etiqueta (ex: Promoção)" required autocomplete="off">
      <button type="submit" class="btn-primary">${icon("plus")}Adicionar</button>
    </form>
    <ul class="chip-list">
      ${etiquetas.map(e => `<li>${escHtml(e.nome)} <button data-id="${e.id}" title="Remover">${icon("close")}</button></li>`).join("") || `<li class="chip-list__empty">Nenhuma etiqueta cadastrada.</li>`}
    </ul>`;

  container.querySelector("#form-etiqueta").addEventListener("submit", async (e) => {
    e.preventDefault();
    await criarEtiqueta(e.target.nome.value.trim());
    carregarAbaEtiquetas(container);
  });
  container.querySelectorAll(".chip-list button").forEach(btn =>
    btn.addEventListener("click", async () => { await excluirEtiqueta(btn.dataset.id); carregarAbaEtiquetas(container); })
  );
}

// ---------- ESTOQUE ----------
async function carregarAbaEstoque(container) {
  if (!container) return;
  const produtos = await listarProdutos({ apenasAtivos: false });
  container.innerHTML = `
    <div class="admin-panel-head">
      <h1>Estoque</h1>
      <p>Consulte e ajuste as quantidades disponíveis.</p>
    </div>
    <div class="input-icon input-icon--full">${icon("search")}<input type="text" id="busca-estoque" placeholder="Buscar produto..." autocomplete="off"></div>
    <div class="table-wrap"><table class="admin-table">
      <thead><tr><th>Produto</th><th>Qtd atual</th><th>Ajuste</th><th></th></tr></thead>
      <tbody>
        ${produtos.map(p => `
          <tr data-id="${p.id}">
            <td>${escHtml(p.nome)}</td>
            <td class="qtd-atual">${p.quantidade ?? 0}</td>
            <td><input type="number" class="ajuste-input" placeholder="+ ou -" style="width:90px"></td>
            <td><button class="btn-ajustar">Aplicar</button></td>
          </tr>`).join("")}
      </tbody>
    </table></div>`;

  container.querySelectorAll(".btn-ajustar").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      const id = tr.dataset.id;
      const delta = parseInt(tr.querySelector(".ajuste-input").value, 10);
      if (!delta) return;
      await ajustarEstoque(id, delta, delta > 0 ? "Entrada manual" : "Saída manual");
      toast("Estoque atualizado.");
      carregarAbaEstoque(container);
    });
  });

  container.querySelector("#busca-estoque").addEventListener("input", (e) => {
    const termo = e.target.value.toLowerCase();
    container.querySelectorAll("tbody tr").forEach(tr => {
      tr.style.display = tr.children[0].textContent.toLowerCase().includes(termo) ? "" : "none";
    });
  });
}

// ---------- USUÁRIOS ----------
async function carregarAbaUsuarios(container) {
  if (!container) return;
  const usuarios = await listarUsuarios();
  container.innerHTML = `
    <div class="admin-panel-head">
      <h1>Usuários</h1>
      <p>Veja quem tem acesso à sua loja.</p>
    </div>
    <div class="table-wrap"><table class="admin-table">
      <thead><tr><th>Nome</th><th>E-mail</th><th>Cargos</th></tr></thead>
      <tbody>
        ${usuarios.map(u => `<tr><td>${escHtml(u.nome || "-")}</td><td>${escHtml(u.email || "-")}</td><td>${(u.cargos || []).join(", ")}</td></tr>`).join("") || "<tr><td colspan='3'>Nenhum usuário.</td></tr>"}
      </tbody>
    </table></div>`;
}
