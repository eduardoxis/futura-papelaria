// api/_whatsapp.js
// Helper compartilhado pra enviar mensagens pela WhatsApp Cloud API oficial
// (Meta). Usado pelo webhook (respostas automáticas) e pelo cron (alertas).
//
// Variáveis de ambiente necessárias:
//   WHATSAPP_TOKEN          — token de acesso permanente do app no Meta
//   WHATSAPP_PHONE_NUMBER_ID — ID do número configurado na Cloud API
//   WHATSAPP_VERIFY_TOKEN   — string qualquer que você escolhe, usada só na
//                              verificação do webhook (ver api/whatsapp-webhook.js)
//   WHATSAPP_ADMIN_NUMBER   — número (com DDI, ex: 5561999184452) que recebe
//                              os alertas automáticos (estoque baixo etc.)
//
// Onde conseguir: Meta for Developers → seu app → WhatsApp → API Setup.

export async function enviarMensagemWhatsApp(numeroDestino, texto) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error(
      "Faltam WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID nas variáveis de ambiente."
    );
  }

  const resp = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: numeroDestino,
      type: "text",
      text: { body: texto }
    })
  });

  const dados = await resp.json();
  if (!resp.ok) {
    throw new Error(`Falha ao enviar WhatsApp: ${JSON.stringify(dados)}`);
  }
  return dados;
}
