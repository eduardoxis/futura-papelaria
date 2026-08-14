// js/services/firestore.js
import { db } from "../../firebase/firebase-config.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc,
  query, where, orderBy, limit, startAfter, serverTimestamp, increment, onSnapshot,
  runTransaction, getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { withLoading, beginListener } from "../utils/loadingManager.js";

// ---------- CAMPOS DERIVADOS (pra filtrar no catálogo sem baixar tudo) ----------
/**
 * Bucket de preço fixo — os mesmos 4 intervalos mostrados no filtro do catálogo.
 * Precisa bater com as opções em pages/catalogo.html (data-grupo="preco").
 */
export function calcularFaixaPreco(preco) {
  const p = Number(preco) || 0;
  if (p <= 5) return "0-5";
  if (p <= 15) return "5-15";
  if (p <= 30) return "15-30";
  return "30-";
}

function calcularDisponivel(status, quantidade) {
  return status !== "sem_estoque" && status !== "oculto" && Number(quantidade) > 0;
}

// ---------- PRODUTOS ----------
export function listarProdutos({ apenasAtivos = true } = {}) {
  return withLoading("listarProdutos", async () => {
    const col = collection(db, "produtos");
    const snap = await getDocs(col);
    let produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (apenasAtivos) produtos = produtos.filter(p => p.status !== "oculto");
    return produtos;
  });
}

/**
 * Busca uma "página" de produtos direto do Firestore usando cursor
 * (startAfter), em vez de baixar a coleção inteira. Use isto em vez de
 * listarProdutos() sempre que a tela não precisar de 100% do catálogo
 * de uma vez (home, catálogo público, telas administrativas com lista).
 *
 * @param {Object} opts
 * @param {number} opts.tamanho - quantos produtos trazer nesta página
 * @param {any} opts.cursor - o último doc da página anterior (snap.docs.at(-1)), ou null na primeira página
 * @param {string} opts.categoria - filtro opcional exato de categoria
 * @param {boolean} opts.apenasAtivos - exclui produtos com status "oculto"
 * @returns {Promise<{produtos: object[], cursor: any, temMais: boolean}>}
 */
export function listarProdutosPagina({ tamanho = 20, cursor = null, categoria = "", apenasAtivos = true } = {}) {
  return withLoading("listarProdutosPagina", async () => {
    const col = collection(db, "produtos");
    const clausulas = [orderBy("nome")];
    if (categoria) clausulas.unshift(where("categoria", "==", categoria));
    // Buscamos 1 a mais do que o pedido só pra saber se existe próxima página,
    // sem precisar de uma segunda consulta count().
    clausulas.push(limit(tamanho + 1));
    if (cursor) clausulas.push(startAfter(cursor));

    const snap = await getDocs(query(col, ...clausulas));
    let docs = snap.docs;
    const temMais = docs.length > tamanho;
    docs = docs.slice(0, tamanho);

    let produtos = docs.map(d => ({ id: d.id, ...d.data() }));
    if (apenasAtivos) produtos = produtos.filter(p => p.status !== "oculto");

    return { produtos, cursor: docs.at(-1) || cursor, temMais };
  });
}

/**
 * Busca por "começa com" usando range query nativa do Firestore
 * (orderBy + where >= termo + where <= termo+\uf8ff). Não é busca por
 * substring (não acha "Duplo" digitando "duplo" no meio do nome) —
 * é o limite do que dá pra fazer sem um serviço de busca dedicado
 * (Algolia/Typesense) mantendo custo de leitura baixo em catálogos grandes.
 */
export function buscarProdutosPorPrefixo(termo, { tamanho = 20 } = {}) {
  return withLoading("buscarProdutosPorPrefixo", async () => {
    const termoNormalizado = termo.trim();
    if (!termoNormalizado) return { produtos: [], cursor: null, temMais: false };

    const col = collection(db, "produtos");
    const fim = termoNormalizado + "\uf8ff";
    const snap = await getDocs(query(
      col,
      orderBy("nome"),
      where("nome", ">=", termoNormalizado),
      where("nome", "<=", fim),
      limit(tamanho)
    ));
    const produtos = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.status !== "oculto");
    return { produtos, cursor: snap.docs.at(-1) || null, temMais: snap.docs.length === tamanho };
  });
}

export function escutarProdutos(callback, { apenasAtivos = true } = {}) {
  // Loading cobre só até o primeiro snapshot chegar; atualizações
  // seguintes em tempo real não reacendem o loading global.
  const finalizarPrimeiroSnapshot = beginListener("escutarProdutos");
  return onSnapshot(collection(db, "produtos"), (snap) => {
    let produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (apenasAtivos) produtos = produtos.filter(p => p.status !== "oculto");
    callback(produtos);
    finalizarPrimeiroSnapshot();
  }, (erro) => {
    finalizarPrimeiroSnapshot();
    console.error("[escutarProdutos] erro no listener:", erro);
  });
}

/**
 * Migração única: preenche faixaPreco/disponivel nos produtos que ainda não
 * têm esses campos (todo o catálogo importado antes dessa mudança). Depois
 * de rodada uma vez, criarProduto/atualizarProduto/ajustarEstoque mantêm os
 * dois campos sempre em dia sozinhos — não precisa rodar de novo.
 * Feito em lotes de 400 gravações (limite do writeBatch é 500) pra não
 * estourar limite de escrita/dia do plano gratuito de uma vez só.
 */
export function migrarCamposFiltroCatalogo(onProgresso) {
  return withLoading("migrarCamposFiltroCatalogo", async () => {
    const { writeBatch } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const snap = await getDocs(collection(db, "produtos"));
    const pendentes = snap.docs.filter(d => {
      const dados = d.data();
      return dados.faixaPreco === undefined || dados.disponivel === undefined;
    });

    const TAMANHO_LOTE = 400;
    let feitos = 0;
    for (let i = 0; i < pendentes.length; i += TAMANHO_LOTE) {
      const lote = pendentes.slice(i, i + TAMANHO_LOTE);
      const batch = writeBatch(db);
      lote.forEach(d => {
        const dados = d.data();
        batch.update(d.ref, {
          faixaPreco: calcularFaixaPreco(dados.preco),
          disponivel: calcularDisponivel(dados.status, dados.quantidade)
        });
      });
      await batch.commit();
      feitos += lote.length;
      onProgresso?.(feitos, pendentes.length);
    }
    return { total: pendentes.length };
  });
}

/** Últimos N produtos cadastrados — usado na home ("Recentes"), sem baixar a coleção inteira. */
export function listarProdutosRecentes(tamanho = 8) {
  return withLoading("listarProdutosRecentes", async () => {
    const snap = await getDocs(query(collection(db, "produtos"), orderBy("criadoEm", "desc"), limit(tamanho + 4)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.status !== "oculto").slice(0, tamanho);
  });
}

/** Produtos com etiqueta "Mais Vendido" ou "Promoção" — usado na home ("Destaques"). */
export function listarProdutosDestaque(tamanho = 8) {
  return withLoading("listarProdutosDestaque", async () => {
    const snap = await getDocs(query(
      collection(db, "produtos"),
      where("etiquetas", "array-contains-any", ["Mais Vendido", "Promoção"]),
      limit(tamanho + 4)
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.status !== "oculto").slice(0, tamanho);
  });
}

/** Produtos de uma categoria (até um teto razoável) — usado no filtro rápido da home. */
export function listarProdutosPorCategoria(categoria, tamanho = 60) {
  return withLoading("listarProdutosPorCategoria", async () => {
    if (!categoria) return [];
    const snap = await getDocs(query(collection(db, "produtos"), where("categoria", "==", categoria), limit(tamanho)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.status !== "oculto");
  });
}

export function obterProduto(id) {
  return withLoading("obterProduto", async () => {
    const ref = doc(db, "produtos", id);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  });
}

export function criarProduto(dados) {
  return withLoading("criarProduto", async () => {
    return addDoc(collection(db, "produtos"), {
      ...dados,
      faixaPreco: calcularFaixaPreco(dados.preco),
      disponivel: calcularDisponivel(dados.status, dados.quantidade),
      visualizacoes: 0,
      compartilhamentos: 0,
      criadoEm: serverTimestamp()
    });
  });
}

/**
 * IMPORTANTE: sempre que preco, status ou quantidade mudam, os campos
 * faixaPreco/disponivel precisam ser recalculados junto — são eles que
 * o catálogo público usa pra filtrar sem baixar os 10k+ produtos.
 * Por isso lemos o doc atual antes de gravar (transação), em vez de
 * confiar só no que veio em `dados`.
 */
export function atualizarProduto(id, dados) {
  return withLoading("atualizarProduto", async () => {
    const ref = doc(db, "produtos", id);
    const precisaRecalcular = "preco" in dados || "status" in dados || "quantidade" in dados;
    if (!precisaRecalcular) return updateDoc(ref, dados);

    return runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const atual = snap.exists() ? snap.data() : {};
      const preco = "preco" in dados ? dados.preco : atual.preco;
      const status = "status" in dados ? dados.status : atual.status;
      const quantidade = "quantidade" in dados ? dados.quantidade : atual.quantidade;
      tx.update(ref, {
        ...dados,
        faixaPreco: calcularFaixaPreco(preco),
        disponivel: calcularDisponivel(status, quantidade)
      });
    });
  });
}

export function excluirProduto(id) {
  return withLoading("excluirProduto", async () => {
    return deleteDoc(doc(db, "produtos", id));
  });
}

export function duplicarProduto(produto) {
  return withLoading("duplicarProduto", async () => {
    const { id, ...resto } = produto;
    return criarProduto({ ...resto, nome: `${resto.nome} (cópia)` });
  });
}

export function incrementarVisualizacao(id) {
  return withLoading("incrementarVisualizacao", async () => {
    return updateDoc(doc(db, "produtos", id), { visualizacoes: increment(1) });
  });
}

export function incrementarCompartilhamento(id) {
  return withLoading("incrementarCompartilhamento", async () => {
    return updateDoc(doc(db, "produtos", id), { compartilhamentos: increment(1) });
  });
}

export function ajustarEstoque(id, delta, motivo = "") {
  return withLoading("ajustarEstoque", async () => {
    const ref = doc(db, "produtos", id);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const atual = snap.data() || {};
      const novaQuantidade = (Number(atual.quantidade) || 0) + delta;
      tx.update(ref, {
        quantidade: novaQuantidade,
        disponivel: calcularDisponivel(atual.status, novaQuantidade)
      });
    });
    await addDoc(collection(db, "historicoEstoque"), {
      produtoId: id,
      delta,
      motivo,
      data: serverTimestamp()
    });
  });
}

/**
 * Página do catálogo público com filtros combinados aplicados NO SERVIDOR
 * (categoria, marca, faixaPreco, disponibilidade) — não baixa a coleção
 * inteira mesmo com vários filtros ativos ao mesmo tempo.
 *
 * Limitação que continua de pé: a busca por texto (`termoBusca`) é só
 * "começa com" (prefixo), não full-text — pra busca de verdade dentro do
 * nome (ex.: achar "Caderno Duplo" digitando "duplo") seria necessário um
 * serviço externo (Algolia/Typesense), que é a decisão que ainda está em
 * aberto com você.
 *
 * Na primeira vez que uma combinação de filtro + ordenação nova for usada,
 * o Firestore pode devolver um erro pedindo pra criar um índice composto —
 * é só clicar no link do erro (aparece no console do navegador) uma vez;
 * depois disso a combinação fica rápida pra sempre.
 */
export function buscarProdutosCatalogo({
  tamanho = 24,
  cursor = null,
  categoria = "",
  marcas = [],
  faixasPreco = [],
  disponibilidade = "", // "em_estoque" | "sem_estoque" | ""
  termoBusca = "",
  ordenar = "nome" // "nome" | "preco_asc" | "preco_desc" | "recentes"
} = {}) {
  return withLoading("buscarProdutosCatalogo", async () => {
    const col = collection(db, "produtos");
    const clausulas = [where("status", "!=", "oculto")];

    if (categoria) clausulas.push(where("categoria", "==", categoria));
    if (marcas.length === 1) clausulas.push(where("marca", "==", marcas[0]));
    else if (marcas.length > 1) clausulas.push(where("marca", "in", marcas.slice(0, 10)));
    if (faixasPreco.length === 1) clausulas.push(where("faixaPreco", "==", faixasPreco[0]));
    else if (faixasPreco.length > 1) clausulas.push(where("faixaPreco", "in", faixasPreco.slice(0, 10)));
    if (disponibilidade === "em_estoque") clausulas.push(where("disponivel", "==", true));
    else if (disponibilidade === "sem_estoque") clausulas.push(where("disponivel", "==", false));

    const termo = termoBusca.trim();
    if (termo) {
      // Busca por prefixo precisa que orderBy/where sejam no mesmo campo (nome).
      clausulas.push(where("nome", ">=", termo), where("nome", "<=", termo + "\uf8ff"), orderBy("nome"));
    } else if (ordenar === "preco_asc") clausulas.push(orderBy("preco", "asc"));
    else if (ordenar === "preco_desc") clausulas.push(orderBy("preco", "desc"));
    else if (ordenar === "recentes") clausulas.push(orderBy("criadoEm", "desc"));
    else clausulas.push(orderBy("nome"));

    clausulas.push(limit(tamanho + 1));
    if (cursor) clausulas.push(startAfter(cursor));

    const snap = await getDocs(query(col, ...clausulas));
    let docs = snap.docs;
    const temMais = docs.length > tamanho;
    docs = docs.slice(0, tamanho);
    const produtos = docs.map(d => ({ id: d.id, ...d.data() }));

    return { produtos, cursor: docs.at(-1) || null, temMais };
  });
}

/**
 * Conta quantos produtos batem com um conjunto de filtros, sem baixar os
 * documentos (getCountFromServer = 1 leitura agregada, não N leituras).
 * Usada pros números ao lado de cada opção de filtro no catálogo.
 */
export function contarProdutosCatalogo({
  categoria = "", marca = "", marcas = [], faixaPreco = "", faixasPreco = [], disponibilidade = "", termoBusca = ""
} = {}) {
  return withLoading("contarProdutosCatalogo", async () => {
    const col = collection(db, "produtos");
    const clausulas = [where("status", "!=", "oculto")];
    if (categoria) clausulas.push(where("categoria", "==", categoria));
    const listaMarcas = marca ? [marca] : marcas;
    if (listaMarcas.length === 1) clausulas.push(where("marca", "==", listaMarcas[0]));
    else if (listaMarcas.length > 1) clausulas.push(where("marca", "in", listaMarcas.slice(0, 10)));
    const listaFaixas = faixaPreco ? [faixaPreco] : faixasPreco;
    if (listaFaixas.length === 1) clausulas.push(where("faixaPreco", "==", listaFaixas[0]));
    else if (listaFaixas.length > 1) clausulas.push(where("faixaPreco", "in", listaFaixas.slice(0, 10)));
    if (disponibilidade === "em_estoque") clausulas.push(where("disponivel", "==", true));
    else if (disponibilidade === "sem_estoque") clausulas.push(where("disponivel", "==", false));
    const termo = termoBusca.trim();
    if (termo) clausulas.push(where("nome", ">=", termo), where("nome", "<=", termo + "\uf8ff"));

    const snap = await getCountFromServer(query(col, ...clausulas));
    return snap.data().count;
  });
}

// ---------- CATEGORIAS ----------
export function listarCategorias() {
  return withLoading("listarCategorias", async () => {
    const snap = await getDocs(collection(db, "categorias"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}
export function escutarCategorias(callback) {
  const finalizarPrimeiroSnapshot = beginListener("escutarCategorias");
  return onSnapshot(collection(db, "categorias"), (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    finalizarPrimeiroSnapshot();
  }, (erro) => {
    finalizarPrimeiroSnapshot();
    console.error("[escutarCategorias] erro no listener:", erro);
  });
}
export function criarCategoria(nome, emoji = "", imagem = "") {
  return withLoading("criarCategoria", async () => {
    return addDoc(collection(db, "categorias"), { nome, emoji, imagem });
  });
}
export function atualizarCategoria(id, dados) {
  return withLoading("atualizarCategoria", async () => {
    return updateDoc(doc(db, "categorias", id), dados);
  });
}
export function excluirCategoria(id) {
  return withLoading("excluirCategoria", async () => {
    return deleteDoc(doc(db, "categorias", id));
  });
}

// ---------- MARCAS ----------
export function listarMarcas() {
  return withLoading("listarMarcas", async () => {
    const snap = await getDocs(collection(db, "marcas"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}
export function escutarMarcas(callback) {
  const finalizarPrimeiroSnapshot = beginListener("escutarMarcas");
  return onSnapshot(collection(db, "marcas"), (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    finalizarPrimeiroSnapshot();
  }, (erro) => {
    finalizarPrimeiroSnapshot();
    console.error("[escutarMarcas] erro no listener:", erro);
  });
}
export function criarMarca(dados) {
  return withLoading("criarMarca", async () => {
    return addDoc(collection(db, "marcas"), { ordem: Date.now(), ...dados });
  });
}
export function atualizarMarca(id, dados) {
  return withLoading("atualizarMarca", async () => {
    return updateDoc(doc(db, "marcas", id), dados);
  });
}
export function excluirMarca(id) {
  return withLoading("excluirMarca", async () => {
    return deleteDoc(doc(db, "marcas", id));
  });
}

// ---------- CLIENTES ----------
export function listarClientes() {
  return withLoading("listarClientes", async () => {
    const snap = await getDocs(collection(db, "clientes"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}
export function criarCliente(dados) {
  return withLoading("criarCliente", async () => {
    return addDoc(collection(db, "clientes"), { ...dados, criadoEm: serverTimestamp() });
  });
}
export function atualizarCliente(id, dados) {
  return withLoading("atualizarCliente", async () => {
    return updateDoc(doc(db, "clientes", id), dados);
  });
}
export function excluirCliente(id) {
  return withLoading("excluirCliente", async () => {
    return deleteDoc(doc(db, "clientes", id));
  });
}

// ---------- ETIQUETAS ----------
export function listarEtiquetas() {
  return withLoading("listarEtiquetas", async () => {
    const snap = await getDocs(collection(db, "etiquetas"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}
export function criarEtiqueta(nome) {
  return withLoading("criarEtiqueta", async () => {
    return addDoc(collection(db, "etiquetas"), { nome });
  });
}
export function excluirEtiqueta(id) {
  return withLoading("excluirEtiqueta", async () => {
    return deleteDoc(doc(db, "etiquetas", id));
  });
}

// ---------- LEADS PERDIDOS ----------
export function salvarLeadPerdido(lead) {
  return withLoading("salvarLeadPerdido", async () => {
    return addDoc(collection(db, "leadsPerdidos"), {
      ...lead,
      status: "lead_perdido",
      data: serverTimestamp()
    });
  });
}
export function listarLeadsPerdidos() {
  return withLoading("listarLeadsPerdidos", async () => {
    const snap = await getDocs(query(collection(db, "leadsPerdidos"), orderBy("data", "desc")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}
export function marcarLeadRecuperado(id) {
  return withLoading("marcarLeadRecuperado", async () => {
    return updateDoc(doc(db, "leadsPerdidos", id), { status: "recuperado" });
  });
}

// ---------- PEDIDOS ----------
export function criarPedido(dados) {
  return withLoading("criarPedido", async () => {
    return addDoc(collection(db, "pedidos"), { ...dados, status: "pendente", criadoEm: serverTimestamp() });
  });
}
export function listarPedidosUsuario(usuarioId) {
  return withLoading("listarPedidosUsuario", async () => {
    const snap = await getDocs(query(collection(db, "pedidos"), where("usuarioId", "==", usuarioId)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
  });
}

// ---------- ENDEREÇOS ----------
export function listarEnderecos(usuarioId) {
  return withLoading("listarEnderecos", async () => {
    const snap = await getDocs(query(collection(db, "enderecos"), where("usuarioId", "==", usuarioId)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}
export function criarEndereco(usuarioId, dados) {
  return withLoading("criarEndereco", async () => {
    return addDoc(collection(db, "enderecos"), { ...dados, usuarioId, criadoEm: serverTimestamp() });
  });
}
export function excluirEndereco(id) {
  return withLoading("excluirEndereco", async () => {
    return deleteDoc(doc(db, "enderecos", id));
  });
}

// ---------- PERFIL (preferências / configurações) ----------
export function atualizarPerfilUsuario(uid, dados) {
  return withLoading("atualizarPerfilUsuario", async () => {
    return setDoc(doc(db, "usuarios", uid), dados, { merge: true });
  });
}

// ---------- USUÁRIOS ----------
export function obterPerfilUsuario(uid) {
  return withLoading("obterPerfilUsuario", async () => {
    const ref = doc(db, "usuarios", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  });
}
export function listarUsuarios() {
  return withLoading("listarUsuarios", async () => {
    const snap = await getDocs(collection(db, "usuarios"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}
