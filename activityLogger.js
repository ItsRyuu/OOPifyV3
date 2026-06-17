// ============================================================
// OOPify v3 — Activity Logger
// Records user actions for thesis research (clustering + scoring)
// Firebase-only transport — no local file collection
// ============================================================

let entries = [];
let nextId = 1;
let sessionStartTime = null;
let sessionId = null;

/** Generate a unique session ID */
function generateSessionId() {
  return "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
}

/** Start a new logging session */
export function startSession() {
  entries = [];
  nextId = 1;
  sessionStartTime = Date.now();
  sessionId = generateSessionId();
  logEvent("SESSION_START");
  return sessionId;
}

/**
 * Log a single event.
 * @param {string} event - Event type (e.g. "BLOCK_SPAWNED", "BLOCK_EDITED")
 * @param {object} [context={}] - Additional context data
 */
export function logEvent(event, context = {}) {
  if (!sessionStartTime) {
    sessionStartTime = Date.now();
    sessionId = generateSessionId();
  }

  const entry = {
    eventId: nextId++,
    timestamp: new Date().toISOString(),
    elapsedMs: Date.now() - sessionStartTime,
    sessionId: sessionId,
    event: event,
    ...context,
  };

  entries.push(entry);

  // Update badge if UI is ready
  if (window._updateLogBadge) window._updateLogBadge();
  // Auto-append to log panel if UI is ready
  if (window._appendLogEntry) window._appendLogEntry(entry);
}

/** Get all logged entries */
export function getEntries() {
  return entries;
}

/** Get entry count */
export function getEntryCount() {
  return entries.length;
}

/** Compute summary statistics */
export function getStats() {
  const stats = {
    totalEvents: entries.length,
    blockSpawned: 0,
    blockDropped: 0,
    blockDetached: 0,
    blockDeleted: 0,
    blockEdited: 0,
    modifierChanged: 0,
    undoCount: 0,
    redoCount: 0,
    codeGenerated: 0,
    codeRun: 0,
    codeErrors: 0,
  };

  entries.forEach((e) => {
    switch (e.event) {
      case "BLOCK_SPAWNED": stats.blockSpawned++; break;
      case "BLOCK_DROPPED": stats.blockDropped++; break;
      case "BLOCK_DETACHED": stats.blockDetached++; break;
      case "BLOCK_DELETED": stats.blockDeleted++; break;
      case "BLOCK_EDITED": stats.blockEdited++; break;
      case "MODIFIER_CHANGED": stats.modifierChanged++; break;
      case "UNDO": stats.undoCount++; break;
      case "REDO": stats.redoCount++; break;
      case "CODE_GENERATED": stats.codeGenerated++; break;
      case "CODE_RUN": stats.codeRun++; break;
    }
    if (e.hasError) stats.codeErrors++;
  });

  return stats;
}

/** Export all entries as JSON string */
export function exportJSON() {
  const data = {
    sessionId: sessionId,
    exportedAt: new Date().toISOString(),
    durationMs: Date.now() - (sessionStartTime || Date.now()),
    stats: getStats(),
    entries: entries,
  };
  return JSON.stringify(data, null, 2);
}

/** Trigger a JSON file download of the log */
export function downloadLog() {
  const json = exportJSON();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ts = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
  a.download = `oopify-log-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Clear all log entries */
export function clearLog() {
  entries = [];
  nextId = 1;
  sessionStartTime = Date.now();
  sessionId = generateSessionId();
  if (window._updateLogBadge) window._updateLogBadge();
}
