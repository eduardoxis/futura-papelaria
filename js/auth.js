// js/auth.js
import { auth, db } from "../firebase/firebase-config.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { toast } from "./utils.js";

export let usuarioAtual = null;
export let perfilAtual = null;

export function ouvirEstadoAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    usuarioAtual = user;
    if (user) {
      const ref = doc(db, "usuarios", user.uid);
      const snap = await getDoc(ref);
      perfilAtual = snap.exists() ? snap.data() : { cargos: ["cliente"] };
    } else {
      perfilAtual = null;
    }
    callback(usuarioAtual, perfilAtual);
  });
}

export function ehAdmin() {
  return !!perfilAtual?.cargos?.includes("admin");
}

export async function entrar(email, senha) {
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, senha);
    return user;
  } catch (err) {
    toast(traduzErroAuth(err.code), "error");
    throw err;
  }
}

export async function cadastrar(nome, email, senha) {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, senha);
    await setDoc(doc(db, "usuarios", user.uid), {
      nome, email, cargos: ["cliente"], criadoEm: new Date().toISOString()
    });
    return user;
  } catch (err) {
    toast(traduzErroAuth(err.code), "error");
    throw err;
  }
}

export async function sair() {
  await signOut(auth);
  window.location.href = "/index.html";
}

function traduzErroAuth(code) {
  const mapa = {
    "auth/invalid-credential": "E-mail ou senha inválidos.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres."
  };
  return mapa[code] || "Ocorreu um erro. Tente novamente.";
}
