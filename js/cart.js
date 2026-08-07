// js/cart.js
import { formatBRL, escHtml, podeExecutar } from "./utils.js";
import { salvarLeadPerdido } from "./firestore.js";
import { STORE_CONFIG } from "../firebase/firebase-config.js";

const CART_KEY = "papelaria_carrinho";
let leadSalvo = false;

export function obterCarrinho() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function salvarCarrinho(carrinho) {
  localStorage.setItem(CART_KEY, JSON.stringify(carrinho));
  atualizarBadgeCarrinho();
  leadSalvo = false; // qualquer mudança reabre a possibilidade de novo lead
}

export function adicionarAoCarrinho(produto, quantidade = 1) {
  const carrinho = obterCarrinho();
  const existente = carrinho.find(i => i.id === produto.id);
  if (existente) {
    existente.quantidade += quantidade;
  } else {
    carrinho.push({
      id: produto.id,
      nome: produto.nome,
      marca: produto.marca || "",
      preco: produto.preco,
      imagem: produto.imagem || "",
      quantidade
    });
  }
  salvarCarrinho(carrinho);
}

export function atualizarQuantidade(id, quantidade) {
  let carrinho = obterCarrinho();
  if (quantidade <= 0) {
    carrinho = carrinho.filter(i => i.id !== id);
  } else {
    const item = carrinho.find(i => i.id === id);
    if (item) item.quantidade = quantidade;
  }
  salvarCarrinho(carrinho);
}

export function removerDoCarrinho(id) {
  const carrinho = obterCarrinho().filter(i => i.id !== id);
  salvarCarrinho(carrinho);
}

export function limparCarrinho() {
  localStorage.removeItem(CART_KEY);
  atualizarBadgeCarrinho();
}

export function calcularTotais() {
  const carrinho = obterCarrinho();
  const quantidadeItens = carrinho.reduce((acc, i) => acc + i.quantidade, 0);
  const subtotal = carrinho.reduce((acc, i) => acc + i.quantidade * i.preco, 0);
  return { quantidadeItens, subtotal, total: subtotal };
}

export function atualizarBadgeCarrinho() {
  const badge = document.querySelector("[data-cart-badge]");
  if (!badge) return;
  const { quantidadeItens } = calcularTotais();
  badge.textContent = quantidadeItens;
  badge.style.display = quantidadeItens > 0 ? "flex" : "none";
}

export function montarMensagemWhatsApp(nomeCliente = "") {
  const carrinho = obterCarrinho();
  const { total } = calcularTotais();
  let msg = "Olá!\nTenho interesse nestes produtos:\n\n";
  carrinho.forEach(item => {
    msg += `${item.nome}\nQuantidade: ${item.quantidade}\nValor: ${formatBRL(item.preco * item.quantidade)}\n\n`;
  });
  msg += `------------------\nTotal: ${formatBRL(total)}\n\n`;
  msg += `Meu nome é: ${nomeCliente || "____________"}\n\n`;
  msg += "Gostaria de mais informações.";
  return msg;
}

export function finalizarPedidoWhatsApp(nomeCliente = "") {
  const mensagem = montarMensagemWhatsApp(nomeCliente);
  const url = `https://wa.me/${STORE_CONFIG.whatsapp}?text=${encodeURIComponent(mensagem)}`;
  limparCarrinho();
  window.open(url, "_blank");
}

/**
 * Contato rápido sobre UM único produto, sem passar pelo carrinho —
 * útil no card do catálogo ou na página do produto quando o cliente
 * quer perguntar sobre um item específico na hora, sem montar um pedido.
 * @param {{nome:string, marca?:string, id:string}} produto
 */
export function falarSobreProduto(produto) {
  const marcaStr = produto.marca ? ` [${produto.marca}]` : "";
  const link = produto.id ? `\nLink do produto: ${window.location.origin}/pages/produto.html?id=${produto.id}` : "";
  const mensagem = `Olá!\nTenho interesse neste produto:\n*${produto.nome}*${marcaStr}${link}\n\nPoderia me passar mais informações?`;
  const url = `https://wa.me/${STORE_CONFIG.whatsapp}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, "_blank");
}

/**
 * Chame isto quando o usuário sair da página com itens no carrinho e
 * sem finalizar (ex.: evento beforeunload/visibilitychange), passando
 * opcionalmente nome/telefone se o usuário os informou em algum campo.
 */
export async function registrarLeadPerdidoSeNecessario({ nome = "", telefone = "" } = {}) {
  const carrinho = obterCarrinho();
  if (leadSalvo || carrinho.length === 0) return;
  if (!podeExecutar("lead-perdido", 3, 5 * 60_000)) return;
  const { total } = calcularTotais();
  leadSalvo = true;
  await salvarLeadPerdido({
    nome,
    telefone,
    produtos: carrinho.map(i => ({ nome: i.nome, quantidade: i.quantidade, preco: i.preco })),
    valor: total
  });
}
