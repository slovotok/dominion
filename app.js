/* DOMINION
   - Offline-first PWA
   - Data in localStorage (simple + reliable on iOS)
   - 7-day dashboard + scoring + export/import JSON
*/

const LS_KEY = "dominion:data:v1";

const DAY_BLOCKS = [
  {
    id: "move",
    time: "6:00–7:00",
    title: "RUCH + RESET MÓZGU",
    desc: "Trening / bieganie / mobilność / spacer / zimny prysznic / zero telefonu",
    weight: 1,
    fields: [{ key: "quality", type: "score10", label: "Jakość (1–10)", tip: "Oceń wykonanie: intensywność, obecność, brak telefonu, reset." }]
  },
  {
    id: "study",
    time: "7:00–10:00",
    title: "NAUKA DO EGZAMINÓW",
    desc: "Blok głęboki",
    weight: 2,
    fields: [{ key: "quality", type: "score10", label: "Jakość (1–10)", tip: "1 = rozproszenie, 10 = pełen deep work (bez przerw i scrolla)." }]
  },
  {
    id: "lang1",
    time: "10:00–12:00",
    title: "JĘZYKI + KOMUNIKACJA",
    desc: "Globalna przewaga, charyzma, kontrola rozmowy",
    weight: 2,
    fields: [
      { key: "quality", type: "score10", label: "Jakość (1–10)", tip: "Na ile była praktyka świadoma i trudna (a nie łatwe konsumowanie)." },
      { key: "minutes", type: "number", label: "Minuty mówienia", tip: "Ile realnie mówiłaś (na głos). Nawet 5–10 min ma wartość." },
      { key: "notes", type: "text", label: "Notatki", tip: "Słowa, schematy zdań, feedback, wnioski komunikacyjne." }
    ]
  },
  {
    id: "break",
    time: "12:00–13:00",
    title: "PRZERWA",
    desc: "Regeneracja",
    weight: 1,
    fields: [{ key: "quality", type: "score10", label: "Jakość przerwy (1–10)", tip: "1 = scroll i chaos, 10 = realny reset (ruch, posiłek, spokój)." }]
  },
  {
    id: "create",
    time: "13:00–15:00",
    title: "TWORZENIE",
    desc: "Montaż, scenariusze, eksperymenty",
    weight: 1,
    fields: [
      { key: "quality", type: "score10", label: "Jakość (1–10)", tip: "Czy powstał konkretny output, czy było dłubanie bez efektu." },
      { key: "hours", type: "number", label: "Godziny", tip: "Ile godzin realnego tworzenia (może być 0.5, 1.5 itd.)." },
      { key: "notes", type: "text", label: "Notatki", tip: "Co stworzyłaś, co poprawić, co testować dalej." }
    ]
  },
  {
    id: "invest",
    time: "15:00–16:00",
    title: "INWESTOWANIE",
    desc: "1h głęboka nauka",
    weight: 1.5,
    fields: [
      { key: "quality", type: "score10", label: "Jakość (1–10)", tip: "Czy była to aktywna nauka (notatki, rozumienie), a nie pasywne czytanie." }
    ]
  },
  {
    id: "lang2",
    time: "16:00–17:00",
    title: "DRUGI JĘZYK",
    desc: "Np. rosyjski",
    weight: 1,
    fields: [
      { key: "quality", type: "score10", label: "Jakość (1–10)", tip: "Realna praktyka i trudność materiału." },
      { key: "minutes", type: "number", label: "Minuty", tip: "Czas praktyki: mówienie, shadowing, ćwiczenia." },
      { key: "notes", type: "text", label: "Notatki", tip: "Słowa, zwroty, gramatyka, błędy." }
    ]
  },
  {
    id: "flow",
    time: "17:00–19:00",
    title: "FLOW",
    desc: "Gry strategiczne, twórczość, lekki rozwój",
    weight: 1,
    fields: [{ key: "quality", type: "score10", label: "Jakość (1–10)", tip: "Czy flow było świadome, a nie autopilot." }]
  },
  {
    id: "analyze",
    time: "19:00–21:00",
    title: "ANALIZA + PLAN",
    desc: "Podsumowanie dnia, plan jutra, notatki",
    weight: 1,
    fields: [
      { key: "quality", type: "score10", label: "Jakość (1–10)", tip: "Czy wyciągnęłaś wnioski i zaplanowałaś jutro jasno." },
      { key: "notes", type: "text", label: "Notatki / plan", tip: "3 rzeczy: co działało, co nie, 1 priorytet na jutro." }
    ]
  }
];

// ---- Utilities ----
const $ = (sel) => document.querySelector(sel);

function isoDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromIsoDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function clamp(n, min, max) {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  return Math.max(min, Math.min(max, n));
}
function asNumber(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function percent(n) {
  return `${Math.round(n)}%`;
}

// ---- Storage ----
function loadAll() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { days: {} };
    const parsed = JSON.parse(raw);
    if (!parsed.days) parsed.days = {};
    return parsed;
  } catch {
    return { days: {} };
  }
}
function saveAll(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}
function getDay(data, dayKey) {
  if (!data.days[dayKey]) {
    data.days[dayKey] = defaultDay();
  }
  return data.days[dayKey];
}
function defaultDay() {
  const blocks = {};
  for (const b of DAY_BLOCKS) blocks[b.id] = {};
  return {
    blocks,
    mental: { energy: null, discipline: null, coherence: null },
    thoughts: "",
    investing: { level: "1", learned: "", understanding: null, notes: "" }
  };
}

// ---- Scoring ----
// Score: weighted average of block qualities (0..10) -> %
// Missing quality: ignored (so you can track partial days)
function computeDailyScore(day) {
  let wSum = 0;
  let vSum = 0;

  for (const block of DAY_BLOCKS) {
    const q = asNumber(day.blocks?.[block.id]?.quality);
    if (q === null) continue;
    const qc = clamp(q, 1, 10);
    if (qc === null) continue;
    wSum += block.weight;
    vSum += (qc / 10) * block.weight;
  }

  if (wSum === 0) return 0;
  return (vSum / wSum) * 100;
}

function lastNDaysKeys(baseDate, n) {
  const keys = [];
  const d = new Date(baseDate);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    keys.push(isoDate(x));
  }
  return keys;
}

// Dashboard skills summary: hours/minutes aggregation (7 days)
function computeSkillsSummary(data, keys) {
  // We'll interpret:
  // - Study: quality only (no duration field) => show average quality + filled days
  // - Languages: minutes (lang1 + lang2)
  // - Creating: hours
  // - Investing: uses investing "understanding" + block quality. We'll show filled days and avg understanding.

  const out = {
    study: { filled: 0, avgQ: null },
    languages: { minutes: 0, avgQ: null },
    creating: { hours: 0, avgQ: null },
    investing: { filled: 0, avgUnderstanding: null }
  };

  const acc = {
    studyQ: [],
    langQ: [],
    createQ: [],
    invU: []
  };

  for (const k of keys) {
    const day = data.days[k];
    if (!day) continue;

    const sQ = asNumber(day.blocks?.study?.quality);
    if (sQ !== null) acc.studyQ.push(clamp(sQ, 1, 10));

    const l1m = asNumber(day.blocks?.lang1?.minutes) || 0;
    const l2m = asNumber(day.blocks?.lang2?.minutes) || 0;
    out.languages.minutes += l1m + l2m;

    const l1q = asNumber(day.blocks?.lang1?.quality);
    const l2q = asNumber(day.blocks?.lang2?.quality);
    if (l1q !== null) acc.langQ.push(clamp(l1q, 1, 10));
    if (l2q !== null) acc.langQ.push(clamp(l2q, 1, 10));

    const ch = asNumber(day.blocks?.create?.hours) || 0;
    out.creating.hours += ch;
    const cq = asNumber(day.blocks?.create?.quality);
    if (cq !== null) acc.createQ.push(clamp(cq, 1, 10));

    const invU = asNumber(day.investing?.understanding);
    if (invU !== null) acc.invU.push(clamp(invU, 1, 10));
  }

  out.study.filled = acc.studyQ.length;
  out.study.avgQ = avg(acc.studyQ);

  out.languages.avgQ = avg(acc.langQ);

  out.creating.avgQ = avg(acc.createQ);

  out.investing.filled = acc.invU.length;
  out.investing.avgUnderstanding = avg(acc.invU);

  return out;
}

function avg(arr) {
  const clean = arr.filter((x) => x !== null && x !== undefined && Number.isFinite(x));
  if (!clean.length) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

// ---- UI Rendering ----
let state = {
  data: loadAll(),
  dayKey: isoDate(new Date())
};

function setSaveStatus(text) {
  $("#saveStatus").textContent = text;
  if (text) setTimeout(() => ($("#saveStatus").textContent = ""), 1200);
}

function renderDayLabel() {
  const d = fromIsoDate(state.dayKey);
  const fmt = new Intl.DateTimeFormat("pl-PL", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  $("#todayLabel").textContent = fmt.format(d);
}

function buildBlock(block, day) {
  const root = document.createElement("div");
  root.className = "block";
  root.dataset.blockId = block.id;

  const head = document.createElement("div");
  head.className = "block-head";

  const left = document.createElement("div");
  left.innerHTML = `<div class="block-title">${block.title}</div><div class="block-time">${block.time}</div>`;

  const right = document.createElement("div");
  right.className = "muted";
  right.textContent = `Waga: ${block.weight}×`;

  head.appendChild(left);
  head.appendChild(right);

  const desc = document.createElement("div");
  desc.className = "block-desc";
  desc.textContent = block.desc;

  root.appendChild(head);
  root.appendChild(desc);

  for (const f of block.fields) {
    const field = document.createElement("div");
    field.className = "field";

    const label = document.createElement("label");
    label.innerHTML = `${f.label}<span class="tip" data-tip="${escapeHtml(f.tip)}">?</span>`;
    field.appendChild(label);

    const v = day.blocks?.[block.id]?.[f.key];

    if (f.type === "score10" || f.type === "number") {
      const input = document.createElement("input");
      input.type = "number";
      input.inputMode = "numeric";
      input.min = "0";
      input.step = "1";
      input.value = v ?? "";
      if (f.type === "score10") {
        input.min = "1";
        input.max = "10";
      }
      input.addEventListener("input", () => {
        ensureDay();
        const n = asNumber(input.value);
        state.data.days[state.dayKey].blocks[block.id][f.key] =
          f.type === "score10" ? clamp(n, 1, 10) : n;
        liveRecalc();
      });
      field.appendChild(input);
    }

    if (f.type === "text") {
      const ta = document.createElement("textarea");
      ta.rows = 2;
      ta.value = v ?? "";
      ta.addEventListener("input", () => {
        ensureDay();
        state.data.days[state.dayKey].blocks[block.id][f.key] = ta.value;
      });
      field.appendChild(ta);
    }

    root.appendChild(field);
  }

  return root;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ensureDay() {
  getDay(state.data, state.dayKey);
}

function renderSections() {
  ensureDay();
  const day = state.data.days[state.dayKey];

  const root = $("#sectionsRoot");
  root.innerHTML = "";

  for (const block of DAY_BLOCKS) {
    root.appendChild(buildBlock(block, day));
  }
}

function renderMentalAndThoughts() {
  ensureDay();
  const day = state.data.days[state.dayKey];

  $("#mentalEnergy").value = day.mental?.energy ?? "";
  $("#mentalDiscipline").value = day.mental?.discipline ?? "";
  $("#mentalCoherence").value = day.mental?.coherence ?? "";
  $("#dailyThoughts").value = day.thoughts ?? "";

  $("#mentalEnergy").oninput = (e) => {
    ensureDay();
    state.data.days[state.dayKey].mental.energy = clamp(asNumber(e.target.value), 1, 10);
  };
  $("#mentalDiscipline").oninput = (e) => {
    ensureDay();
    state.data.days[state.dayKey].mental.discipline = clamp(asNumber(e.target.value), 1, 10);
  };
  $("#mentalCoherence").oninput = (e) => {
    ensureDay();
    state.data.days[state.dayKey].mental.coherence = clamp(asNumber(e.target.value), 1, 10);
  };
  $("#dailyThoughts").oninput = (e) => {
    ensureDay();
    state.data.days[state.dayKey].thoughts = e.target.value;
  };
}

function renderInvestingBox() {
  ensureDay();
  const day = state.data.days[state.dayKey];

  $("#invLevel").value = day.investing?.level ?? "1";
  $("#invLearned").value = day.investing?.learned ?? "";
  $("#invUnderstanding").value = day.investing?.understanding ?? "";
  $("#invNotes").value = day.investing?.notes ?? "";

  $("#invLevel").onchange = (e) => {
    ensureDay();
    state.data.days[state.dayKey].investing.level = e.target.value;
  };
  $("#invLearned").oninput = (e) => {
    ensureDay();
    state.data.days[state.dayKey].investing.learned = e.target.value;
  };
  $("#invUnderstanding").oninput = (e) => {
    ensureDay();
    state.data.days[state.dayKey].investing.understanding = clamp(asNumber(e.target.value), 1, 10);
  };
  $("#invNotes").oninput = (e) => {
    ensureDay();
    state.data.days[state.dayKey].investing.notes = e.target.value;
  };
}

function liveRecalc() {
  ensureDay();
  const day = state.data.days[state.dayKey];
  const score = computeDailyScore(day);
  $("#dailyScore").textContent = percent(score);
  renderDashboard(); // cheap enough for this UI
}

function renderChart7(scores, keys) {
  const root = $("#chart7");
  root.innerHTML = "";

  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = scores[i];
    const bar = document.createElement("div");
    bar.className = "bar";
    const h = Math.max(6, Math.round((v / 100) * 110));
    bar.style.height = `${h}px`;

    const d = fromIsoDate(k);
    const label = new Intl.DateTimeFormat("pl-PL", { weekday: "short" }).format(d);
    const t = document.createElement("span");
    t.textContent = `${label} ${Math.round(v)}%`;

    bar.appendChild(t);
    root.appendChild(bar);
  }
}

function renderSkillsSummary(summary) {
  const root = $("#skillsSummary");
  root.innerHTML = "";

  const items = [
    {
      name: "Nauka",
      value: summary.study.avgQ === null ? "—" : `${summary.study.avgQ.toFixed(1)}/10`,
      sub: summary.study.filled ? `Wpisów jakości: ${summary.study.filled}` : "Brak wpisów"
    },
    {
      name: "Języki",
      value: `${Math.round(summary.languages.minutes)} min`,
      sub: summary.languages.avgQ === null ? "Brak jakości" : `Śr. jakość: ${summary.languages.avgQ.toFixed(1)}/10`
    },
    {
      name: "Tworzenie",
      value: `${summary.creating.hours.toFixed(1)} h`,
      sub: summary.creating.avgQ === null ? "Brak jakości" : `Śr. jakość: ${summary.creating.avgQ.toFixed(1)}/10`
    },
    {
      name: "Inwestowanie",
      value: summary.investing.avgUnderstanding === null ? "—" : `${summary.investing.avgUnderstanding.toFixed(1)}/10`,
      sub: summary.investing.filled ? `Wpisów zrozumienia: ${summary.investing.filled}` : "Brak wpisów"
    }
  ];

  for (const it of items) {
    const el = document.createElement("div");
    el.className = "skill";
    el.innerHTML = `
      <div class="k">${it.name}</div>
      <div class="v">${it.value}</div>
      <div class="s">${it.sub}</div>
    `;
    root.appendChild(el);
  }
}

function renderDashboard() {
  const base = fromIsoDate(state.dayKey);
  const keys = lastNDaysKeys(base, 7);

  const scores = keys.map((k) => {
    const day = state.data.days[k];
    return day ? computeDailyScore(day) : 0;
  });

  const a = avg(scores);
  $("#weeklyAvg").textContent = percent(a ?? 0);

  renderChart7(scores, keys);

  const summary = computeSkillsSummary(state.data, keys);
  renderSkillsSummary(summary);

  // Offline indicator
  const dot = $("#offlineDot");
  const label = $("#offlineLabel");
  if (navigator.onLine) {
    dot.className = "dot ok";
    label.textContent = "Online. Dane zapisują się lokalnie.";
  } else {
    dot.className = "dot bad";
    label.textContent = "Offline. DOMINION działa lokalnie (PWA).";
  }
}

// ---- Navigation ----
function shiftDay(delta) {
  const d = fromIsoDate(state.dayKey);
  d.setDate(d.getDate() + delta);
  state.dayKey = isoDate(d);
  renderAll();
}

function renderAll() {
  renderDayLabel();
  renderSections();
  renderMentalAndThoughts();
  renderInvestingBox();
  liveRecalc();
}

// ---- Export / Import ----
function download(filename, text) {
  const el = document.createElement("a");
  el.setAttribute("href", "data:application/json;charset=utf-8," + encodeURIComponent(text));
  el.setAttribute("download", filename);
  el.style.display = "none";
  document.body.appendChild(el);
  el.click();
  el.remove();
}

function exportJSON() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state.data
  };
  download(`DOMINION-backup-${state.dayKey}.json`, JSON.stringify(payload, null, 2));
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      const incoming = parsed.data?.days ? parsed.data : parsed;
      if (!incoming.days) throw new Error("Brak struktury 'days'.");
      state.data = { days: incoming.days };
      saveAll(state.data);
      renderAll();
      setSaveStatus("Zaimportowano.");
    } catch (e) {
      alert("Nie udało się zaimportować pliku JSON. Upewnij się, że to backup z DOMINION.\n\n" + e.message);
    }
  };
  reader.readAsText(file);
}

// ---- Events ----
function attachActions() {
  $("#btnPrevDay").onclick = () => shiftDay(-1);
  $("#btnNextDay").onclick = () => shiftDay(1);
  $("#btnToday").onclick = () => {
    state.dayKey = isoDate(new Date());
    renderAll();
  };

  $("#btnSave").onclick = () => {
    ensureDay();
    saveAll(state.data);
    setSaveStatus("Zapisano.");
  };

  $("#btnExport").onclick = exportJSON;

  $("#fileImport").onchange = (e) => {
    const f = e.target.files?.[0];
    if (f) importJSON(f);
    e.target.value = "";
  };

  $("#btnReset").onclick = () => {
    const ok = confirm("Na pewno chcesz usunąć WSZYSTKIE dane DOMINION z tej przeglądarki?");
    if (!ok) return;
    localStorage.removeItem(LS_KEY);
    state.data = { days: {} };
    renderAll();
    setSaveStatus("Zresetowano.");
  };

  window.addEventListener("online", renderDashboard);
  window.addEventListener("offline", renderDashboard);
}

// ---- PWA registration ----
async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch {
    // no-op
  }
}

// ---- Init ----
(function init() {
  renderAll();
  attachActions();
  registerSW();
})();
