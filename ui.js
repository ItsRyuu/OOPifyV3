import {
  workspaces,
  getActiveWorkspace,
  setActiveWorkspaceId,
  setWorkspaces,
  undo,
  redo,
  findBlockAndParent,
  saveState,
} from "./state.js";
import { render } from "./renderer.js";
import { i18n, t } from "./language.js";

window.updateUndoRedoUI = function () {
  const ws = getActiveWorkspace();
  const btnUndo = document.getElementById("btn-undo");
  const btnRedo = document.getElementById("btn-redo");
  if (!ws || !btnUndo || !btnRedo) return;

  btnUndo.disabled = ws.historyIndex <= 0;
  btnRedo.disabled = ws.historyIndex >= ws.history.length - 1;
};

export function renderTabs() {
  const container = document.getElementById("tabs-container");
  container.innerHTML = "";
  const activeId = getActiveWorkspace().id;

  workspaces.forEach((ws) => {
    const isActive = ws.id === activeId;
    const iconColor = isActive ? "#4c97ff" : "#666";
    const iconWidth = isActive ? "2.5" : "2";

    const fileIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="${iconWidth}" stroke="${iconColor}" style="width: 14px; height: 14px; margin-right: 6px;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>`;

    const tab = document.createElement("div");
    tab.className = `tab ${isActive ? "active" : ""}`;
    tab.innerHTML = fileIcon;

    // The name span (Editable on double click)
    const nameSpan = document.createElement("span");
    nameSpan.textContent = ws.name;
    nameSpan.style.outline = "none";
    nameSpan.style.whiteSpace = "nowrap";

    // Double click to edit
    nameSpan.ondblclick = (e) => {
      e.stopPropagation();
      nameSpan.contentEditable = true;
      nameSpan.focus();

      // Select all text automatically
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(nameSpan);
      selection.removeAllRanges();
      selection.addRange(range);
    };

    // Save on blur (clicking away)
    nameSpan.onblur = () => {
      nameSpan.contentEditable = false;
      const newName = nameSpan.textContent.trim();
      if (newName !== "") {
        ws.name = newName;
        saveState();
      } else {
        nameSpan.textContent = ws.name; // Revert if empty
      }
    };

    // Save on Enter, Revert on Escape
    nameSpan.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        nameSpan.blur();
      } else if (e.key === "Escape") {
        nameSpan.textContent = ws.name; // Revert
        nameSpan.blur();
      }
    };

    // Close button
    const closeSpan = document.createElement("span");
    closeSpan.className = "tab-close";
    closeSpan.textContent = "×";
    closeSpan.onclick = (e) => closeTab(e, ws.id);

    tab.appendChild(nameSpan);
    tab.appendChild(closeSpan);

    // Switch tab logic
    tab.onclick = (e) => {
      // Ignore if clicking the close button or if already editing
      if (e.target === closeSpan) return;
      if (nameSpan.isContentEditable) return;

      // ONLY switch and re-render if it's a different tab
      if (ws.id !== activeId) {
        switchTab(ws.id);
      }
    };

    container.appendChild(tab);
  });
}

export function switchTab(id) {
  setActiveWorkspaceId(id);
  renderTabs();
  render();
  const ws = getActiveWorkspace();
  const codeOutput = document.getElementById("code-output");
  codeOutput.textContent = ws.code || t("code_placeholder");
  if (window.Prism) Prism.highlightElement(codeOutput);
  if (window.updateUndoRedoUI) window.updateUndoRedoUI();
  if (window.clearErrorState) window.clearErrorState();
}

export function closeTab(evt, id) {
  if (evt) evt.stopPropagation();

  if (workspaces.length <= 1) {
    alert(t("alert_no_close_last"));
    return;
  }

  const wsToClose = workspaces.find((w) => w.id === id);
  if (!wsToClose) return;

  // 1. Build the modal dynamically (reusing reset-modal styles)
  let overlay = document.getElementById("close-ws-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "close-ws-overlay";
    overlay.style.cssText =
      "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.35); z-index: 20000; display: flex; justify-content: center; align-items: center; opacity: 0; visibility: hidden; transition: opacity 0.2s ease, visibility 0.2s ease;";
    overlay.innerHTML = `
      <div id="close-ws-modal" class="reset-modal" style="background: var(--bg-popover); backdrop-filter: blur(12px) saturate(200%); -webkit-backdrop-filter: blur(12px) saturate(200%); border: 1px solid var(--border-color); border-radius: 32px; padding: 12px; width: 280px; text-align: center; box-shadow: 0 16px 40px var(--shadow-color-popover);">
        <h3 class="reset-title" style="font-size: 16px; font-weight: 600; color: var(--text-main); margin: 8px 8px 10px 8px;" data-i18n="modal_close_ws_title">${t("modal_close_ws_title")}</h3>
        <p class="reset-desc" style="font-size: 14px; color: var(--text-main); margin: 0 8px 16px 8px; line-height: 1.4;">
          <span data-i18n="modal_close_ws_desc1">${t("modal_close_ws_desc1")}</span><span id="close-ws-name"></span><span data-i18n="modal_close_ws_desc2">${t("modal_close_ws_desc2")}</span>
        </p>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
           <button id="btn-cancel-close" style="flex: 1; padding: 12px; border-radius: 50px; border: none; font-weight: 600; cursor: pointer; color: var(--text-main); font-family: 'SN Pro', sans-serif; font-size: 14px; " data-i18n="btn_cancel">${t("btn_cancel")}</button>
           <button id="btn-confirm-close" class="reset-btn danger" style="flex: 1; padding: 12px; border-radius: 50px; border: none; font-weight: 600; cursor: pointer; font-family: 'SN Pro', sans-serif;" data-i18n="btn_delete">${t("btn_delete")}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Cancel Listeners
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) {
        overlay.style.opacity = "0";
        setTimeout(() => (overlay.style.visibility = "hidden"), 200);
      }
    });
    document
      .getElementById("btn-cancel-close")
      .addEventListener("click", () => {
        overlay.style.opacity = "0";
        setTimeout(() => (overlay.style.visibility = "hidden"), 200);
      });
  }

  // 2. Set the dynamic text
  document.getElementById("close-ws-name").textContent = wsToClose.name;

  // 3. Clear old event listeners from the confirm button to prevent multi-deletion
  const oldConfirmBtn = document.getElementById("btn-confirm-close");
  const newConfirmBtn = oldConfirmBtn.cloneNode(true);
  oldConfirmBtn.parentNode.replaceChild(newConfirmBtn, oldConfirmBtn);

  // 4. Handle Deletion
  newConfirmBtn.addEventListener("click", () => {
    overlay.style.opacity = "0";
    setTimeout(() => (overlay.style.visibility = "hidden"), 200);

    setWorkspaces(workspaces.filter((w) => w.id !== id));

    if (getActiveWorkspace() === undefined) {
      setActiveWorkspaceId(workspaces[0].id);
      switchTab(workspaces[0].id);
    } else {
      renderTabs();
    }

    // --- THIS SAVES IT PERMANENTLY ---
    saveState();
  });

  // 5. Show Modal
  overlay.style.visibility = "visible";
  setTimeout(() => (overlay.style.opacity = "1"), 10);
}

export function switchCategory(cat) {
  const title = document.getElementById("palette-title");
  const icons = document.querySelectorAll(".cat-icon");
  const allThumbs = document.querySelectorAll(".block-thumbnail");
  const subCategories = document.querySelectorAll(".palette-subcategory");

  icons.forEach((i) => i.classList.remove("active"));
  allThumbs.forEach((t) => (t.style.display = "none"));
  subCategories.forEach((s) => (s.style.display = "none"));
  document.getElementById("palette-content").scrollTop = 0;

  switch (cat) {
    case "class":
      title.setAttribute("data-i18n", "title_cat_class"); // <-- ADD THIS
      title.innerText = t("title_cat_class");
      if (icons[0]) icons[0].classList.add("active");
      document
        .querySelectorAll(".class-thumb")
        .forEach((t) => (t.style.display = "flex"));
      break;
    case "attr":
      title.setAttribute("data-i18n", "title_cat_attr"); // <-- ADD THIS
      title.innerText = t("title_cat_attr");
      if (icons[1]) icons[1].classList.add("active");
      document
        .querySelectorAll(".attr-thumb")
        .forEach((t) => (t.style.display = "flex"));
      break;
    case "construct":
      title.setAttribute("data-i18n", "title_cat_construct"); // <-- ADD THIS
      title.innerText = t("title_cat_construct");
      if (icons[2]) icons[2].classList.add("active");
      document
        .querySelectorAll(".construct-thumb")
        .forEach((t) => (t.style.display = "flex"));
      break;
    case "method":
      title.setAttribute("data-i18n", "title_cat_method"); // <-- ADD THIS
      title.innerText = t("title_cat_method");
      if (icons[3]) icons[3].classList.add("active");
      document
        .querySelectorAll(".method-thumb")
        .forEach((t) => (t.style.display = "flex"));
      break;
    case "connect":
      title.setAttribute("data-i18n", "title_cat_connect"); // <-- ADD THIS
      title.innerText = t("title_cat_connect");
      if (icons[4]) icons[4].classList.add("active");
      document
        .querySelectorAll(".connect-thumb")
        .forEach((t) => (t.style.display = "flex"));
      break;
    case "operator":
      title.setAttribute("data-i18n", "title_cat_operator"); // <-- ADD THIS
      title.innerText = t("title_cat_operator");
      if (icons[5]) icons[5].classList.add("active");
      document.querySelectorAll(".operator-group").forEach((t) => {
        t.style.display = t.classList.contains("palette-subcategory")
          ? "block"
          : "flex";
      });
      break;
    case "control":
      title.setAttribute("data-i18n", "title_cat_control"); // <-- ADD THIS
      title.innerText = t("title_cat_control");
      if (icons[6]) icons[6].classList.add("active");
      document.querySelectorAll(".control-group").forEach((t) => {
        t.style.display = t.classList.contains("palette-subcategory")
          ? "block"
          : "flex";
      });
      break;
  }
}

export function copyCode() {
  const codeText = document.getElementById("code-output").textContent;
  const btn = document.getElementById("btn-copy");

  const copyHtml = `
    <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-6">
      <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6" />
    </svg>
  `;

  const successHtml = `
    <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-6">
      <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  `;

  navigator.clipboard.writeText(codeText).then(() => {
    btn.innerHTML = successHtml;

    setTimeout(() => {
      btn.innerHTML = copyHtml;
    }, 2000);
  });
}

export function setupThemeToggle() {
  const btn = document.getElementById("btn-theme-toggle");
  const body = document.body;

  const savedTheme = localStorage.getItem("oopify-theme");
  const isDark = savedTheme === "dark";

  if (isDark) {
    body.classList.add("dark-mode");
  }

  updateIcon(isDark);

  btn.onclick = () => {
    const isNowDark = body.classList.toggle("dark-mode");
    localStorage.setItem("oopify-theme", isNowDark ? "dark" : "light");

    updateIcon(isNowDark);

    if (window.cmSetSyntaxTheme) {
      const currentSyntax =
        localStorage.getItem("oopify-syntax-theme-name") || "";
      const lightThemes = ["default", "github", "vs", "material-light"];
      const darkThemes = [
        "onedark",
        "vsc-dark-plus",
        "dracula",
        "nord",
        "synthwave84",
        "tomorrow",
      ];

      if (isNowDark && !darkThemes.includes(currentSyntax)) {
        window.cmSetSyntaxTheme("onedark", "prism-onedark.css");
      } else if (!isNowDark && !lightThemes.includes(currentSyntax)) {
        window.cmSetSyntaxTheme(
          "default",
          "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css",
        );
      }
    }
  };
}

function updateIcon(isDark) {
  const btn = document.getElementById("btn-theme-toggle");

  if (isDark) {
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
</svg>
`;
    btn.setAttribute("title", "");
  } else {
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
</svg>
`;
    btn.setAttribute("title", "");
  }
}

export function setupFullscreenToggle() {
  const btn = document.getElementById("btn-fullscreenCode");
  const panel = document.getElementById("right-panel");

  btn.onclick = () => {
    const isFullscreen = panel.classList.toggle("fullscreen");

    if (isFullscreen) {
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
        </svg>
      `;
      btn.title = "";
    } else {
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
        </svg>
      `;
      btn.title = "";
    }
  };
}

export function setupUndoRedo() {
  const btnUndo = document.getElementById("btn-undo");
  const btnRedo = document.getElementById("btn-redo");

  btnUndo.onclick = () => {
    undo();
    render();
  };
  btnRedo.onclick = () => {
    redo();
    render();
  };

  document.addEventListener("keydown", function (e) {
    // Avoid triggering shortcuts if the user is typing inside an input field
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

    // Helper to instantly hide the menu if it's open
    const hideContextMenu = () => {
      const menu = document.getElementById("custom-context-menu");
      if (menu && !menu.classList.contains("hidden")) {
        menu.classList.add("hidden");
        window.contextMenuTargetId = null; // Clear active target
      }
    };

    // Prioritize the block locked by the Context Menu, otherwise use hovered block
    const getTargetId = () =>
      window.contextMenuTargetId || window.hoveredBlockId;

    // 1. UNDO (Ctrl+Z)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      hideContextMenu();
      if (e.shiftKey) {
        window.cmRedo ? window.cmRedo() : (redo(), render());
      } else {
        window.cmUndo ? window.cmUndo() : (undo(), render());
      }
    }
    // 2. REDO (Ctrl+Y)
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      hideContextMenu();
      if (window.cmRedo) window.cmRedo();
      else {
        redo();
        render();
      }
    }
    // 3. DUPLICATE (Ctrl+D)
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault(); // <--- STRICTLY BLOCKS CHROME'S BOOKMARK POPUP
      const targetId = getTargetId(); // 1. Grab the ID first
      hideContextMenu(); // 2. Hide the menu (which clears the target)
      if (targetId && window.cmDuplicate) window.cmDuplicate(targetId);
    }
    // 4. DELETE (Backspace / Delete)
    else if (e.key === "Backspace" || e.key === "Delete") {
      const targetId = getTargetId(); // 1. Grab the ID first
      hideContextMenu(); // 2. Hide the menu
      if (targetId && window.cmDelete) window.cmDelete(targetId);
    }
    // 5. AUTO LAYOUT (Shift + A)
    else if (e.shiftKey && e.key.toLowerCase() === "a") {
      e.preventDefault();
      hideContextMenu();
      if (window.cmTidy) window.cmTidy();
    }
    // 6. TOGGLE UI (Ctrl + \)
    else if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
      e.preventDefault();
      hideContextMenu();
      if (window.cmToggleUI) window.cmToggleUI();
    }
  });
}

export function setupModifierDropdown() {
  const menu = document.getElementById("global-modifier-menu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "global-modifier-menu";
    menu.className = "hidden";
    document.body.appendChild(menu);
  }

  let currentMenuContext = null;

  window.applyModifier = function (blockId, key, val, closeAfter = false) {
    if (val === "true") val = true;
    if (val === "false") val = false;

    const ws = getActiveWorkspace();

    let target = null;
    const search = (blocks) => {
      for (let b of blocks) {
        if (b.id === blockId) target = b;
        if (b.children) search(b.children);
      }
    };
    search(ws.blocks);

    if (target) {
      target.data[key] = val;

      if (typeof render === "function") render();
      if (typeof saveState === "function") saveState();
    }

    if (closeAfter) {
      closeModifierMenu();
    } else {
      refreshModifierMenu();
    }
  };

  window.refreshModifierMenu = function () {
    if (!currentMenuContext) return;
    const { blockId, type, colorHex } = currentMenuContext;
    const ws = getActiveWorkspace();

    let block = null;
    const search = (blocks) => {
      for (let b of blocks) {
        if (b.id === blockId) block = b;
        if (b.children) search(b.children);
      }
    };
    search(ws.blocks);

    if (!block) {
      closeModifierMenu();
      return;
    }

    let html = "";

    // --- 0. SCAN PILLS ---
    if (type === "scan") {
      menu.style.width = "128px";
      menu.style.minWidth = "128px";

      const options = [
        { val: "String", text: t("scan_string") },
        { val: "int", text: t("scan_int") },
        { val: "double", text: t("scan_double") },
        { val: "boolean", text: t("scan_boolean") },
      ];

      const currentVal = block.data.type || "String";

      options.forEach((opt) => {
        const isActive = currentVal === opt.val;
        html += `<div class="mod-option ${isActive ? "active" : ""}" style="padding: 5px 12px; min-height: 28px; ${isActive ? `background:${colorHex};` : ""}" onclick="applyModifier('${blockId}', 'type', '${opt.val}', true)">${opt.text}</div>`;
      });
    }
    // --- 1. DATA TYPE MENUS (Width: 88px) ---
    else if (type === "dataType" || type === "returnType") {
      menu.style.width = "88px";
      menu.style.minWidth = "88px";

      const options =
        type === "returnType"
          ? ["void", "int", "String", "boolean", "double"]
          : ["int", "double", "boolean", "String"];

      const propName = type === "returnType" ? "returnType" : "type";
      const currentVal =
        block.data[propName] || (type === "returnType" ? "void" : "int");

      options.forEach((opt) => {
        const isActive = currentVal === opt;
        html += `<div class="mod-option ${isActive ? "active" : ""}" style="padding: 5px 12px; min-height: 28px; ${isActive ? `background:${colorHex};` : ""}" onclick="applyModifier('${blockId}', '${propName}', '${opt}', true)">${opt}</div>`;
      });
    }
    // --- 2. EXTENDS, IMPLEMENTS, & NEW OBJECT MENUS (Variable Width) ---
    else if (["extends", "implements", "classRef", "classObj"].includes(type)) {
      menu.style.width = "auto";
      menu.style.minWidth = "112px";

      let propName = "";
      let defaultOpt = "Object";
      let allowedTypes = [];
      let isInterfaceContext = false;
      let parentName = null;

      // 1. DYNAMIC CONTEXT: Find the parent container
      if (!block.id.startsWith("thumb-")) {
        let parentNode = null;
        const findParent = (list, targetId, currentParent = null) => {
          for (const b of list) {
            if (b.id === targetId) {
              parentNode = currentParent;
              return true;
            }
            if (b.children && findParent(b.children, targetId, b)) return true;
          }
          return false;
        };
        findParent(ws.blocks, blockId);

        if (parentNode) {
          parentName = parentNode.data.name;
          isInterfaceContext = parentNode.type === "interface";
        }
      }

      // 2. Determine Properties based on block type
      if (type === "extends") {
        propName = "superClass";
        defaultOpt = isInterfaceContext ? "Interface" : "Object";
        allowedTypes = isInterfaceContext ? ["interface"] : ["class"];
      } else if (type === "implements") {
        propName = "interfaces";
        defaultOpt = "Interface";
        allowedTypes = ["interface"];
      } else if (type === "classRef") {
        propName = "classRef";
        defaultOpt = "Object";
        allowedTypes = ["class", "interface"];
      } else if (type === "classObj") {
        propName = "classObj";
        defaultOpt = "Object";
        allowedTypes = ["class"];
      }

      // 3. Build Options Array
      let options = [defaultOpt];

      if (!block.id.startsWith("thumb-")) {
        const validTargets = ws.blocks.filter((b) => {
          if (!allowedTypes.includes(b.type)) return false; // Must be correct type (class or interface)
          if (b.id === blockId) return false; // Can't be itself
          if (parentName && b.data.name === parentName) return false; // Circular dependency check!
          return true;
        });

        if (validTargets.length > 0) {
          options = validTargets.map((b) => b.data.name || defaultOpt);
        }
      } else {
        // Fallback labels for the sidebar palette thumbnails
        options =
          type === "classRef" || type === "classObj" ? ["Main"] : [defaultOpt];
      }

      // 4. Fallback if current value is invalid
      let currentVal = block.data[propName];
      if (!currentVal || !options.includes(currentVal)) {
        currentVal = options[0];
      }

      // 5. Render HTML
      options.forEach((opt) => {
        const isActive = currentVal === opt;
        const safeOpt = opt.replace(/'/g, "\\'");
        html += `<div class="mod-option ${isActive ? "active" : ""}" style="white-space: nowrap; ${isActive ? `background:${colorHex};` : ""}" onclick="applyModifier('${blockId}', '${propName}', '${safeOpt}', true)">${opt}</div>`;
      });
    }
    // --- 3. ACCESS MODIFIER MENUS ---
    else {
      if (type === "interface-method-access") {
        menu.style.width = "160px";
        menu.style.minWidth = "160px";
      } else {
        menu.style.width = "112px";
        menu.style.minWidth = "112px";
      }

      let accessOptions = [];
      let hasFinal = false,
        hasAbstract = false,
        hasStatic = false;

      if (type === "class") {
        accessOptions = ["default", "public"];
        hasFinal = true;
        hasAbstract = true;
      } else if (type === "method") {
        accessOptions = ["default", "public", "private", "protected"];
        hasFinal = true;
        hasAbstract = false;
        hasStatic = true;
      } else if (type === "interface-method-access") {
        accessOptions = ["default", "public", "protected"];
        hasFinal = false;
        hasAbstract = false;
        hasStatic = false;
      } else if (type === "variable" || type === "variable-value") {
        accessOptions = ["default", "public", "private", "protected"];
        hasFinal = true;
        hasStatic = true;
      } else if (type === "construct") {
        accessOptions = ["default", "public", "private"];
      }

      const currentAccess =
        block.data.access?.trim() === ""
          ? "default"
          : block.data.access || "default";

      accessOptions.forEach((opt) => {
        const isActive = currentAccess === opt;
        const val = opt === "default" ? "" : opt;

        const displayLabel =
          type === "interface-method-access" ? `${opt} abstract` : opt;

        html += `<div class="mod-option ${isActive ? "active" : ""}" style="${isActive ? `background:${colorHex};` : ""}" onclick="applyModifier('${blockId}', 'access', '${val}', true)">${displayLabel}</div>`;
      });

      if (hasFinal || hasAbstract || hasStatic) {
        html += `<div class="mod-divider"></div>`;

        const nextStatic = !block.data.isStatic;
        const nextFinal = !block.data.isFinal;
        const nextAbstract = !block.data.isAbstract;

        if (hasStatic) {
          html += `<div class="mod-checkbox ${block.data.isStatic ? "checked" : ""}" onclick="applyModifier('${blockId}', 'isStatic', '${nextStatic}', false)">
                    <div class="mod-check-circle" style="${block.data.isStatic ? `background:${colorHex}; border-color:${colorHex}` : ""}"></div> static
                   </div>`;
        }
        if (hasFinal) {
          html += `<div class="mod-checkbox ${block.data.isFinal ? "checked" : ""}" onclick="applyModifier('${blockId}', 'isFinal', '${nextFinal}', false)">
                    <div class="mod-check-circle" style="${block.data.isFinal ? `background:${colorHex}; border-color:${colorHex}` : ""}"></div> final
                   </div>`;
        }
        if (hasAbstract) {
          html += `<div class="mod-checkbox ${block.data.isAbstract ? "checked" : ""}" onclick="applyModifier('${blockId}', 'isAbstract', '${nextAbstract}', false)">
                    <div class="mod-check-circle" style="${block.data.isAbstract ? `background:${colorHex}; border-color:${colorHex}` : ""}"></div> abstract
                   </div>`;
        }
      }
    }

    menu.innerHTML = html;
  };

  window.openModifierMenu = function (buttonEl, blockId, type, colorHex) {
    currentMenuContext = { blockId, type, colorHex };

    const rect = buttonEl.getBoundingClientRect();
    menu.style.top = `${rect.top}px`;
    menu.style.left = `${rect.left}px`;

    refreshModifierMenu();
    menu.classList.remove("hidden");
  };

  window.closeModifierMenu = function () {
    menu.classList.add("hidden");
    currentMenuContext = null;
  };

  document.addEventListener(
    "mousedown",
    (e) => {
      if (!menu) return;
      const isInsideMenu = menu.contains(e.target);
      let isDropdownBtn = false;
      if (e.target && typeof e.target.closest === "function") {
        isDropdownBtn = e.target.closest(".custom-dropdown-btn") !== null;
      }
      if (!isInsideMenu && !isDropdownBtn) {
        closeModifierMenu();
      }
    },
    true,
  );

  window.addEventListener(
    "wheel",
    () => {
      if (!menu.classList.contains("hidden")) {
        closeModifierMenu();
      }
    },
    { passive: true },
  );
}

export function setupGlobalActions() {
  const workspaceContainer = document.getElementById("workspace-container");

  // Track the hovered block so keyboard shortcuts (Delete, Duplicate) still work without a right-click menu
  workspaceContainer.addEventListener("mousemove", (e) => {
    const blockGroup = e.target.closest("g[data-id]");
    window.hoveredBlockId = blockGroup
      ? blockGroup.getAttribute("data-id")
      : null;
  });

  window.cmToggleUI = () => {
    const ws = getActiveWorkspace();
    if (!ws) return;
    const isHidden = document.body.classList.contains("ui-hidden");
    if (isHidden) {
      ws.camera.x -= 280;
      document.body.classList.remove("ui-hidden");
    } else {
      ws.camera.x += 280;
      document.body.classList.add("ui-hidden");
    }
    if (typeof render === "function") render();
    if (typeof saveState === "function") saveState();
  };

  window.cmUndo = () => {
    undo();
    render();
  };
  window.cmRedo = () => {
    redo();
    render();
  };

  window.cmDelete = (id) => {
    const ws = getActiveWorkspace();
    const result = findBlockAndParent(ws.blocks, id);
    if (result) {
      const targetBlock = result.block;
      if (result.parent) {
        result.parent.children = result.parent.children.filter(
          (b) => b.id !== id,
        );
      } else {
        ws.blocks = ws.blocks.filter((b) => b.id !== id);
      }
      if (
        (targetBlock.type === "class" || targetBlock.type === "interface") &&
        targetBlock.data &&
        targetBlock.data.name
      ) {
        if (window.cascadeDeleteBlueprint)
          window.cascadeDeleteBlueprint(targetBlock.data.name);
      }
      render();
      saveState();
    }
  };

  window.cmReset = () => {
    let overlay = document.getElementById("reset-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "reset-overlay";
      overlay.style.cssText =
        "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.35); z-index: 20000; display: flex; justify-content: center; align-items: center; opacity: 0; visibility: hidden; transition: opacity 0.2s ease, visibility 0.2s ease;";
      overlay.innerHTML = `
        <div id="reset-modal" class="reset-modal" style="background: var(--bg-popover); backdrop-filter: blur(12px) saturate(200%); -webkit-backdrop-filter: blur(12px) saturate(200%); border: 1px solid var(--border-color); border-radius: 32px; padding: 12px; width: 280px; text-align: center; box-shadow: 0 16px 40px var(--shadow-color-popover);">
          <h3 class="reset-title" style="font-size: 16px; font-weight: 600; color: var(--text-main); margin: 8px 8px 10px 8px;" data-i18n="modal_reset_title">${t("modal_reset_title")}</h3>
          <p class="reset-desc" style="font-size: 14px; color: var(--text-main); margin: 0 8px 16px 8px; line-height: 1.4;" data-i18n="modal_reset_desc" data-i18n-type="html">${t("modal_reset_desc")}</p>
          <div style="display: flex; gap: 8px; margin-top: 8px;">
             <button id="btn-cancel-reset" style="flex: 1; padding: 12px; border-radius: 50px; border: none; font-weight: 600; cursor: pointer; color: var(--text-main); font-family: 'SN Pro', sans-serif; font-size: 14px;" data-i18n="btn_cancel">${t("btn_cancel")}</button>
             <button id="btn-confirm-reset" class="reset-btn danger" style="flex: 1; padding: 12px; border-radius: 50px; border: none; font-weight: 600; cursor: pointer; font-family: 'SN Pro', sans-serif;" data-i18n="btn_delete_all">${t("btn_delete_all")}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.addEventListener("mousedown", (e) => {
        if (e.target === overlay) {
          overlay.style.opacity = "0";
          setTimeout(() => (overlay.style.visibility = "hidden"), 200);
        }
      });

      document
        .getElementById("btn-cancel-reset")
        .addEventListener("click", () => {
          overlay.style.opacity = "0";
          setTimeout(() => (overlay.style.visibility = "hidden"), 200);
        });

      document
        .getElementById("btn-confirm-reset")
        .addEventListener("click", () => {
          overlay.style.opacity = "0";
          setTimeout(() => (overlay.style.visibility = "hidden"), 200);
          const ws = getActiveWorkspace();
          ws.blocks = [];
          ws.camera = { x: 0, y: 0, zoom: 1 };
          ws.code = "";
          localStorage.removeItem("oopify_autosave");
          if (typeof render === "function") render();
          saveState();
          const codeOutput = document.getElementById("code-output");
          if (codeOutput) {
            codeOutput.textContent = ws.code || t("code_placeholder");
            if (window.Prism) Prism.highlightElement(codeOutput);
          }
          if (window.clearErrorState) window.clearErrorState();
        });
    }
    overlay.style.visibility = "visible";
    setTimeout(() => (overlay.style.opacity = "1"), 10);
  };
}

export function setupAppMenu() {
  const logo = document.getElementById("logo-area");
  const menuContainer = document.getElementById("app-menu-container");
  const allMenuItems = document.querySelectorAll(".app-menu-panel .cm-item");

  let switchTimeout = null;
  let closeTimeout = null;
  let submenuRect = null;
  let mouseLocs = [];

  // --- Theme Checkmark Initialization ---
  const savedTheme = localStorage.getItem("oopify-theme");
  if (savedTheme === "dark") {
    document.getElementById("theme-opt-dark")?.classList.add("selected");
  } else if (savedTheme === "light") {
    document.getElementById("theme-opt-light")?.classList.add("selected");
  } else {
    document.getElementById("theme-opt-system")?.classList.add("selected");
  }

  // --- Theme Setting Logic ---
  window.cmSetTheme = (mode) => {
    const body = document.body;
    const btn = document.getElementById("btn-theme-toggle");

    // Update the checkmarks dynamically
    document
      .querySelectorAll("#submenu-theme .cm-item")
      .forEach((el) => el.classList.remove("selected"));
    const activeThemeOpt = document.getElementById("theme-opt-" + mode);
    if (activeThemeOpt) activeThemeOpt.classList.add("selected");

    let wantDark = false;
    if (mode === "system") {
      wantDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      localStorage.removeItem("oopify-theme");
    } else {
      wantDark = mode === "dark";
      localStorage.setItem("oopify-theme", mode);
    }

    if (wantDark !== body.classList.contains("dark-mode")) {
      if (btn) btn.click(); // This single click now handles BOTH the UI and Syntax themes!
    }
  };

  const applyTranslations = (lang) => {
    const dict = i18n[lang] || i18n["id"];
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) {
        if (el.getAttribute("data-i18n-type") === "html") {
          el.innerHTML = dict[key];
        } else {
          el.textContent = dict[key];
        }
      }
    });
  };

  // Run translator immediately on load
  const savedLang = localStorage.getItem("oopify-lang") || "id";
  const activeLangOpt = document.getElementById(`lang-opt-${savedLang}`);
  if (activeLangOpt) activeLangOpt.classList.add("selected");
  applyTranslations(savedLang);

  // Function called when user clicks English / Indonesia in the menu
  window.cmSetLanguage = (lang) => {
    // 1. Grab the old placeholder BEFORE we switch the language
    const currentLang = localStorage.getItem("oopify-lang") || "id";
    const currentDict = i18n[currentLang] || i18n["id"];
    const oldPlaceholder = currentDict["code_placeholder"];

    const codeOutput = document.getElementById("code-output");
    let isShowingPlaceholder = false;

    if (codeOutput) {
      // Check if the panel is currently showing the placeholder or is empty
      isShowingPlaceholder =
        codeOutput.textContent.trim() === oldPlaceholder.trim() ||
        codeOutput.textContent.trim() === "";
    }

    // 2. Change the language
    localStorage.setItem("oopify-lang", lang);

    document
      .querySelectorAll("#submenu-language .cm-item")
      .forEach((el) => el.classList.remove("selected"));
    const newlySelected = document.getElementById("lang-opt-" + lang);
    if (newlySelected) newlySelected.classList.add("selected");

    // Translate the main UI
    applyTranslations(lang);

    // 3. Handle the code block safely
    if (codeOutput) {
      if (isShowingPlaceholder) {
        // Only inject the new placeholder if they haven't clicked "Convert" yet!
        const newDict = i18n[lang] || i18n["id"];
        codeOutput.textContent = newDict["code_placeholder"];
      }
      // If isShowingPlaceholder is false, it means they clicked convert,
      // so we leave the actual Java code completely untouched!

      // Always rebuild the syntax spans and line numbers
      if (window.Prism) Prism.highlightElement(codeOutput);
    }
  };

  // --- App Menu Trajectory Logic ---
  document.addEventListener("mousemove", (e) => {
    if (menuContainer.classList.contains("hidden")) return;
    mouseLocs.push({ x: e.clientX, y: e.clientY });
    if (mouseLocs.length > 3) mouseLocs.shift();
  });

  const sign = (p1, p2, p3) =>
    (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const isPointInTriangle = (pt, v1, v2, v3) => {
    const d1 = sign(pt, v1, v2);
    const d2 = sign(pt, v2, v3);
    const d3 = sign(pt, v3, v1);
    const has_neg = d1 < 0 || d2 < 0 || d3 < 0;
    const has_pos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(has_neg && has_pos);
  };

  const closeDeeperPanels = (level) => {
    document.querySelectorAll(".app-menu-panel").forEach((p) => {
      const pLevel = parseInt(p.getAttribute("data-level") || "1");

      if (pLevel > level) {
        p.classList.remove("show");
      }

      if (pLevel >= level) {
        p.querySelectorAll(".cm-item.active-parent").forEach((i) =>
          i.classList.remove("active-parent"),
        );
      }
    });
  };

  const hideAllMenus = () => {
    menuContainer.classList.add("hidden");
    document
      .querySelectorAll(".app-menu-panel")
      .forEach((p) => p.classList.remove("show"));
    document
      .querySelectorAll(".cm-item.active-parent")
      .forEach((i) => i.classList.remove("active-parent"));
  };

  const openSubmenu = (targetId, triggerItem) => {
    if (!targetId) return;
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      const currentPanel = triggerItem.closest(".app-menu-panel");
      const currentLevel = parseInt(
        currentPanel.getAttribute("data-level") || "1",
      );

      closeDeeperPanels(currentLevel);
      triggerItem.classList.add("active-parent"); // Apply hover color to parent!

      // --- FILTER SYNTAX THEMES BASED ON UI MODE ---
      if (targetId === "submenu-syntax") {
        const isDark = document.body.classList.contains("dark-mode");
        targetEl.querySelectorAll(".syntax-opt").forEach((opt) => {
          if (isDark) {
            opt.style.display = opt.classList.contains("dark-theme")
              ? "flex"
              : "none";
          } else {
            opt.style.display = opt.classList.contains("light-theme")
              ? "flex"
              : "none";
          }
        });
      }

      // Calculate true layout positions, ignoring mid-animation CSS transforms
      const containerRect = menuContainer.getBoundingClientRect();
      const triggerRect = triggerItem.getBoundingClientRect();
      const panelRect = currentPanel.getBoundingClientRect();

      targetEl.style.top = triggerRect.top - containerRect.top - 6.5 + "px";
      targetEl.style.left =
        panelRect.left -
        containerRect.left +
        currentPanel.offsetWidth +
        6 +
        "px";

      targetEl.classList.add("show");

      const rect = targetEl.getBoundingClientRect();
      submenuRect = { top: rect.top, bottom: rect.bottom, left: rect.left };
    }
  };

  logo.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = menuContainer.classList.contains("hidden");

    if (isHidden) {
      const isUIHidden = document.body.classList.contains("ui-hidden");
      const uiTextEl = document.getElementById("app-menu-toggle-ui-text");
      if (uiTextEl) {
        uiTextEl.textContent = isUIHidden ? "Tampilkan UI" : "Sembunyikan UI";
      }

      menuContainer.classList.remove("hidden");
      mouseLocs = [];
    } else {
      hideAllMenus();
    }
  });

  allMenuItems.forEach((item) => {
    item.addEventListener("click", () => {
      if (!item.hasAttribute("data-target")) {
        hideAllMenus();
      }
    });

    item.addEventListener("mouseenter", () => {
      clearTimeout(closeTimeout);
      const targetId = item.getAttribute("data-target");
      const currentPanel = item.closest(".app-menu-panel");
      const currentLevel = parseInt(
        currentPanel.getAttribute("data-level") || "1",
      );

      const executeSwitch = () => {
        if (targetId) {
          openSubmenu(targetId, item);
        } else {
          closeDeeperPanels(currentLevel);
          submenuRect = null;
        }
      };

      const nextLevelPanel = document.querySelector(
        `.app-menu-panel[data-level="${currentLevel + 1}"].show`,
      );

      if (nextLevelPanel && submenuRect && mouseLocs.length > 1) {
        const currentMouse = mouseLocs[mouseLocs.length - 1];
        const prevMouse = mouseLocs[0];
        const v1 = prevMouse;
        const v2 = { x: submenuRect.left, y: submenuRect.top };
        const v3 = { x: submenuRect.left, y: submenuRect.bottom };

        if (isPointInTriangle(currentMouse, v1, v2, v3)) {
          clearTimeout(switchTimeout);
          switchTimeout = setTimeout(executeSwitch, 300);
          return;
        }
      }

      clearTimeout(switchTimeout);
      executeSwitch();
    });
  });

  document.querySelectorAll(".app-menu-panel").forEach((panel) => {
    panel.addEventListener("mouseenter", () => {
      clearTimeout(switchTimeout);
      clearTimeout(closeTimeout);
    });
  });

  menuContainer.addEventListener("mouseleave", () => {
    closeTimeout = setTimeout(() => {
      hideAllMenus();
    }, 250);
  });

  menuContainer.addEventListener("mouseenter", () => {
    clearTimeout(closeTimeout);
  });

  document.addEventListener("click", (e) => {
    if (!menuContainer.contains(e.target) && !logo.contains(e.target)) {
      hideAllMenus();
    }
  });
}

export function setupAppMenuActions() {
  // --- FILE MENU ---
  window.cmNewWorkspace = () => {
    const newId = Date.now();
    workspaces.push({
      id: newId,
      name: t("workspace_default_name") + (workspaces.length + 1),
      blocks: [],
      camera: { x: 0, y: 0, zoom: 1 },
      code: "",
      history: ["[]"],
      historyIndex: 0,
    });
    setActiveWorkspaceId(newId);
    renderTabs();
    render();
    saveState();
  };

  window.cmCloseWorkspace = () => {
    const activeId = getActiveWorkspace().id;
    closeTab(null, activeId);
  };

  window.cmExportJava = () => {
    const codeOutput = document.getElementById("code-output");
    const code = codeOutput
      ? codeOutput.textContent
      : "// " + t("comment_no_code");
    const blob = new Blob([code], { type: "text/x-java-source" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Main.java";
    a.click();
    URL.revokeObjectURL(url);
  };

  window.cmExportJSON = () => {
    const ws = getActiveWorkspace();
    const data = JSON.stringify(ws, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (ws.name || "OOPify_Project") + ".json";
    a.click();
    URL.revokeObjectURL(url);
  };

  window.cmImportJSON = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json, .json";

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);

          // Basic validation to ensure it's an OOPify workspace
          if (!data.blocks || !Array.isArray(data.blocks))
            throw new Error(t("error_invalid_json"));

          const newId = Date.now();
          const importedWorkspace = {
            ...data,
            id: newId,
            name: data.name || file.name.replace(".json", ""),
            history: [JSON.stringify(data.blocks)],
            historyIndex: 0,
          };

          workspaces.push(importedWorkspace);
          setActiveWorkspaceId(newId);
          renderTabs();
          render();
          saveState();
        } catch (err) {
          alert(t("alert_read_fail") + err.message);
        }
      };
      reader.readAsText(file);
    };

    input.click(); // Trigger the file dialog
  };

  window.cmExitApp = () => {
    if (confirm(t("confirm_exit"))) {
      window.close();
    }
  };

  // --- EDIT MENU ---
  window.cmRenameWorkspace = () => {
    const activeTab = document.querySelector(".tab.active");
    if (!activeTab) return;

    const nameSpan = activeTab.querySelector("span");
    if (!nameSpan) return;

    nameSpan.contentEditable = true;
    nameSpan.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(nameSpan);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  // --- VIEW MENU ---
  window.cmZoomIn = () => {
    const ws = getActiveWorkspace();
    ws.camera.zoom = Math.min(ws.camera.zoom * 1.2, 5); // Max zoom 5x
    render();
  };

  window.cmZoomOut = () => {
    const ws = getActiveWorkspace();
    ws.camera.zoom = Math.max(ws.camera.zoom / 1.2, 0.1); // Min zoom 0.1x
    render();
  };

  window.cmToggleFullscreen = () => {
    const btn = document.getElementById("btn-fullscreenCode");
    if (btn) btn.click(); // Triggers your existing fullscreen code
  };

  // --- PREFERENCES MENU ---
  window.cmSetSyntaxTheme = (name, url) => {
    // Swap the CSS file in the <head>
    const link = document.getElementById("prism-theme");
    if (link) link.href = url;

    // Save preference
    localStorage.setItem("oopify-syntax-theme-name", name);
    localStorage.setItem("oopify-syntax-theme-url", url);

    // Update checkmarks
    document
      .querySelectorAll("#submenu-syntax .cm-check")
      .forEach((c) => (c.style.display = "none"));
    const activeItems = document.querySelectorAll(
      `#submenu-syntax .syntax-opt`,
    );
    activeItems.forEach((item) => {
      if (item.getAttribute("onclick").includes(`'${name}'`)) {
        const check = item.querySelector(".cm-check");
        if (check) check.style.display = "block";
      }
    });
  };

  // --- HELP MENU ---
  window.cmOpenTutorial = () => {
    const btn = document.getElementById("btn-tutorial");
    if (btn) btn.click(); // Triggers your existing tutorial modal
  };

  window.cmAbout = () => {
    const overlay = document.getElementById("about-overlay");
    if (overlay) {
      overlay.classList.add("show");
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const overlay = document.getElementById("about-overlay");
    const closeBtn = document.getElementById("about-close-btn");

    if (closeBtn && overlay) {
      closeBtn.onclick = () => {
        overlay.classList.remove("show");
      };

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          overlay.classList.remove("show");
        }
      });
    }
  });

  // --- INITIALIZE GRID CHECKMARK STATE ---
  const isGridHidden = localStorage.getItem("oopify-grid-hidden") === "true";
  const gridCheckIcon = document.getElementById("grid-check-icon");
  if (gridCheckIcon) {
    gridCheckIcon.style.display = isGridHidden ? "none" : "block";
  }

  // --- INITIALIZE SYNTAX THEME ---
  const savedSyntaxName = localStorage.getItem("oopify-syntax-theme-name");
  const savedSyntaxUrl = localStorage.getItem("oopify-syntax-theme-url");
  if (savedSyntaxName && savedSyntaxUrl) {
    window.cmSetSyntaxTheme(savedSyntaxName, savedSyntaxUrl);
  } else {
    // Default fallback based on current UI mode
    if (document.body.classList.contains("dark-mode")) {
      window.cmSetSyntaxTheme("onedark", "prism-onedark.css");
    } else {
      window.cmSetSyntaxTheme(
        "default",
        "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css",
      );
    }
  }
}
