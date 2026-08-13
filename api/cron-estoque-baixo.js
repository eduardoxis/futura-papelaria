// api/cron-estoque-baixo.js
// Roda automaticamente todo dia (horário configurado em vercel.json) e manda
// um resumo no WhatsApp com produtos com estoque baixo — usa exatamente os
// campos que o catálogo público já mantém atualizados (disponivel, quantidade).
//
// Pra testar manualmente antes do horário agendado, chame por GET com o
// header de segurança (ver CRON_SECRET abaixo) ou visite a URL direto
// (o Vercel Cron já manda esse header sozinho quando dispara agendado).

import { obterDbAdmin } from "./_firebaseAdmin.js";
import { enviarMensagemWhatsApp } from "./_whatsapp.js";

const LIMITE_ESTOQUE_BAIXO = 3;

export default async function handler(req, res) {
  // O Vercel Cron manda esse header automaticamente; isso evita que
  // qualquer pessoa na internet dispare o job só acessando a URL.
  const segredoEsperado = process.env.CRON_SECRET;
  const segredoRecebido = req.headers.authorization?.replace("Bearer ", "");
  if (segredoEsperado && segredoRecebido !== segredoEsperado) {
    res.status(401).json({ erro: "Não autorizado." });
    return;
  }

  try {
    const db = obterDbAdmin();
    const snap = await db.collection("produtos")
      .where("status", "!=", "oculto")
      .where("quantidade", "<=", LIMITE_ESTOQUE_BAIXO)
      .get();

    const produtos = snap.docs.map(d => d.data()).filter(p => Number(p.quantidade) > 0);

    const numeroAdmin = process.env.WHATSAPP_ADMIN_NUMBER;
    if (!numeroAdmin) {
      res.status(500).json({ erro: "WHATSAPP_ADMIN_NUMBER não configurado." });
      return;
    }

    if (produtos.length === 0) {
      res.status(200).json({ ok: true, avisados: 0, mensagem: "Nenhum produto com estoque baixo hoje." });
      return;
    }

    const lista = produtos
      .slice(0, 20)
      .map(p => `• ${p.nome} — ${p.quantidade} un.`)
      .join("\n");
    const textoExtra = produtos.length > 20 ? `\n...e mais ${produtos.length - 20} produto(s).` : "";

    await enviarMensagemWhatsApp(
      numeroAdmin,
      `📦 *Estoque baixo* (${produtos.length} produto${produtos.length > 1 ? "s" : ""}):\n\n${lista}${textoExtra}`
    );

    res.status(200).json({ ok: true, avisados: produtos.length });
  } catch (erro) {
    console.error("Erro no cron de estoque baixo:", erro);
    res.status(500).json({ erro: "Falha ao checar estoque.", detalhe: erro.message });
  }
}
