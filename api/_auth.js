// api/_auth.js
// Verifica o ID token do Firebase enviado no header Authorization e confirma
// que o usuário tem cargo "admin" no Firestore. Lança erro (com .status) se
// não estiver autenticado ou não for admin — use dentro de um try/catch.

import { getAuth } from "firebase-admin/auth";
import { obterDbAdmin } from "./_firebaseAdmin.js";

export async function exigirAdmin(req) {
  const cabecalho = req.headers.authorization || "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;
  if (!token) {
    const erro = new Error("Não autenticado.");
    erro.status = 401;
    throw erro;
  }

  let decodificado;
  try {
    decodificado = await getAuth().verifyIdToken(token);
  } catch {
    const erro = new Error("Sessão inválida ou expirada.");
    erro.status = 401;
    throw erro;
  }

  const db = obterDbAdmin();
  const snap = await db.collection("usuarios").doc(decodificado.uid).get();
  const cargos = snap.exists ? snap.data()?.cargos || [] : [];
  if (!cargos.includes("admin")) {
    const erro = new Error("Acesso restrito a administradores.");
    erro.status = 403;
    throw erro;
  }

  return decodificado.uid;
}
