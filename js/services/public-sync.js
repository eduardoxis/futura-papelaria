import { db } from "../../firebase/firebase-config.js";
import { doc, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Um único documento é observado pelos visitantes. Isso evita listeners em
// todas as coleções (produtos, categorias, marcas...) e mantém o consumo do
// plano gratuito baixo: só há uma leitura extra quando o painel muda algo.
const VERSAO_PUBLICA = doc(db, "publicacoes", "catalogo");

export async function sinalizarAtualizacaoPublica() {
  await setDoc(VERSAO_PUBLICA, { atualizadoEm: serverTimestamp() }, { merge: true });
}

export function observarAtualizacaoPublica(aoAtualizar) {
  let primeiraLeitura = true;
  return onSnapshot(VERSAO_PUBLICA, () => {
    // A primeira leitura apenas estabelece a versão atual; não recarrega a
    // página toda vez que alguém entra no site.
    if (primeiraLeitura) {
      primeiraLeitura = false;
      return;
    }
    aoAtualizar();
  }, (erro) => {
    // Caso as regras antigas ainda estejam publicadas, a loja continua
    // funcionando normalmente; apenas a atualização automática fica inativa.
    console.warn("Atualização em tempo real indisponível:", erro.code || erro);
  });
}
