// api/feed-produtos.js
// Endpoint público (sem autenticação — o Meta Commerce Manager acessa isso
// direto por URL) que gera o feed de produtos no formato RSS/XML que o Meta
// exige pra alimentar o catálogo do WhatsApp/Instagram/Facebook Shop.
//
// Como usar:
//   1. Depois do deploy, a URL fica: https://SEU-DOMINIO.vercel.app/api/feed-produtos
//   2. No Meta Commerce Manager → Catálogo → Fontes de dados → Programada,
//      cole essa URL. O Meta busca sozinho nesse endereço periodicamente —
//      não precisamos de cron nenhum pra isso, o feed é sempre gerado na hora.
//
// Especificação usada: https://developers.facebook.com/docs/commerce-platform/catalog/fields
//
// IMPORTANTE: ajuste SITE_URL abaixo pro domínio real do seu site depois do deploy.
const SITE_URL = process.env.SITE_URL || "https://futura-papelaria.vercel.app";

import { obterDbAdmin } from "./_firebaseAdmin.js";

function escaparXml(texto = "") {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function itemXml(produto) {
  const disponivel = produto.status !== "sem_estoque" && produto.status !== "oculto" && Number(produto.quantidade) > 0;
  const preco = (Number(produto.preco) || 0).toFixed(2);
  const link = `${SITE_URL}/pages/produto.html?id=${produto.id}`;
  const imagem = produto.imagem || `${SITE_URL}/assets/images/placeholder.svg`;

  return `
  <item>
    <g:id>${escaparXml(produto.id)}</g:id>
    <g:title>${escaparXml(produto.nome)}</g:title>
    <g:description>${escaparXml(produto.descricao || produto.nome)}</g:description>
    <g:link>${escaparXml(link)}</g:link>
    <g:image_link>${escaparXml(imagem)}</g:image_link>
    <g:availability>${disponivel ? "in stock" : "out of stock"}</g:availability>
    <g:price>${preco} BRL</g:price>
    <g:brand>${escaparXml(produto.marca || "Papelaria Futura")}</g:brand>
    <g:condition>new</g:condition>
    ${produto.categoria ? `<g:product_type>${escaparXml(produto.categoria)}</g:product_type>` : ""}
  </item>`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ erro: "Método não permitido." });
    return;
  }

  try {
    const db = obterDbAdmin();
    const snap = await db.collection("produtos").where("status", "!=", "oculto").get();
    const produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const itens = produtos.map(itemXml).join("");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>Papelaria Futura</title>
  <link>${escaparXml(SITE_URL)}</link>
  <description>Catálogo de produtos — Papelaria Futura</description>
  ${itens}
</channel>
</rss>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    // Cache curto de borda — o Meta não bate aqui a cada request de cliente,
    // então isso só evita gerar o XML de novo em buscas repetidas próximas.
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
    res.status(200).send(xml);
  } catch (erro) {
    console.error("Erro ao gerar feed de produtos:", erro);
    res.status(500).json({ erro: "Falha ao gerar o feed.", detalhe: erro.message });
  }
}
