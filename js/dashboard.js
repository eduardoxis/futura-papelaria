// js/dashboard.js
import {
  listarProdutos, criarProduto, atualizarProduto, excluirProduto, duplicarProduto,
  listarCategorias, criarCategoria, atualizarCategoria, excluirCategoria,
  listarEtiquetas, criarEtiqueta, excluirEtiqueta,
  listarMarcas, criarMarca, atualizarMarca, excluirMarca,
  listarClientes, criarCliente, atualizarCliente, excluirCliente,
  ajustarEstoque, listarUsuarios
} from "./firestore.js";
import { formatBRL, escHtml, generateCode, converterParaWebP, converterParaPNG, toast, confirmarAcao } from "./utils.js";
import { enviarImagemParaCloudinary, migrarImagensAntigas } from "./cloudinary.js";
import { carregarPainelLeads } from "./leads.js";
import { ICONS, icon } from "./icons.js";

let cacheProdutos = [];
let cacheCategorias = [];
let cacheEtiquetas = [];

/**
 * Converte o arquivo selecionado para WebP (máx. 800px, qualidade 80%) e
 * envia para o Cloudinary. Retorna a URL pública ou null se falhar — nunca
 * salvamos base64 no Firestore nem usamos Firebase Storage.
 */
async function enviarImagem(file, nomeBase) {
  try {
    const webp = await converterParaWebP(file, 800, 0.8);
    return await enviarImagemParaCloudinary(webp, nomeBase);
  } catch (erro) {
    toast(erro.message || "Falha ao enviar a imagem.", "error");
    return null;
  }
}

/**
 * Igual a enviarImagem, mas para categorias e marcas: mantém PNG (a pedido)
 * em vez de recomprimir em WebP — bom para logos com fundo transparente.
 */
async function enviarImagemComoPNG(file, nomeBase) {
  try {
    const png = await converterParaPNG(file, 500);
    return await enviarImagemParaCloudinary(png, nomeBase);
  } catch (erro) {
    toast(erro.message || "Falha ao enviar a imagem.", "error");
    return null;
  }
}

export async function iniciarPainelAdmin(root) {
  await carregarDashboard(root.querySelector("#painel-dashboard"));
  await carregarAbaProdutos(root.querySelector("#painel-produtos"));
  await carregarAbaCategorias(root.querySelector("#painel-categorias"));
  await carregarAbaMarcas(root.querySelector("#painel-marcas"));
  await carregarAbaEtiquetas(root.querySelector("#painel-etiquetas"));
  await carregarAbaEstoque(root.querySelector("#painel-estoque"));
  await carregarPainelLeads(root.querySelector("#painel-leads"));
  await carregarAbaUsuarios(root.querySelector("#painel-usuarios"));
  await carregarAbaClientes(root.querySelector("#painel-clientes"));
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
    </div>
    <div class="dash-list" id="bloco-migracao-imagens">
      <h4>Imagens antigas (base64)</h4>
      <p style="margin:0 0 0.75rem;color:var(--cinza-500);font-size:0.85rem;">
        Converte produtos, categorias e marcas que ainda tenham imagem salva direto no Firestore
        para WebP hospedado no Cloudinary.
      </p>
      <button class="btn-secondary" id="btn-migrar-imagens">${icon("archive")}Migrar imagens antigas</button>
      <p id="status-migracao" style="margin-top:0.6rem;font-size:0.82rem;color:var(--cinza-500);"></p>
    </div>`;

  container.querySelector("#btn-migrar-imagens")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const status = container.querySelector("#status-migracao");
    btn.disabled = true;
    status.textContent = "Procurando imagens antigas...";
    try {
      const resultado = await migrarImagensAntigas((feitos, total) => {
        status.textContent = `Migrando ${feitos}/${total}...`;
      });
      status.textContent = resultado.total === 0
        ? "Nenhuma imagem antiga encontrada — tudo já está em WebP/Cloudinary."
        : `Concluído: ${resultado.total - resultado.erros} de ${resultado.total} migradas${resultado.erros ? `, ${resultado.erros} com erro (veja o console)` : ""}.`;
      toast("Migração de imagens concluída.");
    } catch (erro) {
      status.textContent = "Erro na migração: " + (erro.message || "tente novamente.");
      toast("Falha na migração de imagens.", "error");
    } finally {
      btn.disabled = false;
    }
  });
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

  // estado da galeria de imagens: cada item é { id, url (existente) ou file+previewUrl (novo) }
  const iniciais = Array.isArray(produto?.imagens) && produto.imagens.length
    ? produto.imagens
    : (produto?.imagem ? [produto.imagem] : []);
  let galeria = iniciais.map(url => ({ id: crypto.randomUUID(), url, file: null, previewUrl: null }));
  let arrastando = null;

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
      </div>

      <div class="galeria-produto">
        <h4>Galeria de imagens do produto</h4>
        <p class="galeria-produto__ajuda">A primeira imagem da lista é usada como capa no catálogo. Arraste as miniaturas para reordenar.</p>
        <div class="galeria-produto__grid" id="galeria-grid"></div>
        <label class="galeria-produto__upload">
          ${icon("plus")}Escolher arquivos
          <input type="file" id="input-galeria" accept="image/*" multiple hidden>
        </label>
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

  const grid = dialog.querySelector("#galeria-grid");

  function renderizarGaleria() {
    grid.innerHTML = galeria.map((item, i) => `
      <div class="galeria-item" draggable="true" data-id="${item.id}">
        <img src="${item.previewUrl || item.url}" alt="">
        <button type="button" class="galeria-item__remover" data-remover="${item.id}" aria-label="Remover imagem">${icon("close")}</button>
        ${i === 0 ? `<span class="galeria-item__principal">Principal</span>` : ""}
      </div>`).join("");

    grid.querySelectorAll("[data-remover]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const ok = await confirmarAcao("Remover esta imagem da galeria do produto?", { titulo: "Remover imagem" });
        if (!ok) return;
        const item = galeria.find(g => g.id === btn.dataset.remover);
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
        galeria = galeria.filter(g => g.id !== btn.dataset.remover);
        renderizarGaleria();
      });
    });

    grid.querySelectorAll(".galeria-item").forEach(el => {
      el.addEventListener("dragstart", () => { arrastando = el.dataset.id; el.classList.add("is-dragging"); });
      el.addEventListener("dragend", () => el.classList.remove("is-dragging"));
      el.addEventListener("dragover", (e) => e.preventDefault());
      el.addEventListener("drop", (e) => {
        e.preventDefault();
        if (!arrastando || arrastando === el.dataset.id) return;
        const de = galeria.findIndex(g => g.id === arrastando);
        const ate = galeria.findIndex(g => g.id === el.dataset.id);
        const [movido] = galeria.splice(de, 1);
        galeria.splice(ate, 0, movido);
        renderizarGaleria();
      });
    });
  }
  renderizarGaleria();

  dialog.querySelector("#input-galeria").addEventListener("change", (e) => {
    [...e.target.files].forEach(file => {
      galeria.push({ id: crypto.randomUUID(), url: null, file, previewUrl: URL.createObjectURL(file) });
    });
    e.target.value = "";
    renderizarGaleria();
  });

  dialog.querySelector("#form-produto").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const btnSalvar = form.querySelector('button[type="submit"]');
    const nomeProduto = form.nome.value.trim() || "produto";

    const pendentes = galeria.filter(g => g.file);
    if (pendentes.length) {
      btnSalvar.disabled = true;
      for (let i = 0; i < pendentes.length; i++) {
        btnSalvar.textContent = `Enviando imagem ${i + 1}/${pendentes.length}...`;
        const url = await enviarImagem(pendentes[i].file, `${nomeProduto}-${i + 1}`);
        if (!url) { btnSalvar.disabled = false; btnSalvar.textContent = "Salvar"; return; }
        pendentes[i].url = url;
        if (pendentes[i].previewUrl) URL.revokeObjectURL(pendentes[i].previewUrl);
      }
      btnSalvar.disabled = false;
      btnSalvar.textContent = "Salvar";
    }

    const dados = {
      nome: nomeProduto,
      marca: form.marca.value.trim(),
      preco: parseFloat(form.preco.value),
      quantidade: parseInt(form.quantidade.value, 10),
      categoria: form.categoria.value,
      status: form.status.value,
      codigo: form.codigo.value.trim(),
      descricao: form.descricao.value.trim(),
      etiquetas: [...form.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value),
      imagens: galeria.map(g => g.url).filter(Boolean)
    };
    dados.imagem = dados.imagens[0] || "";

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
  cacheCategorias = (await listarCategorias());

  container.innerHTML = `
    <div class="admin-panel-head">
      <h1>Categorias</h1>
      <p>Cadastre as categorias da loja, com nome e imagem.</p>
    </div>
    <div class="admin-toolbar">
      <button class="btn-primary" id="btn-nova-categoria">${icon("plus")}Nova categoria</button>
    </div>
    <ul class="chip-list chip-list--marcas">
      ${cacheCategorias.map(c => `
        <li data-id="${c.id}">
          <img class="thumb" src="${c.imagem || "/assets/images/placeholder.svg"}" alt="${escHtml(c.nome)}">
          <span class="chip-list__nome">${escHtml(c.nome)}</span>
          <button data-action="editar" title="Editar">${icon("pencil")}</button>
          <button data-action="excluir" title="Remover">${icon("close")}</button>
        </li>`).join("") || `<li class="chip-list__empty">Nenhuma categoria cadastrada.</li>`}
    </ul>
    <dialog id="dialog-categoria" class="dialog-form"></dialog>`;

  container.querySelector("#btn-nova-categoria").addEventListener("click", () => abrirFormularioCategoria(container));

  container.querySelectorAll(".chip-list--marcas li[data-id]").forEach(li => {
    const id = li.dataset.id;
    const categoria = cacheCategorias.find(c => c.id === id);
    li.querySelector('[data-action="editar"]')?.addEventListener("click", () => abrirFormularioCategoria(container, categoria));
    li.querySelector('[data-action="excluir"]')?.addEventListener("click", async () => {
      if (confirm(`Remover a categoria "${categoria.nome}"?`)) {
        await excluirCategoria(id);
        cacheCategorias = await listarCategorias();
        toast("Categoria removida.");
        carregarAbaCategorias(container);
      }
    });
  });
}

async function abrirFormularioCategoria(container, categoria = null) {
  const dialog = container.querySelector("#dialog-categoria");
  dialog.innerHTML = `
    <form id="form-categoria" class="product-form">
      <h3>${categoria ? "Editar categoria" : "Nova categoria"}</h3>
      <div class="form-grid">
        <label>Nome<input name="nome" required autocomplete="off" value="${escHtml(categoria?.nome || "")}"></label>
        <label>Imagem<input name="imagem" type="file" accept="image/*"></label>
      </div>
      ${categoria?.imagem ? `
        <div class="logo-atual" id="imagem-atual-wrap">
          <img class="thumb" src="${categoria.imagem}" alt="">
          <button type="button" id="btn-remover-imagem" class="btn-remover-logo" title="Apagar imagem">${icon("close")} Apagar imagem</button>
        </div>` : ""}
      <div class="form-actions">
        <button type="button" data-modal-close-dialog>Cancelar</button>
        <button type="submit" class="btn-primary">Salvar</button>
      </div>
    </form>`;

  dialog.showModal();
  dialog.querySelector("[data-modal-close-dialog]").addEventListener("click", () => dialog.close());

  let imagemRemovida = false;
  dialog.querySelector("#btn-remover-imagem")?.addEventListener("click", () => {
    imagemRemovida = true;
    dialog.querySelector("#imagem-atual-wrap").remove();
    toast("Imagem removida. Salve para confirmar.");
  });

  dialog.querySelector("#form-categoria").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const btnSalvar = form.querySelector('button[type="submit"]');
    const dados = { nome: form.nome.value.trim() };

    const arquivoImagem = form.imagem.files[0];
    if (arquivoImagem) {
      btnSalvar.disabled = true;
      btnSalvar.textContent = "Enviando imagem...";
      const novaImagem = await enviarImagemComoPNG(arquivoImagem, dados.nome || "categoria");
      btnSalvar.disabled = false;
      btnSalvar.textContent = "Salvar";
      if (!novaImagem) return;
      dados.imagem = novaImagem;
    } else if (imagemRemovida) {
      dados.imagem = "";
    } else if (categoria?.imagem) {
      dados.imagem = categoria.imagem;
    }

    if (categoria) {
      await atualizarCategoria(categoria.id, dados);
      toast("Categoria atualizada.");
    } else {
      await criarCategoria(dados.nome, "", dados.imagem);
      toast("Categoria cadastrada.");
    }
    cacheCategorias = await listarCategorias();
    dialog.close();
    carregarAbaCategorias(container);
  });
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
    const btnSalvar = form.querySelector('button[type="submit"]');
    const dados = { nome: form.nome.value.trim() };

    const arquivoLogo = form.logo.files[0];
    if (arquivoLogo) {
      btnSalvar.disabled = true;
      btnSalvar.textContent = "Enviando imagem...";
      const novaLogo = await enviarImagemComoPNG(arquivoLogo, dados.nome || "marca");
      btnSalvar.disabled = false;
      btnSalvar.textContent = "Salvar";
      if (!novaLogo) return;
      dados.logo = novaLogo;
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

// ---------- CLIENTES ----------
let cacheClientes = [];

async function carregarAbaClientes(container) {
  if (!container) return;
  cacheClientes = await listarClientes();

  container.innerHTML = `
    <div class="admin-panel-head">
      <h1>Clientes</h1>
      <p>Cadastre clientes Pessoa Física e Empresas (PJ).</p>
    </div>
    <div class="admin-toolbar">
      <div class="input-icon">
        ${icon("search")}
        <input type="text" id="busca-admin-clientes" placeholder="Pesquisar clientes..." autocomplete="off">
      </div>
      <button class="btn-primary" id="btn-novo-cliente">${icon("plus")}Novo cliente</button>
    </div>
    <div class="table-wrap"><table class="admin-table" id="tabela-clientes">
      <thead><tr><th></th><th>Nome</th><th>Tipo</th><th>Telefone</th><th>WhatsApp</th><th>Ações</th></tr></thead>
      <tbody></tbody>
    </table></div>
    <p class="table-count" id="contagem-clientes"></p>
    <dialog id="dialog-cliente" class="dialog-form"></dialog>`;

  renderizarTabelaClientes(container, cacheClientes);

  container.querySelector("#busca-admin-clientes").addEventListener("input", (e) => {
    const termo = e.target.value.toLowerCase();
    const filtrados = cacheClientes.filter(c => nomeCliente(c).toLowerCase().includes(termo));
    renderizarTabelaClientes(container, filtrados);
  });

  container.querySelector("#btn-novo-cliente").addEventListener("click", () => abrirFormularioCliente(container));
}

function nomeCliente(c) {
  return c.tipo === "pj" ? (c.nomeFantasia || c.razaoSocial || "") : (c.nome || "");
}

function renderizarTabelaClientes(container, clientes) {
  const tbody = container.querySelector("#tabela-clientes tbody");
  const contagem = container.querySelector("#contagem-clientes");
  if (contagem) contagem.textContent = `Mostrando ${clientes.length} de ${cacheClientes.length} clientes`;

  tbody.innerHTML = clientes.map(c => `
    <tr data-id="${c.id}">
      <td>${icon(c.tipo === "pj" ? "briefcase" : "user")}</td>
      <td>${escHtml(nomeCliente(c))}</td>
      <td><span class="status-pill">${c.tipo === "pj" ? "Empresa" : "Pessoa física"}</span></td>
      <td>${escHtml(c.telefone || "-")}</td>
      <td>${escHtml(c.whatsapp || "-")}</td>
      <td class="row-actions">
        <button data-action="editar" title="Editar">${icon("pencil")}</button>
        <button data-action="excluir" title="Excluir">${icon("trash")}</button>
      </td>
    </tr>`).join("") || `<tr><td colspan="6">
      <div class="empty-state">
        ${icon("gridEmpty", "empty-state__icon")}
        <strong>Nenhum cliente cadastrado</strong>
        <p>Comece adicionando seu primeiro cliente.</p>
        <button type="button" class="btn-secondary" id="btn-primeiro-cliente">${icon("plus")}Adicionar primeiro cliente</button>
      </div>
    </td></tr>`;

  tbody.querySelector("#btn-primeiro-cliente")?.addEventListener("click", () => abrirFormularioCliente(container));

  tbody.querySelectorAll("tr").forEach(tr => {
    const id = tr.dataset.id;
    const cliente = clientes.find(c => c.id === id);
    tr.querySelector('[data-action="editar"]')?.addEventListener("click", () => abrirFormularioCliente(container, cliente));
    tr.querySelector('[data-action="excluir"]')?.addEventListener("click", async () => {
      if (confirm(`Excluir "${nomeCliente(cliente)}"?`)) {
        await excluirCliente(id);
        toast("Cliente excluído.");
        carregarAbaClientes(container);
      }
    });
  });
}

function camposPF(c) {
  return `
    <div class="form-grid">
      <label>Nome completo *<input name="nome" required autocomplete="off" value="${escHtml(c?.nome || "")}"></label>
      <label>Telefone *<input name="telefone" required autocomplete="off" value="${escHtml(c?.telefone || "")}"></label>
      <label>WhatsApp *<input name="whatsapp" required autocomplete="off" value="${escHtml(c?.whatsapp || "")}"></label>
      <label>CPF<input name="cpf" autocomplete="off" value="${escHtml(c?.cpf || "")}"></label>
      <label>RG<input name="rg" autocomplete="off" value="${escHtml(c?.rg || "")}"></label>
      <label>Data de nascimento<input name="nascimento" type="date" value="${escHtml(c?.nascimento || "")}"></label>
      <label>E-mail<input name="email" type="email" autocomplete="off" value="${escHtml(c?.email || "")}"></label>
      <label>Endereço completo<input name="endereco" autocomplete="off" value="${escHtml(c?.endereco || "")}"></label>
    </div>
    <label>Observações<textarea name="observacoes" rows="3">${escHtml(c?.observacoes || "")}</textarea></label>`;
}

function camposPJ(c) {
  return `
    <div class="form-grid">
      <label>Razão social *<input name="razaoSocial" required autocomplete="off" value="${escHtml(c?.razaoSocial || "")}"></label>
      <label>Nome fantasia *<input name="nomeFantasia" required autocomplete="off" value="${escHtml(c?.nomeFantasia || "")}"></label>
      <label>CNPJ *<input name="cnpj" required autocomplete="off" value="${escHtml(c?.cnpj || "")}"></label>
      <label>Responsável pela empresa *<input name="responsavel" required autocomplete="off" value="${escHtml(c?.responsavel || "")}"></label>
      <label>Telefone *<input name="telefone" required autocomplete="off" value="${escHtml(c?.telefone || "")}"></label>
      <label>WhatsApp *<input name="whatsapp" required autocomplete="off" value="${escHtml(c?.whatsapp || "")}"></label>
      <label>E-mail *<input name="email" type="email" required autocomplete="off" value="${escHtml(c?.email || "")}"></label>
      <label>Endereço completo *<input name="endereco" required autocomplete="off" value="${escHtml(c?.endereco || "")}"></label>
      <label>Inscrição estadual<input name="inscricaoEstadual" autocomplete="off" value="${escHtml(c?.inscricaoEstadual || "")}"></label>
    </div>`;
}

async function abrirFormularioCliente(container, cliente = null) {
  const dialog = container.querySelector("#dialog-cliente");
  const tipoInicial = cliente?.tipo || "pf";

  dialog.innerHTML = `
    <form id="form-cliente" class="product-form">
      <h3>${cliente ? "Editar cliente" : "Novo cliente"}</h3>
      <label>Tipo de cliente *
        <select name="tipo" id="select-tipo-cliente" ${cliente ? "disabled" : ""}>
          <option value="pf" ${tipoInicial === "pf" ? "selected" : ""}>Pessoa Física (PF)</option>
          <option value="pj" ${tipoInicial === "pj" ? "selected" : ""}>Empresa (PJ)</option>
        </select>
      </label>
      <div id="campos-tipo-cliente">${tipoInicial === "pj" ? camposPJ(cliente) : camposPF(cliente)}</div>
      <div class="form-actions">
        <button type="button" data-modal-close-dialog>Cancelar</button>
        <button type="submit" class="btn-primary">Salvar</button>
      </div>
    </form>`;

  dialog.showModal();
  dialog.querySelector("[data-modal-close-dialog]").addEventListener("click", () => dialog.close());

  if (!cliente) {
    dialog.querySelector("#select-tipo-cliente").addEventListener("change", (e) => {
      dialog.querySelector("#campos-tipo-cliente").innerHTML = e.target.value === "pj" ? camposPJ() : camposPF();
    });
  }

  dialog.querySelector("#form-cliente").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const tipo = form.tipo.value;
    const dados = { tipo };

    const campos = tipo === "pj"
      ? ["razaoSocial", "nomeFantasia", "cnpj", "responsavel", "telefone", "whatsapp", "email", "endereco", "inscricaoEstadual"]
      : ["nome", "telefone", "whatsapp", "cpf", "rg", "nascimento", "email", "endereco", "observacoes"];

    campos.forEach(campo => {
      if (form[campo]) dados[campo] = form[campo].value.trim();
    });

    if (cliente) {
      await atualizarCliente(cliente.id, dados);
      toast("Cliente atualizado.");
    } else {
      await criarCliente(dados);
      toast("Cliente cadastrado.");
    }
    dialog.close();
    carregarAbaClientes(container);
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
