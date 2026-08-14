// js/cart.js
import { formatBRL, escHtml, podeExecutar } from "../utils/utils.js";
import { salvarLeadPerdido } from "../services/firestore.js";
import { STORE_CONFIG } from "../../firebase/firebase-config.js";

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

/**
 * Gera a chave única do item no carrinho. Produtos com cor selecionada
 * geram uma chave diferente por cor (ex.: "abc123|Azul"); produtos sem
 * cor mantêm a chave igual ao próprio id, preservando compatibilidade
 * com carrinhos já salvos antes da funcionalidade de cores.
 */
export function chaveItemCarrinho(id, cor = "") {
  return cor ? `${id}|${cor}` : id;
}

export function adicionarAoCarrinho(produto, quantidade = 1, cor = "") {
  const carrinho = obterCarrinho();
  const chave = chaveItemCarrinho(produto.id, cor);
  const existente = carrinho.find(i => (i.chave || i.id) === chave);
  if (existente) {
    existente.quantidade += quantidade;
  } else {
    carrinho.push({
      chave,
      id: produto.id,
      nome: produto.nome,
      marca: produto.marca || "",
      preco: produto.preco,
      imagem: produto.imagem || "",
      cor: cor || "",
      quantidade
    });
  }
  salvarCarrinho(carrinho);
}

export function atualizarQuantidade(chave, quantidade) {
  let carrinho = obterCarrinho();
  if (quantidade <= 0) {
    carrinho = carrinho.filter(i => (i.chave || i.id) !== chave);
  } else {
    const item = carrinho.find(i => (i.chave || i.id) === chave);
    if (item) item.quantidade = quantidade;
  }
  salvarCarrinho(carrinho);
}

export function removerDoCarrinho(chave) {
  const carrinho = obterCarrinho().filter(i => (i.chave || i.id) !== chave);
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
    const corStr = item.cor ? ` (Cor: ${item.cor})` : "";
    msg += `${item.nome}${corStr}\nQuantidade: ${item.quantidade}\nValor: ${formatBRL(item.preco * item.quantidade)}\n\n`;
  });
  msg += `------------------\nTotal: ${formatBRL(total)}\n\n`;
  if (nomeCliente) msg += `Meu nome é: ${nomeCliente}\n\n`;
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
