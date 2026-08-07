// firebase/firebase-config.js
// Substitua pelos dados do SEU projeto Firebase (Configurações do projeto > Config do SDK)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUEeATkY2Hu4k_b8QeI5FZBFVHdpLg3fY",
  authDomain: "futura-papelaria-2f76e.firebaseapp.com",
  projectId: "futura-papelaria-2f76e",
  storageBucket: "futura-papelaria-2f76e.firebasestorage.app",
  messagingSenderId: "1085584938085",
  appId: "1:1085584938085:web:9566022868bd0cafa9e28c"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Configurações gerais da loja — edite aqui
export const STORE_CONFIG = {
  nome: "Livraria Papelaria Futura",
  whatsapp: "5561999184452", // DDI+DDD+numero, sem espaços/símbolos
  endereco: "R. Dr. Ézio Carneiro, 158 - St. Aeroporto, Luziânia - GO, 72800-420",
  email: "futuralza@gmail.com",
  instagram: "https://www.instagram.com/futurapapelaria/"
};
