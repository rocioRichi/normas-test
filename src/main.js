import "./style.css";
import { QUESTION_BANK } from "./questions.js";

/* ---------- Helpers ---------- */

const LS_KEY = "normas_test_profiles_v1";

function loadProfiles() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProfiles(profiles) {
  localStorage.setItem(LS_KEY, JSON.stringify(profiles));
}

function normName(name) {
  return (name || "").trim().slice(0, 20);
}

function ensureProfile(profiles, name) {
  if (!profiles[name]) {
    profiles[name] = {
      name,
      createdAt: new Date().toISOString(),
      lastMode: "mc",
      stats: {
        mc: { attempts: 0, bestCorrect: null, bestErrors: null, history: [] },
        tf: { attempts: 0, bestCorrect: null, bestErrors: null, history: [] },
      },
    };
  }
  return profiles[name];
}

function pushHistory(arr, item, max = 20) {
  arr.unshift(item);
  if (arr.length > max) arr.length = max;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/* ---------- DOM ---------- */
const screenStart = document.getElementById("screen-start");
const screenQuiz = document.getElementById("screen-quiz");
const screenResults = document.getElementById("screen-results");

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
const correctionsEl = document.getElementById("corrections");
const btnRestart = document.getElementById("btnRestart");

const studentNameEl = document.getElementById("studentName");
const personalRecordEl = document.getElementById("personalRecord");

/* ---------- State ---------- */
let quiz = []; // selected questions
let idx = 0; // current question index
let userAnswers = new Map(); // questionId -> { type, value }

/* ---------- Quiz building ---------- */
function buildQuiz(mode, count) {
  const filtered = QUESTION_BANK.filter((q) => q.type === mode);
  const picked = shuffle(filtered).slice(0, clamp(count, 1, filtered.length));
  return picked;
}

function show(el) {
  el.classList.remove("hidden");
}
function hide(el) {
  el.classList.add("hidden");
}

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

/* ---------- Rendering ---------- */
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
  } else if (q.type === "tf") {
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

  // buttons
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

function renderResults() {
  const { total, correct, wrong, details } = computeResults();
  // ===== GUARDAR RESULTADO PERSONAL =====
  const studentName =
    normName(studentNameEl.value) ||
    normName(localStorage.getItem("normas_last_student"));

  const mode = modeEl.value; // "mc" o "tf"

  if (studentName) {
    const profiles = loadProfiles();
    const profile = ensureProfile(profiles, studentName);

    profile.lastMode = mode;

    const s = profile.stats[mode];
    s.attempts += 1;

    if (s.bestCorrect === null || correct > s.bestCorrect) {
      s.bestCorrect = correct;
    }
    if (s.bestErrors === null || wrong < s.bestErrors) {
      s.bestErrors = wrong;
    }

    pushHistory(s.history, {
      at: new Date().toISOString(),
      correct,
      total,
      wrong,
    });

    saveProfiles(profiles);
    // --- Mostrar registro personal ---
    const studentName2 =
      normName(studentNameEl.value) ||
      normName(localStorage.getItem("normas_last_student"));
    if (studentName2) {
      const profiles = loadProfiles();
      const p = profiles[studentName2];
      const s = p?.stats?.[mode];
      if (s) {
        personalRecordEl.textContent = `Alumno: ${studentName2} · Intentos (${mode.toUpperCase()}): ${s.attempts} · Mejor: ${s.bestCorrect}/${total} · Menos errores: ${s.bestErrors}`;
      } else {
        personalRecordEl.textContent = `Alumno: ${studentName2}`;
      }
    } else {
      personalRecordEl.textContent = "";
    }
  }
  // ===== FIN GUARDADO =====

  resultsSummaryEl.textContent = `Total: ${total} · Aciertos: ${correct} · Errores: ${wrong}`;

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

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------- Events ---------- */
btnStart.addEventListener("click", () => {
  const studentName = normName(studentNameEl.value);
  if (!studentName) {
    alert("Escribe tu nombre o apodo para guardar tu progreso.");
    studentNameEl.focus();
    return;
  }
  localStorage.setItem("normas_last_student", studentName);

  const mode = modeEl.value; // "mc" | "tf"
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

goToStart();
const last = localStorage.getItem("normas_last_student");
if (last && studentNameEl) studentNameEl.value = last;
