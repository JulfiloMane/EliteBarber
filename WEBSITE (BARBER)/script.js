/* ===========================================================
   ELITE BARBER — script.js
   Validações do formulário + integração com Google Sheets
   (via Google Apps Script Web App — ver Code.gs e LEIA-ME.md)
   =========================================================== */

// >>> SUBSTITUA pelo URL do seu Web App depois de publicar o Code.gs <<<
const API_URL = "https://script.google.com/macros/s/AKfycbwqRz4d9LuZVOjeboAf5KQzKK4wsAadFkYro15cp0pangj5GpTInnOqvhw1o8CNrNIz0w/exec";

// Horários de atendimento oferecidos (pode ajustar)
const HORARIOS_PADRAO = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"
];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year").textContent = new Date().getFullYear();

  // menu mobile
  const toggle = document.getElementById("menuToggle");
  const menu = document.getElementById("mainMenu");
  toggle.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  menu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
    menu.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }));

  // data mínima = hoje
  const dataInput = document.getElementById("data");
  const hoje = new Date().toISOString().split("T")[0];
  dataInput.setAttribute("min", hoje);
  dataInput.addEventListener("change", () => carregarHorarios(dataInput.value));

  document.getElementById("bookingForm").addEventListener("submit", handleSubmit);
});

/* -----------------------------------------------------------
   Carrega os horários disponíveis para a data escolhida,
   ocultando os que já foram reservados por outros clientes.
----------------------------------------------------------- */
async function carregarHorarios(data) {
  const select = document.getElementById("hora");
  select.innerHTML = `<option value="">A verificar disponibilidade...</option>`;
  select.disabled = true;

  let ocupados = [];
  try {
    if (API_URL && !API_URL.includes("COLE_AQUI")) {
      const resp = await fetch(`${API_URL}?action=getSlots&data=${data}`);
      const json = await resp.json();
      ocupados = json.ocupados || [];
    }
  } catch (err) {
    console.warn("Não foi possível consultar horários no servidor:", err);
  }

  const disponiveis = HORARIOS_PADRAO.filter(h => !ocupados.includes(h));

  select.innerHTML = `<option value="">Selecione um horário</option>` +
    disponiveis.map(h => `<option value="${h}">${h}</option>`).join("") +
    (disponiveis.length === 0 ? `<option value="" disabled>Sem horários livres nesta data</option>` : "");

  select.disabled = false;
}

/* -----------------------------------------------------------
   Validações
----------------------------------------------------------- */
function validarNome(v) {
  // aceita letras (incl. acentuadas), espaços, apóstrofo e hífen — sem números
  return /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{3,60}$/.test(v.trim());
}
function validarTelefone(v) {
  // apenas dígitos, 9 a 12 caracteres
  return /^[0-9]{9,12}$/.test(v.trim());
}
function validarEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function marcarInvalido(fieldId, invalido) {
  document.getElementById(fieldId).classList.toggle("invalid", invalido);
}

/* -----------------------------------------------------------
   Submissão do formulário
----------------------------------------------------------- */
async function handleSubmit(e) {
  e.preventDefault();

  const nome = document.getElementById("nome").value;
  const telefone = document.getElementById("telefone").value;
  const email = document.getElementById("email").value;
  const servico = document.getElementById("servico").value;
  const data = document.getElementById("data").value;
  const hora = document.getElementById("hora").value;

  let valido = true;

  if (!validarNome(nome)) { marcarInvalido("fieldNome", true); valido = false; } else marcarInvalido("fieldNome", false);
  if (!validarTelefone(telefone)) { marcarInvalido("fieldTelefone", true); valido = false; } else marcarInvalido("fieldTelefone", false);
  if (!validarEmail(email)) { marcarInvalido("fieldEmail", true); valido = false; } else marcarInvalido("fieldEmail", false);
  if (!servico) { marcarInvalido("fieldServico", true); valido = false; } else marcarInvalido("fieldServico", false);
  if (!data) { marcarInvalido("fieldData", true); valido = false; } else marcarInvalido("fieldData", false);
  if (!hora) { marcarInvalido("fieldHora", true); valido = false; } else marcarInvalido("fieldHora", false);

  const msg = document.getElementById("formMsg");
  msg.className = "form-msg";

  if (!valido) {
    msg.classList.add("err");
    msg.textContent = "Por favor corrija os campos assinalados.";
    return;
  }

  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "A enviar...";

  const payload = { action: "book", nome, telefone, email, servico, data, hora };

  try {
    if (!API_URL || API_URL.includes("COLE_AQUI")) {
      throw new Error("API_URL não configurado");
    }

    const resp = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const json = await resp.json();

    if (json.status === "ok") {
      msg.classList.add("ok");
      msg.textContent = "Agendamento confirmado! Entraremos em contacto se necessário.";
      e.target.reset();
      document.getElementById("hora").innerHTML = `<option value="">Selecione a data primeiro</option>`;
    } else {
      msg.classList.add("err");
      msg.textContent = json.mensagem || "Não foi possível confirmar. Esse horário pode já ter sido reservado.";
      if (data) carregarHorarios(data);
    }
  } catch (err) {
    msg.classList.add("err");
    msg.textContent = "Ligue o backend (Google Apps Script) em script.js — API_URL — para ativar o agendamento real. Veja o LEIA-ME.md.";
    console.error(err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirmar agendamento";
  }
}
