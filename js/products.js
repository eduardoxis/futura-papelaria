// js/products.js
import { escHtml, formatBRL } from "./utils.js";
import { incrementarCompartilhamento } from "./firestore.js";
import { icon } from "./icons.js";

const CHAVE_FAVORITOS = "futura_favoritos";

export function obterFavoritos() {
  try { return JSON.parse(localStorage.getItem(CHAVE_FAVORITOS)) || []; }
  catch { return []; }
}

function salvarFavoritos(lista) {
  localStorage.setItem(CHAVE_FAVORITOS, JSON.stringify(lista));
}

export function alternarFavorito(id) {
  const lista = obterFavoritos();
  const idx = lista.indexOf(id);
  if (idx >= 0) lista.splice(idx, 1);
  else lista.push(id);
  salvarFavoritos(lista);
  return lista.includes(id);
}

export function cartaoProduto(produto) {
  const semEstoque = produto.status === "sem_estoque" || Number(produto.quantidade) <= 0;
  const etiquetasHtml = (produto.etiquetas || [])
    .map(e => `<span class="tag-badge">${escHtml(e)}</span>`)
    .join("");
  const favoritado = obterFavoritos().includes(produto.id);

  return `
    <div class="product-card ${semEstoque ? "is-out" : ""}" data-id="${produto.id}">
      <button class="product-card__fav ${favoritado ? "is-active" : ""}" data-fav-id="${produto.id}" aria-label="Favoritar produto" aria-pressed="${favoritado}">${icon("heart")}</button>
      <a class="product-card__link" href="/pages/produto.html?id=${produto.id}">
        <div class="product-card__image">
          <img src="${produto.imagem || "/assets/images/placeholder.svg"}" alt="${escHtml(produto.nome)}" loading="lazy">
          ${etiquetasHtml ? `<div class="product-card__tags">${etiquetasHtml}</div>` : ""}
          ${semEstoque ? `<span class="badge-outofstock">Sem estoque</span>` : ""}
        </div>
        <div class="product-card__body">
          ${produto.marca ? `<span class="product-card__brand">${escHtml(produto.marca)}</span>` : ""}
          <h3 class="product-card__name">${escHtml(produto.nome)}</h3>
          <span class="product-card__price">${formatBRL(produto.preco)}</span>
        </div>
      </a>
      ${!semEstoque ? `
      <div class="product-card__actions">
        <button class="btn-primary product-card__add" data-add-id="${produto.id}">Adicionar</button>
        <button class="btn-whatsapp product-card__ask" data-ask-id="${produto.id}" title="Falar sobre este produto no WhatsApp" aria-label="Falar sobre este produto no WhatsApp">${icon("whatsapp")}</button>
      </div>` : ""}
    </div>`;
}

export function renderizarGrade(container, produtos) {
  if (!produtos.length) {
    container.innerHTML = `<div class="empty-state">Nenhum produto encontrado. Tente ajustar sua busca ou filtros.</div>`;
    return;
  }
  container.innerHTML = produtos.map(cartaoProduto).join("");

  if (!container.dataset.acoesLigadas) {
    container.dataset.acoesLigadas = "1";
    container.addEventListener("click", (e) => {
      const btnFav = e.target.closest("[data-fav-id]");
      if (btnFav) {
        e.preventDefault();
        const ativo = alternarFavorito(btnFav.dataset.favId);
        btnFav.classList.toggle("is-active", ativo);
        btnFav.setAttribute("aria-pressed", String(ativo));
        return;
      }
      const btnAdd = e.target.closest("[data-add-id]");
      const btnAsk = e.target.closest("[data-ask-id]");
      if (!btnAdd && !btnAsk) return;
      e.preventDefault();
      const id = (btnAdd || btnAsk).dataset.addId || (btnAdd || btnAsk).dataset.askId;
      const produto = produtos.find(p => p.id === id);
      if (!produto) return;
      if (btnAdd) container.dispatchEvent(new CustomEvent("adicionar-carrinho", { detail: produto, bubbles: true }));
      if (btnAsk) container.dispatchEvent(new CustomEvent("falar-produto", { detail: produto, bubbles: true }));
    });
  }
}

export async function compartilharProduto(produto) {
  const url = `${window.location.origin}/pages/produto.html?id=${produto.id}`;
  const dados = { title: produto.nome, text: `Confira: ${produto.nome}`, url };
  try {
    if (navigator.share) {
      await navigator.share(dados);
    } else {
      await navigator.clipboard.writeText(url);
      return "copiado";
    }
    await incrementarCompartilhamento(produto.id);
    return "compartilhado";
  } catch {
    return "cancelado";
  }
}

export function ordenarProdutos(produtos, criterio) {
  const lista = [...produtos];
  switch (criterio) {
    case "preco_asc": return lista.sort((a, b) => a.preco - b.preco);
    case "preco_desc": return lista.sort((a, b) => b.preco - a.preco);
    case "recentes": return lista.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
    case "nome": return lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    default: return lista;
  }
}

export function aplicarFiltros(produtos, filtros) {
  return produtos.filter(p => {
    if (filtros.categoria && p.categoria !== filtros.categoria) return false;
    if (filtros.marca && p.marca !== filtros.marca) return false;
    if (filtros.etiqueta && !(p.etiquetas || []).includes(filtros.etiqueta)) return false;
    if (filtros.disponibilidade === "disponivel" && p.status !== "disponivel") return false;
    if (filtros.precoMin != null && p.preco < filtros.precoMin) return false;
    if (filtros.precoMax != null && p.preco > filtros.precoMax) return false;
    return true;
  });
}
