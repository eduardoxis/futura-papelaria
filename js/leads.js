// js/leads.js
import { listarLeadsPerdidos, marcarLeadRecuperado } from "./firestore.js";
import { formatBRL, formatDate, escHtml } from "./utils.js";
import { STORE_CONFIG } from "../firebase/firebase-config.js";

export async function carregarPainelLeads(container) {
  const leads = await listarLeadsPerdidos();
  const perdidos = leads.filter(l => l.status === "lead_perdido");
  const recuperados = leads.filter(l => l.status === "recuperado");
  const valorPerdido = perdidos.reduce((acc, l) => acc + (l.valor || 0), 0);
  const taxaRecuperacao = leads.length ? Math.round((recuperados.length / leads.length) * 100) : 0;

  container.innerHTML = `
    <div class="leads-stats">
      <div class="stat-card"><span>${perdidos.length}</span><label>Leads perdidos</label></div>
      <div class="stat-card"><span>${formatBRL(valorPerdido)}</span><label>Valor potencial perdido</label></div>
      <div class="stat-card"><span>${taxaRecuperacao}%</span><label>Taxa de recuperação</label></div>
    </div>
    <div class="table-wrap">
      <table class="admin-table">
        <thead><tr><th>Data</th><th>Nome</th><th>Produtos</th><th>Valor</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${leads.map(l => `
            <tr data-id="${l.id}">
              <td>${l.data?.seconds ? formatDate(new Date(l.data.seconds * 1000)) : "-"}</td>
              <td>${escHtml(l.nome || "Não informado")}</td>
              <td>${(l.produtos || []).map(p => escHtml(p.nome)).join(", ")}</td>
              <td>${formatBRL(l.valor)}</td>
              <td><span class="status-pill status-${l.status}">${l.status === "recuperado" ? "Recuperado" : "Perdido"}</span></td>
              <td>
                ${l.status !== "recuperado" ? `<button class="btn-recover" data-id="${l.id}" data-tel="${escHtml(l.telefone || "")}">Enviar WhatsApp</button>` : ""}
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;

  container.querySelectorAll(".btn-recover").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const tel = btn.dataset.tel || STORE_CONFIG.whatsapp;
      window.open(`https://wa.me/${tel}?text=${encodeURIComponent("Olá! Vi que você demonstrou interesse em alguns produtos. Posso te ajudar a finalizar o pedido? 😊")}`, "_blank");
      await marcarLeadRecuperado(id);
      carregarPainelLeads(container);
    });
  });
}
