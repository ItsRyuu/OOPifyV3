// ============================================================
// OOPify V3 — Activity Logger
// Pure logging module. Does NOT touch any existing logic.
// ============================================================
import { QUESTION_BANK } from "./questionBank.js";

// ── Firebase Config ───────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCrAjifdMYxe2Nc-2qhgTMAvksefupfOac",
  authDomain: "thesis-log-tracker.firebaseapp.com",
  databaseURL:
    "https://thesis-log-tracker-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "thesis-log-tracker",
  storageBucket: "thesis-log-tracker.firebasestorage.app",
  messagingSenderId: "122130420201",
  appId: "1:122130420201:web:72bbcb401aa440d8e4fb78",
};
const FIREBASE_ENABLED = true;

// ============================================================
// ── EASY TO EDIT: User Profile Form Fields ────────────────────
// Tambah, hapus, atau ubah urutan field di sini sesuai arahan
// dosen pembimbing. Tipe yang tersedia: "text" | "select"
// ============================================================
const PROFILE_FORM_FIELDS = [
  {
    id: "name",
    label: "Nama Lengkap",
    type: "text",
    required: true,
    placeholder: "Masukkan nama lengkap...",
  },
  {
    id: "background",
    label: "Latar Belakang",
    type: "select",
    required: true,
    options: ["Siswa SMA/SMK", "Mahasiswa", "Profesional", "Umum"],
  },
  {
    id: "institution",
    label: "Institusi / Asal",
    type: "text",
    required: false,
    placeholder: "Nama sekolah / universitas / perusahaan...",
  },
  {
    id: "oopExperience",
    label: "Pengalaman OOP",
    type: "select",
    required: true,
    options: ["< 1 bulan", "1–6 bulan", "6–12 bulan", "> 1 tahun"],
  },
];

// ── Logger State ──────────────────────────────────────────────
let _entries = [];
let _sessionId = null;
let _startTime = null;
let _nextId = 1;
let _userProfile = null;
let _examSession = null; // { question, startTime, timerInterval }
let _examWorkspaceId = null; // ID workspace yang dibuat saat mulai soal

// ── Session Management ────────────────────────────────────────
function generateSessionId() {
  return "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

function startSession() {
  _sessionId = generateSessionId();
  _startTime = Date.now();
  _entries = [];
  _nextId = 1;
}

// ── Core Log Function ─────────────────────────────────────────
function logEvent(event, context) {
  if (!_sessionId) startSession();

  // Jika exam aktif, HANYA catat event dari workspace exam tersebut
  if (_examSession && _examWorkspaceId !== null) {
    const currentWsId = parseInt(localStorage.getItem("oopify_active_tab"));
    if (currentWsId !== _examWorkspaceId) return null;
  }

  const entry = {
    id: _nextId++,
    sessionId: _sessionId,
    timestamp: new Date().toISOString(),
    elapsedMs: Date.now() - _startTime,
    event,
    ...(_examSession ? { questionId: _examSession.question.id, questionTitle: _examSession.question.title } : {}),
    ...context,
  };

  // Sanitasi: buang nilai undefined agar Firebase tidak menolak payload
  // JSON.stringify secara native membuang undefined, lalu parse kembali ke object bersih
  const cleanEntry = JSON.parse(JSON.stringify(entry));

  _entries.push(cleanEntry);
  _refreshPanel();
  return cleanEntry;
}

// ── Getters ───────────────────────────────────────────────────
function getEntries() {
  return _entries;
}

function getStats() {
  const counts = {};
  _entries.forEach((e) => {
    counts[e.event] = (counts[e.event] || 0) + 1;
  });
  return {
    total: _entries.length,
    sessionId: _sessionId,
    durationMs: _startTime ? Date.now() - _startTime : 0,
    counts,
  };
}

// ── Export ────────────────────────────────────────────────────
function exportJSON() {
  return JSON.stringify(
    {
      sessionId: _sessionId,
      exportedAt: new Date().toISOString(),
      userProfile: _userProfile,
      examSession: _examSession
        ? {
            questionId: _examSession.question.id,
            questionTitle: _examSession.question.title,
            startTime: new Date(_examSession.startTime).toISOString(),
            durationMs: Date.now() - _examSession.startTime,
          }
        : null,
      stats: getStats(),
      events: _entries,
    },
    null,
    2
  );
}

function downloadJSON() {
  const json = exportJSON();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `oopify-log-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function clearLog() {
  _entries = [];
  _nextId = 1;
  _startTime = Date.now();
  _refreshPanel();
}

// ── Firebase Upload ───────────────────────────────────────────
async function sendToFirebase(silent = false) {
  if (!FIREBASE_ENABLED) {
    if (!silent) alert("Firebase belum dikonfigurasi.");
    return "Firebase not enabled";
  }
  try {
    const { initializeApp, getApps } = await import(
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
    );
    const { getDatabase, ref, set } = await import(
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js"
    );

    const existingApp = getApps().find((a) => a.name === "oopify-logger");
    const app = existingApp || initializeApp(FIREBASE_CONFIG, "oopify-logger");
    const db = getDatabase(app);

    // Bersihkan payload dari undefined sebelum dikirim ke Firebase
    const rawPayload = {
      sessionId: _sessionId,
      savedAt: new Date().toISOString(),
      userProfile: _userProfile || null,
      examSession: _examSession
        ? {
            questionId: _examSession.question.id,
            questionTitle: _examSession.question.title,
            startTime: new Date(_examSession.startTime).toISOString(),
            durationMs: Date.now() - _examSession.startTime,
          }
        : null,
      stats: getStats(),
      events: _entries, // sudah bersih dari logEvent sanitasi
    };
    const payload = JSON.parse(JSON.stringify(rawPayload));

    await set(ref(db, "sessions/" + _sessionId), payload);
    if (!silent)
      alert("✅ Log berhasil dikirim ke Firebase!\nSession ID: " + _sessionId);
    return true;
  } catch (err) {
    if (!silent) alert("❌ Gagal kirim ke Firebase: " + err.message);
    console.error(err);
    return false;
  }
}

// ── Exam Mode ─────────────────────────────────────────────────
function startExamSession(question) {
  // question = object dari QUESTION_BANK
  startSession();
  _examSession = {
    question,
    startTime: Date.now(),
    timerInterval: null,
  };

  // Buka workspace baru → trigger tombol "+" yang sudah ada
  const btnAddTab = document.getElementById("btn-add-tab");
  if (btnAddTab) {
    btnAddTab.click();
    // ID workspace baru tersimpan ke localStorage secara synchronous oleh switchTab()
    _examWorkspaceId = parseInt(localStorage.getItem("oopify_active_tab"));

    // Rename tab sesuai judul soal (80ms agar DOM selesai render)
    setTimeout(() => {
      const activeTab = document.querySelector(".tab.active");
      if (activeTab) {
        const nameSpan = activeTab.querySelector("span");
        if (nameSpan) {
          nameSpan.textContent = question.title;
          nameSpan.dispatchEvent(new Event("blur"));
        }
      }
    }, 80);
  }

  // Tampilkan floating question card
  _showQuestionCard(question);

  // Start timer
  _examSession.timerInterval = setInterval(_updateExamPill, 1000);
  _updateExamPill();
  _refreshPanel();

  logEvent("EXAM_START", { questionId: question.id, questionTitle: question.title });
}

async function endExamSession() {
  if (!_examSession) return;

  logEvent("EXAM_END", {
    questionId: _examSession.question.id,
    durationMs: Date.now() - _examSession.startTime,
  });

  clearInterval(_examSession.timerInterval);
  _examWorkspaceId = null;
  _removeQuestionCard();

  const pill = document.getElementById("ooplog-exam-pill");
  if (pill) pill.innerHTML = `<span style="color:#fbbf24">⏳ Mengirim ke Firebase...</span>`;

  const result = await sendToFirebase(true);
  _examSession = null;
  _updateExamPill();

  if (result === true) {
    alert("✅ Sesi selesai! Data berhasil dikirim ke Firebase.");
  } else {
    // Tampilkan error asli agar mudah debug
    alert("⚠ Gagal kirim ke Firebase.\nError: " + result + "\n\nSilakan gunakan tombol ⬇ JSON untuk backup data.");
  }
}

// ── Question Card (floating, minimizable) ─────────────────────
function _showQuestionCard(question) {
  _removeQuestionCard();
  const card = document.createElement("div");
  card.id = "oopq-card";
  card.innerHTML = `
    <div id="oopq-header">
      <div id="oopq-title">
        <span id="oopq-badge" style="background:${question.difficultyColor}22;color:${question.difficultyColor};border:1px solid ${question.difficultyColor}44">${question.difficulty}</span>
        <span id="oopq-name">${question.title}</span>
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <span style="color:#64748b;font-size:10px">⏱ ${question.estimatedTime}</span>
        <button id="oopq-toggle" title="Sembunyikan soal">−</button>
      </div>
    </div>
    <div id="oopq-body">
      <div id="oopq-desc">${question.description}</div>
      ${question.hints && question.hints.length ? `
      <details id="oopq-hints">
        <summary>💡 Petunjuk</summary>
        <ul>${question.hints.map(h => `<li>${h}</li>`).join("")}</ul>
      </details>` : ""}
    </div>
  `;
  document.body.appendChild(card);

  // ── Minimize toggle ───────────────────────────────────────────
  let minimized = false;
  document.getElementById("oopq-toggle").addEventListener("click", () => {
    minimized = !minimized;
    document.getElementById("oopq-body").style.display = minimized ? "none" : "block";
    document.getElementById("oopq-toggle").textContent = minimized ? "+" : "−";
  });

  // ── Drag to move ─────────────────────────────────────────────
  const header = document.getElementById("oopq-header");
  header.style.cursor = "grab";

  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  header.addEventListener("mousedown", (e) => {
    // Jangan mulai drag jika klik tombol minus/plus
    if (e.target.id === "oopq-toggle") return;
    isDragging = true;
    const rect = card.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    header.style.cursor = "grabbing";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    // Hitung posisi baru, batasi agar tidak keluar viewport
    const x = Math.min(Math.max(0, e.clientX - dragOffsetX), window.innerWidth - card.offsetWidth);
    const y = Math.min(Math.max(0, e.clientY - dragOffsetY), window.innerHeight - card.offsetHeight);
    card.style.left = x + "px";
    card.style.top  = y + "px";
    // Hapus posisi awal CSS agar left/top absolute efektif
    card.style.right = "unset";
    card.style.bottom = "unset";
  }, { passive: true });

  document.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    header.style.cursor = "grab";
  });
}


function _removeQuestionCard() {
  document.getElementById("oopq-card")?.remove();
}

function _formatTimer(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── Question Selection Modal ───────────────────────────────────
function _showQuestionSelectModal() {
  document.getElementById("oopq-select-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "oopq-select-overlay";

  const cards = QUESTION_BANK.map(q => `
    <div class="oopq-sel-card" data-qid="${q.id}">
      <div class="oopq-sel-top">
        <span class="oopq-sel-badge" style="background:${q.difficultyColor}22;color:${q.difficultyColor};border:1px solid ${q.difficultyColor}44">${q.difficulty}</span>
        <span class="oopq-sel-time">⏱ ${q.estimatedTime}</span>
      </div>
      <div class="oopq-sel-title">${q.title}</div>
      <button class="oopq-sel-btn" data-qid="${q.id}" style="border-left:3px solid ${q.difficultyColor}">Pilih Soal Ini →</button>
    </div>
  `).join("");

  overlay.innerHTML = `
    <div id="oopq-sel-box">
      <div id="oopq-sel-header">
        <span id="oopq-sel-title">📝 Pilih Soal</span>
        <button id="oopq-sel-close">✕</button>
      </div>
      <div id="oopq-sel-list">${cards}</div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("oopq-sel-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelectorAll(".oopq-sel-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const q = QUESTION_BANK.find(x => x.id === btn.dataset.qid);
      if (q) { overlay.remove(); startExamSession(q); }
    });
  });
}

function _updateExamPill() {
  const pill = document.getElementById("ooplog-exam-pill");
  if (!pill) return;

  if (_examSession) {
    const elapsed = Date.now() - _examSession.startTime;
    pill.innerHTML = `
      <span style="color:#4ade80;font-weight:700">● LIVE</span>
      <span style="color:#e2e8f0;margin:0 8px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_examSession.question.title}</span>
      <span style="color:#fbbf24;font-variant-numeric:tabular-nums;margin-right:4px">${_formatTimer(elapsed)}</span>
      <button id="ooplog-btn-end" style="background:#ef4444;border:none;color:#fff;padding:2px 10px;border-radius:5px;cursor:pointer;font-size:10px;font-weight:700">Selesai &amp; Kirim</button>
    `;
    document.getElementById("ooplog-btn-end")?.addEventListener("click", () => {
      if (confirm(`Selesaikan sesi dan kirim ke Firebase?`)) endExamSession();
    });
  } else {
    pill.innerHTML = `
      <span style="color:#64748b">● Tidak ada sesi aktif</span>
      <button id="ooplog-btn-start" style="margin-left:8px;background:#3b82f6;border:none;color:#fff;padding:2px 10px;border-radius:5px;cursor:pointer;font-size:10px;font-weight:700">▶ Mulai Soal</button>
    `;
    document.getElementById("ooplog-btn-start")?.addEventListener("click", _showQuestionSelectModal);
  }
}


// ── Panel UI ──────────────────────────────────────────────────
const EVENT_COLORS = {
  BLOCK_SPAWNED: "#4ade80",
  BLOCK_DROPPED: "#60a5fa",
  BLOCK_DETACHED: "#f59e0b",
  BLOCK_DELETED: "#f87171",
  BLOCK_EDITED: "#c084fc",
  MODIFIER_CHANGED: "#e879f9",
  UNDO: "#94a3b8",
  REDO: "#94a3b8",
  CODE_GENERATED: "#34d399",
  CODE_RUN: "#22d3ee",
  EXAM_START: "#fbbf24",
  EXAM_END: "#fb923c",
};

function _formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function _formatEntry(e) {
  const color = EVENT_COLORS[e.event] || "#e2e8f0";
  const elapsed = _formatElapsed(e.elapsedMs);

  let detail = "";
  if (e.blockType) detail += e.blockType;
  if (e.field) detail += ` .${e.field}`;
  if (e.newValue !== undefined) detail += ` → "${e.newValue}"`;
  if (e.targetContainer) detail += ` ↓ ${e.targetContainer}`;
  if (e.fromContainer) detail += ` ↑ ${e.fromContainer}`;
  if (e.questionLabel) detail += ` [${e.questionLabel}]`;
  if (e.hasError) detail += " ⚠ error";
  if (e.success === true) detail += " ✓";

  return `
    <div class="ooplog-entry" style="border-left: 3px solid ${color}">
      <span class="ooplog-time">${elapsed}</span>
      <span class="ooplog-event" style="color:${color}">${e.event}</span>
      <span class="ooplog-detail">${detail}</span>
    </div>
  `;
}

function _refreshPanel() {
  const list = document.getElementById("ooplog-list");
  const badge = document.getElementById("ooplog-badge");
  if (!list) return;

  badge.textContent = _entries.length;
  const visible = _entries.slice(-100).reverse();
  list.innerHTML = visible.map(_formatEntry).join("");
}

function _injectPanel() {
  const panel = document.createElement("div");
  panel.id = "ooplog-panel";
  panel.innerHTML = `
    <div id="ooplog-header">
      <span id="ooplog-title">📋 Activity Log <span id="ooplog-badge" style="background:#334155;border-radius:999px;padding:1px 7px;font-size:11px">0</span></span>
      <div id="ooplog-actions">
        <button id="ooplog-btn-profile" title="Ubah Profil">👤</button>
        <button id="ooplog-btn-firebase" title="Kirim ke Firebase">☁ Firebase</button>
        <button id="ooplog-btn-export" title="Export JSON">⬇ JSON</button>
        <button id="ooplog-btn-clear" title="Hapus log">🗑 Clear</button>
        <button id="ooplog-btn-toggle" title="Tutup panel">✕</button>
      </div>
    </div>
    <div id="ooplog-list"></div>
  `;
  document.body.appendChild(panel);

  // Exam mode pill (always visible at top of workspace)
  const pill = document.createElement("div");
  pill.id = "ooplog-exam-pill";
  document.body.appendChild(pill);

  // FAB
  const fab = document.createElement("button");
  fab.id = "ooplog-fab";
  fab.title = "Lihat Activity Log";
  fab.textContent = "📋";
  document.body.appendChild(fab);

  // Wire buttons
  document.getElementById("ooplog-btn-toggle").addEventListener("click", () =>
    panel.classList.add("ooplog-hidden")
  );
  fab.addEventListener("click", () => {
    panel.classList.toggle("ooplog-hidden");
    _refreshPanel();
  });
  document.getElementById("ooplog-btn-export").addEventListener("click", downloadJSON);
  document.getElementById("ooplog-btn-clear").addEventListener("click", clearLog);
  document.getElementById("ooplog-btn-firebase").addEventListener("click", () => sendToFirebase(false));
  document.getElementById("ooplog-btn-profile").addEventListener("click", () =>
    _showIdentityModal(true)
  );

  // Profile bubble (floating, selalu terlihat)
  const profileChip = document.createElement("div");
  profileChip.id = "ooplog-profile-chip";
  document.body.appendChild(profileChip);

  _updateExamPill();
}

// ── Identity Modal ────────────────────────────────────────────
function _buildModalHTML() {
  const fields = PROFILE_FORM_FIELDS.map((f) => {
    if (f.type === "select") {
      const opts = f.options
        .map((o) => `<option value="${o}">${o}</option>`)
        .join("");
      return `
        <div class="oopmod-field">
          <label class="oopmod-label">${f.label}${f.required ? ' <span style="color:#f87171">*</span>' : ""}</label>
          <select id="oopmod-${f.id}" class="oopmod-input">
            <option value="">-- Pilih --</option>
            ${opts}
          </select>
        </div>`;
    }
    return `
      <div class="oopmod-field">
        <label class="oopmod-label">${f.label}${f.required ? ' <span style="color:#f87171">*</span>' : ""}</label>
        <input id="oopmod-${f.id}" class="oopmod-input" type="text"
          placeholder="${f.placeholder || ""}" autocomplete="off" />
      </div>`;
  }).join("");

  return `
    <div id="oopmod-overlay">
      <div id="oopmod-box">
        <div id="oopmod-header">
          <span id="oopmod-icon">👤</span>
          <div>
            <div id="oopmod-title">Identitas Peserta</div>
            <div id="oopmod-subtitle">Data ini disimpan bersama log aktivitas untuk keperluan riset.</div>
          </div>
        </div>
        <div id="oopmod-fields">${fields}</div>
        <div id="oopmod-error"></div>
        <button id="oopmod-submit">Mulai Mengerjakan →</button>
      </div>
    </div>`;
}

function _showIdentityModal(allowClose = false) {
  // Remove old if exists
  document.getElementById("oopmod-overlay")?.remove();

  const wrapper = document.createElement("div");
  wrapper.innerHTML = _buildModalHTML();
  document.body.appendChild(wrapper.firstElementChild);

  // Pre-fill if profile exists
  if (_userProfile) {
    PROFILE_FORM_FIELDS.forEach((f) => {
      const el = document.getElementById(`oopmod-${f.id}`);
      if (el && _userProfile[f.id] !== undefined) el.value = _userProfile[f.id];
    });
  }

  // Close on overlay click only if allowClose
  const overlay = document.getElementById("oopmod-overlay");
  if (allowClose) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  document.getElementById("oopmod-submit").addEventListener("click", () => {
    const profile = {};
    let valid = true;
    const errEl = document.getElementById("oopmod-error");

    PROFILE_FORM_FIELDS.forEach((f) => {
      const el = document.getElementById(`oopmod-${f.id}`);
      const val = el ? el.value.trim() : "";
      if (f.required && !val) {
        valid = false;
        el?.classList.add("oopmod-invalid");
      } else {
        el?.classList.remove("oopmod-invalid");
        profile[f.id] = val;
      }
    });

    if (!valid) {
      errEl.textContent = "⚠ Harap isi semua kolom yang bertanda bintang (*).";
      return;
    }

    _userProfile = profile;
    localStorage.setItem("oopify_user_profile", JSON.stringify(profile));
    overlay.remove();
    _refreshProfileChip(); // update bubble profil
    logEvent("SESSION_IDENTIFIED", { userProfile: profile });
  });
}

// ── Styles ────────────────────────────────────────────────────
function _injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    /* ── Log Panel ── */
    #ooplog-panel {
      position: fixed; bottom: 60px; right: 16px;
      width: 400px; max-height: 320px;
      background: #0f172a; border: 1px solid #334155;
      border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      display: flex; flex-direction: column;
      z-index: 9998;
      font-family: 'JetBrains Mono','Fira Code',monospace;
      font-size: 11px; color: #e2e8f0;
    }
    #ooplog-panel.ooplog-hidden { display: none; }
    #ooplog-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; border-bottom: 1px solid #1e293b;
      background: #1e293b; border-radius: 10px 10px 0 0; flex-shrink: 0;
    }
    #ooplog-title { font-weight: 700; font-size: 12px; display: flex; align-items: center; gap: 6px; }
    #ooplog-actions { display: flex; gap: 4px; }
    #ooplog-actions button {
      background: #334155; border: none; color: #94a3b8;
      padding: 3px 8px; border-radius: 5px; cursor: pointer;
      font-size: 10px; transition: background 0.15s;
    }
    #ooplog-actions button:hover { background: #475569; color: #fff; }
    #ooplog-btn-firebase { color: #fbbf24 !important; }
    #ooplog-btn-firebase:hover { background: #78350f !important; color: #fef3c7 !important; }
    #ooplog-list { overflow-y: auto; flex: 1; padding: 4px 0; }
    .ooplog-entry {
      display: flex; align-items: baseline; gap: 6px;
      padding: 3px 10px; transition: background 0.1s;
    }
    .ooplog-entry:hover { background: #1e293b; }
    .ooplog-time { color: #64748b; min-width: 36px; font-size: 10px; }
    .ooplog-event { font-weight: 700; font-size: 10px; min-width: 130px; }
    .ooplog-detail { color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* ── FAB ── */
    #ooplog-fab {
      position: fixed; bottom: 16px; right: 16px;
      width: 40px; height: 40px;
      background: #1e293b; border: 1px solid #334155;
      border-radius: 50%; color: #e2e8f0; font-size: 18px;
      cursor: pointer; z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      transition: background 0.15s, transform 0.15s;
      display: flex; align-items: center; justify-content: center;
    }
    #ooplog-fab:hover { background: #334155; transform: scale(1.1); }

    /* ── Exam Pill ── */
    #ooplog-exam-pill {
      position: fixed; top: 12px; left: 50%;
      transform: translateX(-50%);
      background: #0f172a; border: 1px solid #334155;
      border-radius: 999px; padding: 5px 16px;
      font-family: 'JetBrains Mono','Fira Code',monospace;
      font-size: 11px; color: #e2e8f0;
      display: flex; align-items: center; gap: 4px;
      z-index: 9997; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      white-space: nowrap;
    }

    /* ── Identity Modal ── */
    #oopmod-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.75);
      display: flex; align-items: center; justify-content: center;
      z-index: 99999;
      backdrop-filter: blur(4px);
    }
    #oopmod-box {
      background: #0f172a; border: 1px solid #334155;
      border-radius: 16px; padding: 32px;
      width: 100%; max-width: 420px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
      font-family: 'Inter','Segoe UI',sans-serif;
    }
    #oopmod-header {
      display: flex; align-items: flex-start; gap: 14px; margin-bottom: 24px;
    }
    #oopmod-icon { font-size: 32px; line-height: 1; }
    #oopmod-title { color: #f1f5f9; font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    #oopmod-subtitle { color: #64748b; font-size: 12px; line-height: 1.5; }
    .oopmod-field { margin-bottom: 16px; }
    .oopmod-label { display: block; color: #94a3b8; font-size: 12px; font-weight: 600; margin-bottom: 6px; }
    .oopmod-input {
      width: 100%; box-sizing: border-box;
      background: #1e293b; border: 1px solid #334155;
      border-radius: 8px; color: #f1f5f9;
      padding: 10px 12px; font-size: 13px;
      outline: none; transition: border-color 0.15s;
      font-family: inherit;
    }
    .oopmod-input:focus { border-color: #3b82f6; }
    .oopmod-invalid { border-color: #ef4444 !important; }
    #oopmod-error { color: #f87171; font-size: 11px; margin-bottom: 12px; min-height: 16px; }
    #oopmod-submit {
      width: 100%; padding: 12px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      border: none; border-radius: 10px;
      color: #fff; font-size: 14px; font-weight: 700;
      cursor: pointer; transition: opacity 0.15s;
    }
    #oopmod-submit:hover { opacity: 0.9; }

    /* ── Question Card ── */
    #oopq-card {
      position: fixed; top: 52px; left: 240px;
      width: 320px; max-height: 70vh;
      background: #0f172a; border: 1px solid #334155;
      border-radius: 12px; z-index: 9996;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      font-family: 'Inter','Segoe UI',sans-serif;
      font-size: 12px; color: #e2e8f0;
      overflow: hidden;
    }
    #oopq-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; background: #1e293b;
      border-bottom: 1px solid #334155;
    }
    #oopq-title { display: flex; align-items: center; gap: 8px; font-weight: 700; }
    #oopq-badge {
      font-size: 10px; padding: 2px 8px; border-radius: 999px; font-weight: 700;
    }
    #oopq-name { font-size: 11px; color: #cbd5e1; }
    #oopq-toggle {
      background: #334155; border: none; color: #94a3b8;
      width: 22px; height: 22px; border-radius: 4px; cursor: pointer; font-size: 14px;
      display: flex; align-items: center; justify-content: center;
    }
    #oopq-body { padding: 14px; overflow-y: auto; max-height: calc(70vh - 52px); }
    #oopq-desc { line-height: 1.7; color: #cbd5e1; }
    #oopq-desc code { background: #1e293b; padding: 1px 5px; border-radius: 4px; font-family: monospace; color: #7dd3fc; }
    #oopq-desc strong { color: #f1f5f9; }
    #oopq-desc em { color: #a5b4fc; font-style: normal; }
    #oopq-desc b { color: #e2e8f0; display: block; margin-top: 10px; }
    #oopq-hints { margin-top: 12px; }
    #oopq-hints summary { cursor: pointer; color: #fbbf24; font-weight: 600; font-size: 11px; }
    #oopq-hints ul { margin: 8px 0 0 16px; padding: 0; color: #94a3b8; line-height: 1.8; }

    /* ── Question Selection Modal ── */
    #oopq-select-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.7);
      display: flex; align-items: center; justify-content: center;
      z-index: 99998; backdrop-filter: blur(4px);
    }
    #oopq-sel-box {
      background: #0f172a; border: 1px solid #334155;
      border-radius: 16px; padding: 28px;
      width: 100%; max-width: 520px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
      font-family: 'Inter','Segoe UI',sans-serif;
    }
    #oopq-sel-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 20px;
    }
    #oopq-sel-title { color: #f1f5f9; font-size: 16px; font-weight: 700; }
    #oopq-sel-close {
      background: #334155; border: none; color: #94a3b8;
      width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 14px;
    }
    #oopq-sel-list { display: flex; flex-direction: column; gap: 10px; }
    .oopq-sel-card {
      background: #1e293b; border: 1px solid #334155;
      border-radius: 10px; padding: 14px 16px;
      transition: border-color 0.15s, background 0.15s;
    }
    .oopq-sel-card:hover { background: #263349; border-color: #475569; }
    .oopq-sel-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .oopq-sel-badge { font-size: 10px; padding: 2px 8px; border-radius: 999px; font-weight: 700; }
    .oopq-sel-time { color: #64748b; font-size: 11px; }
    .oopq-sel-title { color: #e2e8f0; font-size: 13px; font-weight: 600; margin-bottom: 10px; }
    .oopq-sel-btn {
      width: 100%; padding: 8px;
      background: #0f172a; border: none; border-radius: 7px;
      color: #94a3b8; font-size: 12px; font-weight: 600;
      cursor: pointer; text-align: left; padding-left: 12px;
      transition: background 0.15s, color 0.15s;
    }
    .oopq-sel-btn:hover { background: #1e3a5f; color: #e2e8f0; }

    /* ── Profile Bubble ── */
    #ooplog-profile-chip {
      position: fixed; bottom: 68px; right: 16px;
      z-index: 9999;
      font-family: 'Inter','Segoe UI',sans-serif;
    }
    #ooplog-profile-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      border: 2px solid #334155;
      color: #fff; font-size: 14px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      transition: transform 0.15s;
      user-select: none;
    }
    #ooplog-profile-avatar:hover { transform: scale(1.1); }
    #ooplog-profile-popover {
      position: absolute; bottom: 44px; right: 0;
      background: #1e293b; border: 1px solid #334155;
      border-radius: 10px; padding: 14px;
      min-width: 200px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      font-size: 12px;
    }
    #ooplog-profile-popover.hidden { display: none; }
    #ooplog-pop-name { color: #f1f5f9; font-weight: 700; font-size: 13px; margin-bottom: 4px; }
    #ooplog-pop-sub { color: #64748b; font-size: 11px; margin-bottom: 10px; line-height: 1.5; }
    #ooplog-pop-edit {
      width: 100%; padding: 6px;
      background: #334155; border: none; border-radius: 6px;
      color: #94a3b8; font-size: 11px; cursor: pointer;
    }
    #ooplog-pop-edit:hover { background: #475569; color: #fff; }
  `;
  document.head.appendChild(style);
}

// ── Profile Bubble ────────────────────────────────────────────
function _refreshProfileChip() {
  const chip = document.getElementById("ooplog-profile-chip");
  if (!chip) return;

  if (_userProfile && _userProfile.name) {
    const initial = _userProfile.name.trim().charAt(0).toUpperCase();
    chip.innerHTML = `
      <div id="ooplog-profile-popover" class="hidden">
        <div id="ooplog-pop-name">${_userProfile.name}</div>
        <div id="ooplog-pop-sub">
          ${_userProfile.background || ""}${_userProfile.institution ? " · " + _userProfile.institution : ""}<br>
          OOP: ${_userProfile.oopExperience || "-"}
        </div>
        <button id="ooplog-pop-edit">✏ Ubah Profil</button>
      </div>
      <div id="ooplog-profile-avatar" title="${_userProfile.name}">${initial}</div>
    `;
    let open = false;
    document.getElementById("ooplog-profile-avatar").addEventListener("click", () => {
      open = !open;
      document.getElementById("ooplog-profile-popover").classList.toggle("hidden", !open);
    });
    document.getElementById("ooplog-pop-edit").addEventListener("click", () => {
      document.getElementById("ooplog-profile-popover").classList.add("hidden");
      open = false;
      _showIdentityModal(true);
    });
  } else {
    chip.innerHTML = `
      <div id="ooplog-profile-avatar" title="Set profil" style="background:#475569">?</div>
    `;
    document.getElementById("ooplog-profile-avatar").addEventListener("click", () =>
      _showIdentityModal(true)
    );
  }
}

// ── Init ──────────────────────────────────────────────────────
function init() {
  startSession();
  _injectStyles();
  _injectPanel();
  document.getElementById("ooplog-panel").classList.add("ooplog-hidden");

  // Load saved profile from localStorage
  const saved = localStorage.getItem("oopify_user_profile");
  if (saved) {
    try {
      _userProfile = JSON.parse(saved);
    } catch (_) {
      _userProfile = null;
    }
  }

  // Render profile bubble (nama user jika sudah ada)
  _refreshProfileChip();

  // Show identity modal if no profile yet
  if (!_userProfile) {
    setTimeout(() => _showIdentityModal(false), 400);
  }
}

// ── Public API ────────────────────────────────────────────────
export const activityLogger = {
  init,
  logEvent,
  getEntries,
  getStats,
  exportJSON,
  downloadJSON,
  clearLog,
  sendToFirebase,
  startExamSession,
  endExamSession,
};

window.activityLogger = activityLogger;
