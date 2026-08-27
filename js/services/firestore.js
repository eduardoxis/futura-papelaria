// js/services/firestore.js
import { db } from "../../firebase/firebase-config.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc,
  query, where, orderBy, limit, startAfter, serverTimestamp, increment, onSnapshot,
  runTransaction, getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { withLoading, beginListener } from "../utils/loadingManager.js";

// ---------- CACHE COM TTL (reduz leituras repetidas do Firestore) ----------
// Cada página (home, catálogo, produto) importa este módulo de forma
// independente, então sem isso um único visitante navegando por 3 páginas
// já dispara 3 leituras completas de "categorias", 3 de "marcas" etc. Como
// esses dados mudam pouco, cacheamos em sessionStorage por alguns minutos —
// cai drasticamente o consumo de cota do Firestore sem afetar UX (o admin
// sempre invalida o cache ao salvar uma mudança, ver invalidarCache abaixo).
const TTL_PADRAO_MS = 5 * 60 * 1000; // 5 min

function lerCache(chave) {
  try {
    const bruto = sessionStorage.getItem(`fcache:${chave}`);
    if (!bruto) return undefined;
    const { valor, expiraEm } = JSON.parse(bruto);
    if (Date.now() > expiraEm) {
      sessionStorage.removeItem(`fcache:${chave}`);
      return undefined;
    }
    return valor;
  } catch {
    return undefined;
  }
}

function salvarCache(chave, valor, ttlMs = TTL_PADRAO_MS) {
  try {
    sessionStorage.setItem(`fcache:${chave}`, JSON.stringify({ valor, expiraEm: Date.now() + ttlMs }));
  } catch {
    // sessionStorage cheio/indisponível (modo privado) — segue sem cache.
  }
}

/**
 * Chame após criar/editar/excluir para a próxima leitura vir atualizada.
 * Remove tanto a chave exata quanto variantes com argumentos (ex:
 * "listarProdutosDestaque:[8]"), já que comCache() sufixa a chave com os
 * argumentos recebidos.
 */
export function invalidarCache(chave) {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k === `fcache:${chave}` || k.startsWith(`fcache:${chave}:`))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch { /* ignora */ }
}

/** Envolve uma função assíncrona de leitura com cache em sessionStorage. */
function comCache(chave, ttlMs, fn) {
  return async (...args) => {
    const chaveCompleta = args.length ? `${chave}:${JSON.stringify(args)}` : chave;
    const emCache = lerCache(chaveCompleta);
    if (emCache !== undefined) return emCache;
    const valor = await fn(...args);
    salvarCache(chaveCompleta, valor, ttlMs);
    return valor;
  };
}

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
export function listarProdutosPagina({ tamanho = 20, cursor = null, categoria = "", apenasAtivos = true, ordenarPor = "nome", direcao = "asc" } = {}) {
  return withLoading("listarProdutosPagina", async () => {
    const col = collection(db, "produtos");
    const clausulas = [orderBy(ordenarPor, direcao)];
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
export const listarProdutosRecentes = comCache("listarProdutosRecentes", 3 * 60 * 1000, (tamanho = 8) =>
  withLoading("listarProdutosRecentes", async () => {
    const snap = await getDocs(query(collection(db, "produtos"), orderBy("criadoEm", "desc"), limit(tamanho + 4)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.status !== "oculto").slice(0, tamanho);
  })
);

/** Produtos com etiqueta "Mais Vendido" ou "Promoção" — usado na home ("Destaques"). */
export const listarProdutosDestaque = comCache("listarProdutosDestaque", 3 * 60 * 1000, (tamanho = 8) =>
  withLoading("listarProdutosDestaque", async () => {
    const snap = await getDocs(query(
      collection(db, "produtos"),
      where("etiquetas", "array-contains-any", ["Mais Vendido", "Promoção"]),
      limit(tamanho + 4)
    ));
    const produtos = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.status !== "oculto").slice(0, tamanho);
    if (produtos.length) return produtos;

    try {
      const snapRecentes = await getDocs(query(
        collection(db, "produtos"),
        orderBy("criadoEm", "desc"),
        limit(tamanho + 4)
      ));
      const recentes = snapRecentes.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.status !== "oculto").slice(0, tamanho);
      if (recentes.length) return recentes;
    } catch { /* segue pro fallback final abaixo */ }

    // Último fallback: se nada tiver etiqueta de destaque nem campo
    // criadoEm válido pra ordenar (ex: produtos importados em lote sem
    // esse campo), pega qualquer produto ativo em vez de mostrar vazio.
    const snapTodos = await getDocs(query(collection(db, "produtos"), limit(tamanho + 4)));
    return snapTodos.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.status !== "oculto").slice(0, tamanho);
  })
);

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

function invalidarCacheVitrinesHome() {
  invalidarCache("listarProdutosDestaque");
  invalidarCache("listarProdutosRecentes");
}

export function criarProduto(dados) {
  return withLoading("criarProduto", async () => {
    const resultado = await addDoc(collection(db, "produtos"), {
      ...dados,
      faixaPreco: calcularFaixaPreco(dados.preco),
      disponivel: calcularDisponivel(dados.status, dados.quantidade),
      visualizacoes: 0,
      compartilhamentos: 0,
      criadoEm: serverTimestamp()
    });
    invalidarCacheVitrinesHome();
    return resultado;
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
    if (!precisaRecalcular) {
      const resultado = await updateDoc(ref, dados);
      invalidarCacheVitrinesHome();
      return resultado;
    }

    const resultado = await runTransaction(db, async (tx) => {
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
    invalidarCacheVitrinesHome();
    return resultado;
  });
}

export function excluirProduto(id) {
  return withLoading("excluirProduto", async () => {
    const resultado = await deleteDoc(doc(db, "produtos", id));
    invalidarCacheVitrinesHome();
    return resultado;
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
/**
 * Traz do Firestore só o conjunto restrito por, no máximo, UM campo de
 * igualdade (categoria OU marca) + status != oculto — essa é a única
 * combinação que usa índice composto, e já temos os dois criados
 * (categoria+status e marca+status). Todo filtro adicional (a outra marca,
 * faixa de preço, disponibilidade, busca por nome) e toda ordenação
 * acontecem aqui no navegador depois. Isso evita ficar pedindo um índice
 * novo pra cada combinação de filtros que o cliente escolher.
 */
async function buscarConjuntoRestrito({ categoria, marcas }) {
  const col = collection(db, "produtos");
  const clausulas = [where("status", "!=", "oculto")];

  if (categoria) clausulas.push(where("categoria", "==", categoria));
  else if (marcas.length === 1) clausulas.push(where("marca", "==", marcas[0]));

  const snap = await getDocs(query(col, ...clausulas));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function aplicarFiltrosClientSide(produtos, { categoria, marcas, faixasPreco, disponibilidade, termo }) {
  let lista = produtos;
  if (categoria) lista = lista.filter(p => p.categoria === categoria);
  if (marcas.length) lista = lista.filter(p => marcas.includes(p.marca));
  if (faixasPreco.length) lista = lista.filter(p => faixasPreco.includes(p.faixaPreco));
  if (disponibilidade === "em_estoque") lista = lista.filter(p => p.disponivel === true);
  else if (disponibilidade === "sem_estoque") lista = lista.filter(p => p.disponivel === false);
  if (termo) {
    const termoNormalizado = normalizarTexto(termo);
    lista = lista.filter(p => normalizarTexto(p.nome).includes(termoNormalizado));
  }
  return lista;
}

function ordenarProdutos(produtos, ordenar) {
  const lista = [...produtos];
  if (ordenar === "preco_asc") lista.sort((a, b) => (Number(a.preco) || 0) - (Number(b.preco) || 0));
  else if (ordenar === "preco_desc") lista.sort((a, b) => (Number(b.preco) || 0) - (Number(a.preco) || 0));
  else if (ordenar === "recentes") lista.sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
  else lista.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  return lista;
}

/**
 * Remove acentos e caixa pra comparar texto de forma tolerante
 * (ex: "cabo" bate com "Cabo USB 3.1" e "café" bate com "CAFE").
 */
function normalizarTexto(txt) {
  return String(txt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

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
    const brutos = await buscarConjuntoRestrito({ categoria, marcas });
    const filtrados = aplicarFiltrosClientSide(brutos, {
      categoria, marcas, faixasPreco, disponibilidade, termo: termoBusca.trim()
    });
    const ordenados = ordenarProdutos(filtrados, ordenar);

    // Cursor virou um offset numérico (não doc snapshot) já que a
    // paginação agora é feita em memória, sobre a lista já filtrada.
    const offset = typeof cursor === "number" ? cursor : 0;
    const pagina = ordenados.slice(offset, offset + tamanho);
    const temMais = offset + tamanho < ordenados.length;

    // total já sai de graça daqui (mesma lista filtrada, antes de paginar) —
    // evita repetir buscarConjuntoRestrito só pra contar (era 2x a mesma
    // leitura completa da coleção a cada render, quando não há filtro de
    // categoria/marca ativo).
    return { produtos: pagina, cursor: temMais ? offset + tamanho : null, temMais, total: ordenados.length };
  });
}

/**
 * Conta quantos produtos batem com um conjunto de filtros. Usa o mesmo
 * conjunto restrito + filtro client-side de buscarProdutosCatalogo, então
 * não pede índice novo nenhum além dos dois que já existem.
 */
export function contarProdutosCatalogo({
  categoria = "", marca = "", marcas = [], faixaPreco = "", faixasPreco = [], disponibilidade = "", termoBusca = ""
} = {}) {
  return withLoading("contarProdutosCatalogo", async () => {
    const listaMarcas = marca ? [marca] : marcas;
    const listaFaixas = faixaPreco ? [faixaPreco] : faixasPreco;

    const brutos = await buscarConjuntoRestrito({ categoria, marcas: listaMarcas });
    const filtrados = aplicarFiltrosClientSide(brutos, {
      categoria, marcas: listaMarcas, faixasPreco: listaFaixas, disponibilidade, termo: termoBusca.trim()
    });
    return filtrados.length;
  });
}

// ---------- CATEGORIAS ----------
// Muda pouco (só quando o admin mexe no painel) — cache mais longo (10 min)
// e invalidado explicitamente nas funções de escrita logo abaixo.
export const listarCategorias = comCache("listarCategorias", 10 * 60 * 1000, () =>
  withLoading("listarCategorias", async () => {
    const snap = await getDocs(collection(db, "categorias"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  })
);
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
    const resultado = await addDoc(collection(db, "categorias"), { nome, emoji, imagem });
    invalidarCache("listarCategorias");
    return resultado;
  });
}
export function atualizarCategoria(id, dados) {
  return withLoading("atualizarCategoria", async () => {
    const resultado = await updateDoc(doc(db, "categorias", id), dados);
    invalidarCache("listarCategorias");
    return resultado;
  });
}
export function excluirCategoria(id) {
  return withLoading("excluirCategoria", async () => {
    const resultado = await deleteDoc(doc(db, "categorias", id));
    invalidarCache("listarCategorias");
    return resultado;
  });
}

// ---------- MARCAS ----------
export const listarMarcas = comCache("listarMarcas", 10 * 60 * 1000, () =>
  withLoading("listarMarcas", async () => {
    const snap = await getDocs(collection(db, "marcas"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  })
);
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
    const resultado = await addDoc(collection(db, "marcas"), { ordem: Date.now(), ...dados });
    invalidarCache("listarMarcas");
    return resultado;
  });
}
export function atualizarMarca(id, dados) {
  return withLoading("atualizarMarca", async () => {
    const resultado = await updateDoc(doc(db, "marcas", id), dados);
    invalidarCache("listarMarcas");
    return resultado;
  });
}
export function excluirMarca(id) {
  return withLoading("excluirMarca", async () => {
    const resultado = await deleteDoc(doc(db, "marcas", id));
    invalidarCache("listarMarcas");
    return resultado;
  });
}

// ---------- CLIENTES ----------
// Igual categorias/marcas/etiquetas: cache de 10 min em vez de baixar a
// coleção inteira toda vez que o admin entra na aba Clientes (antes disso
// não tinha cache nenhum aqui — era refetch completo a cada troca de aba).
export const listarClientes = comCache("listarClientes", 10 * 60 * 1000, () =>
  withLoading("listarClientes", async () => {
    const snap = await getDocs(collection(db, "clientes"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  })
);
export function criarCliente(dados) {
  return withLoading("criarCliente", async () => {
    const resultado = await addDoc(collection(db, "clientes"), { ...dados, criadoEm: serverTimestamp() });
    invalidarCache("listarClientes");
    return resultado;
  });
}
export function atualizarCliente(id, dados) {
  return withLoading("atualizarCliente", async () => {
    const resultado = await updateDoc(doc(db, "clientes", id), dados);
    invalidarCache("listarClientes");
    return resultado;
  });
}
export function excluirCliente(id) {
  return withLoading("excluirCliente", async () => {
    const resultado = await deleteDoc(doc(db, "clientes", id));
    invalidarCache("listarClientes");
    return resultado;
  });
}

// ---------- ETIQUETAS ----------
export const listarEtiquetas = comCache("listarEtiquetas", 10 * 60 * 1000, () =>
  withLoading("listarEtiquetas", async () => {
    const snap = await getDocs(collection(db, "etiquetas"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  })
);
export function criarEtiqueta(nome) {
  return withLoading("criarEtiqueta", async () => {
    const resultado = await addDoc(collection(db, "etiquetas"), { nome });
    invalidarCache("listarEtiquetas");
    return resultado;
  });
}
export function excluirEtiqueta(id) {
  return withLoading("excluirEtiqueta", async () => {
    const resultado = await deleteDoc(doc(db, "etiquetas", id));
    invalidarCache("listarEtiquetas");
    return resultado;
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

// ---------- ALERTAS DE ESTOQUE BAIXO (gerados pelo cron diário) ----------
export function listarUltimoAlertaEstoque() {
  return withLoading("listarUltimoAlertaEstoque", async () => {
    const snap = await getDocs(query(
      collection(db, "alertasEstoque"),
      orderBy("criadoEm", "desc"),
      limit(1)
    ));
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  });
}
