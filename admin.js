/* ===========================================================
   ELITE BARBER — admin.js
   Login obrigatório + gestão de agendamentos (Google Sheets)
   =========================================================== */

// >>> Use o MESMO URL do Web App configurado em script.js <<<
const API_URL = "https://script.google.com/macros/s/AKfycbxWzfq4UrxIQdQWI--f5cBr_pOtUTaeyyMCHmPuOENZPlr_K7ndo4mfsOkOu6A15iD1SA/exec";

const loginView = document.getElementById("loginView");
const panelView = document.getElementById("panelView");
const topbarActions = document.getElementById("topbarActions");

document.addEventListener("DOMContentLoaded", () => {
  const token = sessionStorage.getItem("eb_token");
  if (token) {
    mostrarPainel();
  }
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
});

async function handleLogin(e) {
  e.preventDefault();
  const usuario = document.getElementById("usuario").value.trim();
  const senha = document.getElementById("senha").value;
  const msg = document.getElementById("loginMsg");
  msg.className = "form-msg";

  if (!API_URL || API_URL.includes("COLE_AQUI")) {
    msg.classList.add("err");
    msg.textContent = "Backend não configurado ainda — defina API_URL em admin.js (ver LEIA-ME.md).";
    return;
  }

  try {
    const resp = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "login", usuario, senha })
    });
    const json = await resp.json();

    if (json.status === "ok" && json.token) {
      sessionStorage.setItem("eb_token", json.token);
      sessionStorage.setItem("eb_user", usuario);
      mostrarPainel();
    } else {
      msg.classList.add("err");
      msg.textContent = json.mensagem || "Utilizador ou senha incorretos.";
    }
  } catch (err) {
    msg.classList.add("err");
    msg.textContent = "Erro ao ligar ao servidor.";
    console.error(err);
  }
}

function mostrarPainel() {
  loginView.style.display = "none";
  panelView.style.display = "block";
  topbarActions.innerHTML = `<button class="btn outline" id="btnLogout">Sair</button>`;
  document.getElementById("btnLogout").addEventListener("click", () => {
    sessionStorage.removeItem("eb_token");
    location.reload();
  });
  document.getElementById("btnAtualizar").addEventListener("click", carregarAgendamentos);
  document.getElementById("filtroData").addEventListener("change", carregarAgendamentos);
  document.getElementById("ordenacao").addEventListener("change", () => renderTabela(ultimaLista));
  carregarAgendamentos();
}

let ultimaLista = []; // guarda os agendamentos já carregados, para reordenar sem novo pedido ao servidor

async function carregarAgendamentos() {
  const wrap = document.getElementById("tableWrap");
  wrap.innerHTML = `<p class="empty-state">A carregar agendamentos...</p>`;
  const token = sessionStorage.getItem("eb_token");
  const data = document.getElementById("filtroData").value;

  try {
    const url = `${API_URL}?action=listBookings&token=${encodeURIComponent(token)}${data ? `&data=${data}` : ""}`;
    const resp = await fetch(url);
    const json = await resp.json();

    if (json.status !== "ok") {
      wrap.innerHTML = `<p class="empty-state">Sessão inválida ou expirada. <a href="admin.html">Entrar novamente</a>.</p>`;
      sessionStorage.removeItem("eb_token");
      return;
    }

    renderStats(json.contagem || {}, json.total || 0);
    ultimaLista = json.agendamentos || [];
    renderTabela(ultimaLista);
  } catch (err) {
    wrap.innerHTML = `<p class="empty-state">Erro ao carregar dados do servidor.</p>`;
    console.error(err);
  }
}

// Serviços fixos oferecidos pela barbearia (mantém a ordem mesmo com contagem 0)
const SERVICOS_LISTA = ["Corte de cabelo", "Barba", "Corte + Barba", "Tratamento capilar"];

function renderStats(contagem, total) {
  const statsGrid = document.getElementById("statsGrid");

  const cards = SERVICOS_LISTA.map(servico => `
    <div class="stat-card">
      <div class="stat-label">${servico}</div>
      <div class="stat-value">${contagem[servico] || 0}</div>
    </div>
  `).join("");

  statsGrid.innerHTML = cards + `
    <div class="stat-card total">
      <div class="stat-label">Total (sem cancelados)</div>
      <div class="stat-value">${total}</div>
    </div>
  `;
}

function renderTabela(lista) {
  const wrap = document.getElementById("tableWrap");
  if (lista.length === 0) {
    wrap.innerHTML = `<p class="empty-state">Nenhum agendamento encontrado.</p>`;
    return;
  }

  const ordenacao = document.getElementById("ordenacao").value;
  const listaOrdenada = [...lista].sort((a, b) => {
    if (ordenacao === "recente") {
      // mais recentes primeiro = pela data/hora em que o agendamento foi CRIADO
      return new Date(b.timestamp) - new Date(a.timestamp);
    }
    // padrão: mais próximos primeiro = pela data/hora do PRÓPRIO agendamento
    return (a.data + a.hora).localeCompare(b.data + b.hora);
  });

  const linhas = listaOrdenada.map(a => `
    <tr data-id="${a.id}">
      <td>${a.data} · ${a.hora}</td>
      <td>${a.nome}</td>
      <td>${a.telefone}<br><small style="color:var(--muted)">${a.email}</small></td>
      <td>${a.servico}</td>
      <td><small style="color:var(--muted)">${formatarCriadoEm(a.timestamp)}</small></td>
      <td><span class="status-tag ${a.status.toLowerCase()}">${a.status}</span></td>
      <td class="row-actions">
        <button data-status="Concluído">Concluído</button>
        <button data-status="Cancelado">Cancelar</button>
        <button data-delete="true" class="btn-delete">Apagar</button>
      </td>
    </tr>
  `).join("");

  wrap.innerHTML = `
    <table class="bookings">
      <thead>
        <tr><th>Data / Hora</th><th>Cliente</th><th>Contacto</th><th>Serviço</th><th>Criado em</th><th>Estado</th><th>Ações</th></tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  `;

  wrap.querySelectorAll("button[data-status]").forEach(btn => {
    btn.addEventListener("click", () => atualizarStatus(
      btn.closest("tr").dataset.id,
      btn.dataset.status
    ));
  });

  wrap.querySelectorAll("button[data-delete]").forEach(btn => {
    btn.addEventListener("click", () => {
      const linha = btn.closest("tr");
      const nomeCliente = linha.querySelectorAll("td")[1].textContent.trim();
      const confirmado = confirm(`Apagar definitivamente o agendamento de "${nomeCliente}"?\n\nEsta ação não pode ser desfeita.`);
      if (confirmado) apagarAgendamento(linha.dataset.id);
    });
  });
}

function formatarCriadoEm(timestamp) {
  if (!timestamp) return "—";
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return "—";
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${dia}/${mes} ${h}:${m}`;
}

async function apagarAgendamento(id) {
  const token = sessionStorage.getItem("eb_token");
  try {
    const resp = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "deleteBooking", token, id })
    });
    const json = await resp.json();
    if (json.status === "ok") {
      carregarAgendamentos();
    } else {
      alert(json.mensagem || "Não foi possível apagar o agendamento.");
    }
  } catch (err) {
    alert("Erro ao ligar ao servidor.");
    console.error(err);
  }
}

async function atualizarStatus(id, status) {
  const token = sessionStorage.getItem("eb_token");
  try {
    const resp = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "updateStatus", token, id, status })
    });
    const json = await resp.json();
    if (json.status === "ok") {
      carregarAgendamentos();
    } else {
      alert(json.mensagem || "Não foi possível atualizar.");
    }
  } catch (err) {
    alert("Erro ao ligar ao servidor.");
    console.error(err);
  }
}
