// js/firestore.js
import { db } from "../firebase/firebase-config.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc,
  query, where, orderBy, limit, serverTimestamp, increment, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- PRODUTOS ----------
export async function listarProdutos({ apenasAtivos = true } = {}) {
  const col = collection(db, "produtos");
  const snap = await getDocs(col);
  let produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (apenasAtivos) produtos = produtos.filter(p => p.status !== "oculto");
  return produtos;
}

export function escutarProdutos(callback, { apenasAtivos = true } = {}) {
  return onSnapshot(collection(db, "produtos"), (snap) => {
    let produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (apenasAtivos) produtos = produtos.filter(p => p.status !== "oculto");
    callback(produtos);
  });
}

export async function obterProduto(id) {
  const ref = doc(db, "produtos", id);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function criarProduto(dados) {
  return addDoc(collection(db, "produtos"), {
    ...dados,
    visualizacoes: 0,
    compartilhamentos: 0,
    criadoEm: serverTimestamp()
  });
}

export async function atualizarProduto(id, dados) {
  return updateDoc(doc(db, "produtos", id), dados);
}

export async function excluirProduto(id) {
  return deleteDoc(doc(db, "produtos", id));
}

export async function duplicarProduto(produto) {
  const { id, ...resto } = produto;
  return criarProduto({ ...resto, nome: `${resto.nome} (cópia)` });
}

export async function incrementarVisualizacao(id) {
  return updateDoc(doc(db, "produtos", id), { visualizacoes: increment(1) });
}

export async function incrementarCompartilhamento(id) {
  return updateDoc(doc(db, "produtos", id), { compartilhamentos: increment(1) });
}

export async function ajustarEstoque(id, delta, motivo = "") {
  const ref = doc(db, "produtos", id);
  await updateDoc(ref, { quantidade: increment(delta) });
  await addDoc(collection(db, "historicoEstoque"), {
    produtoId: id,
    delta,
    motivo,
    data: serverTimestamp()
  });
}

// ---------- CATEGORIAS ----------
export async function listarCategorias() {
  const snap = await getDocs(collection(db, "categorias"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export function escutarCategorias(callback) {
  return onSnapshot(collection(db, "categorias"), (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
export async function criarCategoria(nome, emoji = "") {
  return addDoc(collection(db, "categorias"), { nome, emoji });
}
export async function atualizarCategoria(id, dados) {
  return updateDoc(doc(db, "categorias", id), dados);
}
export async function excluirCategoria(id) {
  return deleteDoc(doc(db, "categorias", id));
}

// ---------- ETIQUETAS ----------
export async function listarEtiquetas() {
  const snap = await getDocs(collection(db, "etiquetas"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function criarEtiqueta(nome) {
  return addDoc(collection(db, "etiquetas"), { nome });
}
export async function excluirEtiqueta(id) {
  return deleteDoc(doc(db, "etiquetas", id));
}

// ---------- LEADS PERDIDOS ----------
export async function salvarLeadPerdido(lead) {
  return addDoc(collection(db, "leadsPerdidos"), {
    ...lead,
    status: "lead_perdido",
    data: serverTimestamp()
  });
}
export async function listarLeadsPerdidos() {
  const snap = await getDocs(query(collection(db, "leadsPerdidos"), orderBy("data", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function marcarLeadRecuperado(id) {
  return updateDoc(doc(db, "leadsPerdidos", id), { status: "recuperado" });
}

// ---------- PEDIDOS ----------
export async function criarPedido(dados) {
  return addDoc(collection(db, "pedidos"), { ...dados, status: "pendente", criadoEm: serverTimestamp() });
}
export async function listarPedidosUsuario(usuarioId) {
  const snap = await getDocs(query(collection(db, "pedidos"), where("usuarioId", "==", usuarioId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
}

// ---------- ENDEREÇOS ----------
export async function listarEnderecos(usuarioId) {
  const snap = await getDocs(query(collection(db, "enderecos"), where("usuarioId", "==", usuarioId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function criarEndereco(usuarioId, dados) {
  return addDoc(collection(db, "enderecos"), { ...dados, usuarioId, criadoEm: serverTimestamp() });
}
export async function excluirEndereco(id) {
  return deleteDoc(doc(db, "enderecos", id));
}

// ---------- PERFIL (preferências / configurações) ----------
export async function atualizarPerfilUsuario(uid, dados) {
  return setDoc(doc(db, "usuarios", uid), dados, { merge: true });
}

// ---------- USUÁRIOS ----------
export async function obterPerfilUsuario(uid) {
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
export async function listarUsuarios() {
  const snap = await getDocs(collection(db, "usuarios"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
