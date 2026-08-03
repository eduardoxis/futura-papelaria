// js/products.js
import { escHtml, formatBRL } from "./utils.js";
import { incrementarCompartilhamento } from "./firestore.js";

export function cartaoProduto(produto) {
  const semEstoque = produto.status === "sem_estoque" || Number(produto.quantidade) <= 0;
  const etiquetasHtml = (produto.etiquetas || [])
    .map(e => `<span class="tag-badge">${escHtml(e)}</span>`)
    .join("");

  return `
    <a class="product-card ${semEstoque ? "is-out" : ""}" href="/pages/produto.html?id=${produto.id}" data-id="${produto.id}">
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
    </a>`;
}

export function renderizarGrade(container, produtos) {
  if (!produtos.length) {
    container.innerHTML = `<div class="empty-state">Nenhum produto encontrado. Tente ajustar sua busca ou filtros.</div>`;
    return;
  }
  container.innerHTML = produtos.map(cartaoProduto).join("");
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
