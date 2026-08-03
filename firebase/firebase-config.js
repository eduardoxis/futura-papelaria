// firebase/firebase-config.js
// Substitua pelos dados do SEU projeto Firebase (Configurações do projeto > Config do SDK)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCnG5frwT1bngZcgXjYKILdHe3hPvXHcSQ",
  authDomain: "futura-papelaria.firebaseapp.com",
  projectId: "futura-papelaria",
  storageBucket: "futura-papelaria.firebasestorage.app",
  messagingSenderId: "906321437911",
  appId: "1:906321437911:web:b2b930737ae507ee0dfc92"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Configurações gerais da loja — edite aqui
export const STORE_CONFIG = {
  nome: "Papelaria Futura",
  whatsapp: "5561999999999", // DDI+DDD+numero, sem espaços/símbolos
  endereco: "Rua Exemplo, 123 - Centro",
  instagram: "https://instagram.com/papelariafutura",
  facebook: "https://facebook.com/papelariafutura"
};
