// api/whatsapp-webhook.js
// Endpoint que a Meta chama de duas formas:
//   GET  — uma vez, na hora de você cadastrar o webhook no painel (handshake
//          de verificação: a Meta manda um "desafio" e espera ele de volta).
//   POST — toda vez que chega mensagem nova de um cliente no seu número.
//
// Como configurar no Meta for Developers → seu app → WhatsApp → Configuration:
//   Callback URL:      https://SEU-DOMINIO.vercel.app/api/whatsapp-webhook
//   Verify token:       o mesmo valor que você colocar em WHATSAPP_VERIFY_TOKEN
//   Webhook fields:      marque "messages"

import { enviarMensagemWhatsApp } from "./_whatsapp.js";

const SITE_URL = process.env.SITE_URL || "https://futura-papelaria.vercel.app";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const modo = req.query["hub.mode"];
    const tokenRecebido = req.query["hub.verify_token"];
    const desafio = req.query["hub.challenge"];

    if (modo === "subscribe" && tokenRecebido === process.env.WHATSAPP_VERIFY_TOKEN) {
      res.status(200).send(desafio);
      return;
    }
    res.status(403).send("Token de verificação inválido.");
    return;
  }

  if (req.method === "POST") {
    try {
      const entrada = req.body?.entry?.[0]?.changes?.[0]?.value;
      const mensagem = entrada?.messages?.[0];

      // A Meta também manda notificações de status (entregue/lido) sem
      // mensagem nenhuma — respondemos 200 sempre, mas só processamos
      // quando existe uma mensagem de texto de verdade.
      if (mensagem?.type === "text") {
        const de = mensagem.from;
        const texto = mensagem.text.body.trim().toLowerCase();

        if (texto.includes("catalogo") || texto.includes("catálogo") || texto.includes("produtos")) {
          await enviarMensagemWhatsApp(
            de,
            `Confira nosso catálogo completo aqui: ${SITE_URL}/pages/catalogo.html`
          );
        } else {
          await enviarMensagemWhatsApp(
            de,
            "Olá! 👋 Digite *catálogo* pra ver nossos produtos, ou aguarde que já te respondemos por aqui."
          );
        }
      }

      res.status(200).json({ recebido: true });
    } catch (erro) {
      console.error("Erro no webhook do WhatsApp:", erro);
      // Sempre responde 200 pra Meta não ficar reenviando o mesmo evento
      // em loop achando que falhou — o erro real fica só no log do Vercel.
      res.status(200).json({ recebido: true, erroInterno: true });
    }
    return;
  }

  res.status(405).json({ erro: "Método não permitido." });
}
