export let workspaces = [
  {
    id: 1,
    name: "Workspace 1",
    blocks: [],
    camera: { x: 0, y: 0, zoom: 1 },
    code: "",
    history: ["[]"], // Initialize with empty state
    historyIndex: 0, // Track current position in history
  },
];

export let activeWorkspaceId = 1;

export const dragInfo = {
  isDraggingBlock: false,
  isPanning: false,
  blockId: null,
  parentId: null,
  startX: 0,
  startY: 0,
  isNewSpawn: false,
};

export function getActiveWorkspace() {
  return workspaces.find((w) => w.id === activeWorkspaceId);
}

export function setActiveWorkspaceId(id) {
  activeWorkspaceId = id;
  localStorage.setItem("oopify_active_tab", id);
}

export function setWorkspaces(newWorkspaces) {
  workspaces = newWorkspaces;
}

// Helper to deeply search the block tree
export function findBlockAndParent(blocks, id, parent = null) {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].id === id) return { block: blocks[i], parent: parent };
    if (blocks[i].children) {
      const found = findBlockAndParent(blocks[i].children, id, blocks[i]);
      if (found) return found;
    }
  }
  return null;
}

export function updateBlockData(id, key, value) {
  const ws = getActiveWorkspace();
  const result = findBlockAndParent(ws.blocks, id);
  if (result && result.block) {
    result.block.data[key] = value;
  }
}

// Recursive helper to strip out ghost blocks before saving
function stripGhosts(blockList) {
  return blockList
    .filter((b) => !b.isGhost && b.id !== "ghost-block")
    .map((b) => {
      // Create a shallow copy so we don't mutate the live workspace
      const cleanBlock = { ...b };
      if (cleanBlock.children) {
        cleanBlock.children = stripGhosts(cleanBlock.children);
      }
      return cleanBlock;
    });
}

export function saveState() {
  // Ensures tab deletions are saved even if there is no active workspace yet
  localStorage.setItem("oopify_autosave", JSON.stringify(workspaces));
  localStorage.setItem("oopify_active_tab", activeWorkspaceId);

  const ws = getActiveWorkspace();
  if (!ws) return;

  const cleanBlocks = stripGhosts(ws.blocks);
  const snapshot = JSON.stringify(cleanBlocks);

  // --- UNDO/REDO HISTORY LOGIC ---
  if (ws.historyIndex > 0 && ws.history[ws.historyIndex] === snapshot) {
    // No changes to blocks, do nothing for history
  } else {
    // Truncate future if user undid and made a new change
    if (ws.historyIndex < ws.history.length - 1) {
      ws.history = ws.history.slice(0, ws.historyIndex + 1);
    }

    ws.history.push(snapshot);
    ws.historyIndex++;

    // Limit history to 50
    if (ws.history.length > 50) {
      ws.history.shift();
      ws.historyIndex--;
    }

    if (window.updateUndoRedoUI) window.updateUndoRedoUI();
  }

  // --- PERSISTENT AUTOSAVE ---
  // Save the ENTIRE workspaces array and the active tab ID
  localStorage.setItem("oopify_autosave", JSON.stringify(workspaces));
  localStorage.setItem("oopify_active_tab", activeWorkspaceId);
}
export function loadFromAutoSave() {
  const savedData = localStorage.getItem("oopify_autosave");
  const savedActiveId = localStorage.getItem("oopify_active_tab");

  if (savedData) {
    try {
      const parsedWorkspaces = JSON.parse(savedData);

      if (Array.isArray(parsedWorkspaces) && parsedWorkspaces.length > 0) {
        parsedWorkspaces.forEach((ws) => {
          ws.code = "";
        });

        setWorkspaces(parsedWorkspaces);

        if (savedActiveId) {
          const targetId = parseInt(savedActiveId);
          // NEW: Ensure the saved ID actually exists before loading it
          const exists = parsedWorkspaces.some((w) => w.id === targetId);
          if (exists) {
            setActiveWorkspaceId(targetId);
          } else {
            setActiveWorkspaceId(parsedWorkspaces[0].id);
          }
        } else {
          setActiveWorkspaceId(parsedWorkspaces[0].id);
        }
        return;
      }
    } catch (e) {
      console.error("Gagal memuat autosave:", e);
    }
  }
}

export function undo() {
  const ws = getActiveWorkspace();
  if (!ws || ws.historyIndex <= 0) return; // Can't undo past the first state
  ws.historyIndex--;
  ws.blocks = JSON.parse(ws.history[ws.historyIndex]);
  if (window.updateUndoRedoUI) window.updateUndoRedoUI();
  if (window.renderWorkspace) window.renderWorkspace();
}

export function redo() {
  const ws = getActiveWorkspace();
  if (!ws || ws.historyIndex >= ws.history.length - 1) return;
  ws.historyIndex++;
  ws.blocks = JSON.parse(ws.history[ws.historyIndex]);
  if (window.updateUndoRedoUI) window.updateUndoRedoUI();
  if (window.renderWorkspace) window.renderWorkspace();
}
