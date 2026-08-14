// js/auth.js
import { auth, db } from "../../firebase/firebase-config.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, sendPasswordResetEmail, updateProfile,
  setPersistence, browserLocalPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { toast } from "../utils/utils.js";
import { withLoading, beginListener } from "../utils/loadingManager.js";

export let usuarioAtual = null;
export let perfilAtual = null;

export function ouvirEstadoAuth(callback) {
  // O app espera esse primeiro retorno pra saber se tem usuário logado
  // ou não; por isso conta como loading até a primeira resposta.
  const finalizarPrimeiroEstado = beginListener("ouvirEstadoAuth");
  onAuthStateChanged(auth, async (user) => {
    usuarioAtual = user;
    try {
      if (user) {
        const ref = doc(db, "usuarios", user.uid);
        const snap = await getDoc(ref);
        perfilAtual = snap.exists() ? snap.data() : { cargos: ["cliente"] };
      } else {
        perfilAtual = null;
      }
      callback(usuarioAtual, perfilAtual);
    } finally {
      finalizarPrimeiroEstado();
    }
  });
}

export function ehAdmin() {
  return !!perfilAtual?.cargos?.includes("admin");
}

export function entrar(email, senha, manterLogin = true) {
  return withLoading("entrar", async () => {
    try {
      // "Manter conectado" marcado -> sessão sobrevive ao fechar o navegador
      // (browserLocalPersistence). Desmarcado -> some ao fechar a aba/janela
      // (browserSessionPersistence), útil em computador compartilhado.
      await setPersistence(auth, manterLogin ? browserLocalPersistence : browserSessionPersistence);
      const { user } = await signInWithEmailAndPassword(auth, email, senha);
      return user;
    } catch (err) {
      toast(traduzErroAuth(err.code), "error");
      throw err;
    }
  });
}

export function cadastrar(dados) {
  return withLoading("cadastrar", async () => {
    try {
      const { email, senha, ...perfil } = dados;
      const { user } = await createUserWithEmailAndPassword(auth, email, senha);
      const nomeExibicao = perfil.nome || perfil.responsavel || perfil.razaoSocial || "";
      if (nomeExibicao) await updateProfile(user, { displayName: nomeExibicao });
      await setDoc(doc(db, "usuarios", user.uid), {
        email, cargos: ["cliente"], criadoEm: new Date().toISOString(), ...perfil
      });
      return user;
    } catch (err) {
      toast(traduzErroAuth(err.code), "error");
      throw err;
    }
  });
}

export function atualizarNomeAuth(nome) {
  return withLoading("atualizarNomeAuth", async () => {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { displayName: nome });
  });
}

export function sair() {
  return withLoading("sair", async () => {
    await signOut(auth);
    window.location.href = "/index.html";
  });
}

export function redefinirSenha(email) {
  return withLoading("redefinirSenha", async () => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      toast(traduzErroAuth(err.code), "error");
      throw err;
    }
  });
}

function traduzErroAuth(code) {
  const mapa = {
    "auth/invalid-credential": "E-mail ou senha inválidos.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco antes de tentar de novo."
  };
  return mapa[code] || "Ocorreu um erro. Tente novamente.";
}
