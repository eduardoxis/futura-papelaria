// api/_rateLimit.js
// Limite de uso simples baseado em Firestore (sobrevive a "cold starts" da
// function, diferente de uma variável em memória). Cada chamada grava um
// timestamp num array e conta quantos caíram na janela de tempo.
//
// Uso: await aplicarLimite(`cloudinary:${uid}`, { maximo: 20, janelaMs: 10 * 60 * 1000 })
// Lança erro com status 429 se o limite for excedido.

import { obterDbAdmin } from "./_firebaseAdmin.js";
import { FieldValue } from "firebase-admin/firestore";

export async function aplicarLimite(chave, { maximo, janelaMs }) {
  const db = obterDbAdmin();
  const ref = db.collection("limitesUso").doc(chave);
  const agora = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const historico = snap.exists ? (snap.data().chamadas || []) : [];
    const dentroDaJanela = historico.filter((t) => agora - t < janelaMs);

    if (dentroDaJanela.length >= maximo) {
      const erro = new Error("Muitas requisições em pouco tempo. Aguarde um instante e tente novamente.");
      erro.status = 429;
      throw erro;
    }

    dentroDaJanela.push(agora);
    tx.set(ref, { chamadas: dentroDaJanela, atualizadoEm: FieldValue.serverTimestamp() });
  });
}
