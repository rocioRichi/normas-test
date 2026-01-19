import "./style.css";
import { QUESTION_BANK } from "./questions.js";

/* =======================
   Storage (por alumno)
======================= */
const LS_KEY = "normas_profiles_v1";
const LAST_STUDENT_KEY = "normas_last_student";

function loadProfiles() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {};
  } catch {
    return {};
  }
}
function saveProfiles(p) {
  localStorage.setItem(LS_KEY, JSON.stringify(p));
}
function normName(s) {
  return (s || "").trim().slice(0, 24);
}
function ensureProfile(profiles, name) {
  if (!profiles[name]) profiles[name] = { name, attempts: [] };
  return profiles[name];
}
function percent(correct, total) {
  if (!total) return 0;
  return Math.round((correct / total) * 100);
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

/* =======================
   Helpers
======================= */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function shuffleQuestionChoices(q) {
  // Solo para tipo test
  if (q.type !== "mc") return q;

  const correctText = q.choices[q.correctIndex];
  const newChoices = shuffle(q.choices);

  const newCorrectIndex = newChoices.findIndex((c) => c === correctText);

  return {
    ...q,
    choices: newChoices,
    correctIndex: newCorrectIndex,
  };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function show(el) {
  el.classList.remove("hidden");
}
function hide(el) {
  el.classList.add("hidden");
}

/* =======================
   DOM
======================= */
const screenStart = document.getElementById("screen-start");
const screenQuiz = document.getElementById("screen-quiz");
const screenResults = document.getElementById("screen-results");

const studentNameEl = document.getElementById("studentName");
const numQuestionsEl = document.getElementById("numQuestions");
const modeEl = document.getElementById("mode");
const btnStart = document.getElementById("btnStart");

const progressEl = document.getElementById("progress");
const questionTitleEl = document.getElementById("questionTitle");
const questionTextEl = document.getElementById("questionText");
const answersForm = document.getElementById("answers");

const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const btnFinish = document.getElementById("btnFinish");

const resultsSummaryEl = document.getElementById("resultsSummary");
const personalSummaryEl = document.getElementById("personalSummary");
const correctionsEl = document.getElementById("corrections");
const attemptHistoryEl = document.getElementById("attemptHistory");
const btnRestart = document.getElementById("btnRestart");

/* =======================
   State
======================= */
let quiz = [];
let idx = 0;
let userAnswers = new Map();

/* =======================
   Quiz building
======================= */
function buildQuiz(mode, count) {
  const filtered = QUESTION_BANK.filter((q) => q.type === mode);
  const picked = shuffle(filtered).slice(0, clamp(count, 1, filtered.length));

  // Barajar opciones en preguntas tipo test
  return picked.map(shuffleQuestionChoices);
}

/* =======================
   Navigation
======================= */
function goToStart() {
  show(screenStart);
  hide(screenQuiz);
  hide(screenResults);
  quiz = [];
  idx = 0;
  userAnswers = new Map();
}
function goToQuiz() {
  hide(screenStart);
  show(screenQuiz);
  hide(screenResults);
}

/* =======================
   Render question
======================= */
function renderQuestion() {
  const q = quiz[idx];
  progressEl.textContent = `Pregunta ${idx + 1} de ${quiz.length}`;
  questionTitleEl.textContent = q.norm;
  questionTextEl.textContent = q.question;

  answersForm.innerHTML = "";
  const saved = userAnswers.get(q.id);

  if (q.type === "mc") {
    q.choices.forEach((choice, i) => {
      const id = `opt-${q.id}-${i}`;
      const wrapper = document.createElement("label");
      wrapper.className = "option";
      wrapper.htmlFor = id;

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "answer";
      input.id = id;
      input.value = String(i);
      input.checked = saved?.value === i;

      input.addEventListener("change", () => {
        userAnswers.set(q.id, { type: "mc", value: i });
      });

      const text = document.createElement("div");
      text.textContent = choice;

      wrapper.appendChild(input);
      wrapper.appendChild(text);
      answersForm.appendChild(wrapper);
    });
  } else {
    const opts = [
      { label: "Verdadero", value: true },
      { label: "Falso", value: false },
    ];
    opts.forEach((opt) => {
      const id = `opt-${q.id}-${opt.value}`;
      const wrapper = document.createElement("label");
      wrapper.className = "option";
      wrapper.htmlFor = id;

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "answer";
      input.id = id;
      input.value = String(opt.value);
      input.checked = saved?.value === opt.value;

      input.addEventListener("change", () => {
        userAnswers.set(q.id, { type: "tf", value: opt.value });
      });

      const text = document.createElement("div");
      text.textContent = opt.label;

      wrapper.appendChild(input);
      wrapper.appendChild(text);
      answersForm.appendChild(wrapper);
    });
  }

  btnPrev.disabled = idx === 0;
  const last = idx === quiz.length - 1;
  if (last) {
    hide(btnNext);
    show(btnFinish);
  } else {
    show(btnNext);
    hide(btnFinish);
  }
}

/* =======================
   Results
======================= */
function computeResults() {
  let correct = 0;

  const details = quiz.map((q) => {
    const ans = userAnswers.get(q.id);

    let isCorrect = false;
    let userText = "Sin responder";
    let correctText = "";

    if (q.type === "mc") {
      correctText = q.choices[q.correctIndex];
      if (ans && typeof ans.value === "number") {
        userText = q.choices[ans.value];
        isCorrect = ans.value === q.correctIndex;
      }
    } else {
      correctText = q.correctBool ? "Verdadero" : "Falso";
      if (ans && typeof ans.value === "boolean") {
        userText = ans.value ? "Verdadero" : "Falso";
        isCorrect = ans.value === q.correctBool;
      }
    }

    if (isCorrect) correct++;

    return {
      norm: q.norm,
      question: q.question,
      userText,
      correctText,
      isCorrect,
      explanation: q.explanation || "",
    };
  });

  const total = quiz.length;
  const wrong = total - correct;
  return { total, correct, wrong, details };
}

function renderAttemptHistory(student) {
  const profiles = loadProfiles();
  const attempts = profiles?.[student]?.attempts || [];

  if (!attemptHistoryEl) return;

  if (attempts.length === 0) {
    attemptHistoryEl.innerHTML = `<tr><td colspan="5">Aún no hay intentos guardados.</td></tr>`;
    return;
  }

  attemptHistoryEl.innerHTML = attempts
    .slice(0, 10)
    .map(
      (a) => `
    <tr>
      <td>${escapeHtml(fmtDate(a.at))}</td>
      <td>${a.mode === "mc" ? "Tipo test" : "V/F"}</td>
      <td>${a.correct}/${a.total}</td>
      <td>${a.errors}</td>
      <td class="percent">${a.percent}%</td>
    </tr>
  `,
    )
    .join("");
}

function renderResults() {
  const { total, correct, wrong, details } = computeResults();
  const pct = percent(correct, total);

  const student =
    normName(studentNameEl.value) ||
    normName(localStorage.getItem(LAST_STUDENT_KEY));
  const mode = modeEl.value; // "mc" | "tf"

  // Guardar intento (SIEMPRE con %)
  if (student) {
    const profiles = loadProfiles();
    const profile = ensureProfile(profiles, student);

    profile.attempts.unshift({
      at: new Date().toISOString(),
      mode,
      total,
      correct,
      errors: wrong,
      percent: pct,
    });

    // guardar últimos 30 por alumno
    profile.attempts = profile.attempts.slice(0, 30);

    saveProfiles(profiles);
  }

  resultsSummaryEl.textContent = `Total: ${total} · Aciertos: ${correct} · Errores: ${wrong} · %: ${pct}%`;

  personalSummaryEl.textContent = student
    ? `Alumno: ${student} · Modo: ${mode === "mc" ? "Tipo test" : "V/F"}`
    : `Alumno: (sin nombre)`;

  // Tabla historial
  if (student) renderAttemptHistory(student);
  else
    attemptHistoryEl.innerHTML = `<tr><td colspan="5">Escribe un nombre para guardar historial.</td></tr>`;

  // Corrección
  correctionsEl.innerHTML = "";
  details.forEach((d, i) => {
    const card = document.createElement("div");
    card.className = "correction";

    const h = document.createElement("h4");
    h.textContent = `${i + 1}. ${d.norm} — ${d.isCorrect ? "✅" : "❌"}`;

    const pQ = document.createElement("div");
    pQ.innerHTML = `<span class="pill">Pregunta</span> ${escapeHtml(d.question)}`;

    const pU = document.createElement("div");
    pU.innerHTML = `<span class="pill ${d.isCorrect ? "good" : "bad"}">Tu respuesta</span> ${escapeHtml(d.userText)}`;

    const pC = document.createElement("div");
    pC.innerHTML = `<span class="pill good">Correcta</span> ${escapeHtml(d.correctText)}`;

    const small = document.createElement("small");
    small.textContent = d.explanation;

    card.appendChild(h);
    card.appendChild(pQ);
    card.appendChild(pU);
    card.appendChild(pC);
    if (d.explanation) card.appendChild(small);

    correctionsEl.appendChild(card);
  });

  hide(screenQuiz);
  show(screenResults);
}

/* =======================
   Events
======================= */
btnStart.addEventListener("click", () => {
  const student = normName(studentNameEl.value);
  if (!student) {
    alert("Escribe un nombre o apodo (sirve para guardar tu historial).");
    studentNameEl.focus();
    return;
  }
  localStorage.setItem(LAST_STUDENT_KEY, student);

  const mode = modeEl.value;
  const count = Number(numQuestionsEl.value);

  quiz = buildQuiz(mode, count);
  idx = 0;
  userAnswers = new Map();

  goToQuiz();
  renderQuestion();
});

btnPrev.addEventListener("click", () => {
  idx = Math.max(0, idx - 1);
  renderQuestion();
});

btnNext.addEventListener("click", () => {
  idx = Math.min(quiz.length - 1, idx + 1);
  renderQuestion();
});

btnFinish.addEventListener("click", () => {
  renderResults();
});

btnRestart.addEventListener("click", () => {
  goToStart();
});

const last = localStorage.getItem(LAST_STUDENT_KEY);
if (last) studentNameEl.value = last;

goToStart();
