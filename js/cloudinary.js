// js/cloudinary.js
// Upload de imagens para o Cloudinary (plano gratuito) usando um "unsigned
// upload preset" — não expõe nenhuma chave secreta no navegador, só o
// cloud name e o nome do preset, que são públicos por natureza.
//
// Como configurar (uma vez só, gratuito):
// 1. Crie uma conta em https://cloudinary.com
// 2. No Dashboard, copie o "Cloud name" e cole em CLOUDINARY_CONFIG.cloudName
// 3. Em Settings > Upload > Upload presets, crie um preset novo, marque o
//    modo como "Unsigned" e cole o nome dele em CLOUDINARY_CONFIG.uploadPreset
export const CLOUDINARY_CONFIG = {
  cloudName: "zrcf5mxc",
  uploadPreset: "papelaria-futura",
  pasta: "papelaria-futura"
};

/**
 * Envia um Blob (já convertido para WebP) para o Cloudinary e retorna a
 * URL pública e segura (https) da imagem hospedada.
 */
export async function enviarImagemParaCloudinary(blob, nomeArquivo = "produto") {
  if (CLOUDINARY_CONFIG.cloudName === "SEU_CLOUD_NAME_AQUI") {
    throw new Error("Configure o Cloudinary em js/cloudinary.js antes de enviar imagens.");
  }

  const form = new FormData();
  form.append("file", blob, `${nomeArquivo}.webp`);
  form.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
  form.append("folder", CLOUDINARY_CONFIG.pasta);

  const resp = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
    { method: "POST", body: form }
  );

  if (!resp.ok) {
    const erro = await resp.json().catch(() => null);
    throw new Error(erro?.error?.message || "Falha ao enviar imagem para o Cloudinary.");
  }

  const dados = await resp.json();
  return dados.secure_url;
}

/**
 * Migração de dados antigos: produtos/categorias/marcas que ainda tenham
 * imagem em base64 (arquitetura anterior, salva direto no Firestore) são
 * convertidas para WebP e reenviadas ao Cloudinary; o documento passa a
 * guardar só a URL pública, igual aos uploads novos.
 */
export async function migrarImagensAntigas(onProgresso) {
  const {
    listarProdutos, atualizarProduto,
    listarCategorias, atualizarCategoria,
    listarMarcas, atualizarMarca
  } = await import("./firestore.js");

  const alvos = [];
  (await listarProdutos({ apenasAtivos: false })).forEach(p => {
    if (p.imagem?.startsWith("data:image")) {
      alvos.push({ tipo: "produto", id: p.id, campo: "imagem", valor: p.imagem, nome: p.nome, atualizar: atualizarProduto });
    }
  });
  (await listarCategorias()).forEach(c => {
    if (c.imagem?.startsWith("data:image")) {
      alvos.push({ tipo: "categoria", id: c.id, campo: "imagem", valor: c.imagem, nome: c.nome, atualizar: atualizarCategoria });
    }
  });
  (await listarMarcas()).forEach(m => {
    if (m.logo?.startsWith("data:image")) {
      alvos.push({ tipo: "marca", id: m.id, campo: "logo", valor: m.logo, nome: m.nome, atualizar: atualizarMarca });
    }
  });

  let feitos = 0;
  let erros = 0;
  for (const alvo of alvos) {
    try {
      const blobOriginal = await (await fetch(alvo.valor)).blob();
      const webp = await converterBlobParaWebP(blobOriginal);
      const url = await enviarImagemParaCloudinary(webp, alvo.nome || alvo.tipo);
      await alvo.atualizar(alvo.id, { [alvo.campo]: url });
    } catch (erro) {
      erros++;
      console.error(`Falha ao migrar ${alvo.tipo} "${alvo.nome}":`, erro);
    }
    feitos++;
    onProgresso?.(feitos, alvos.length);
  }
  return { total: alvos.length, erros };
}

function converterBlobParaWebP(blob, maxWidth = 800, qualidade = 0.8) {
  return new Promise((resolve, reject) => {
    createImageBitmap(blob).then((bitmap) => {
      const scale = Math.min(1, maxWidth / bitmap.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao converter para WebP"))), "image/webp", qualidade);
    }).catch(reject);
  });
}
