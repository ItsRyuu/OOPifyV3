import {
  updateBlockData,
  workspaces,
  getActiveWorkspace,
  findBlockAndParent,
  saveState,
  loadFromAutoSave,
} from "./state.js";
import { logEvent, startSession, getEntries, getEntryCount, exportJSON, downloadLog, clearLog } from "./activityLogger.js";
import {
  renderTabs,
  switchTab,
  closeTab,
  switchCategory,
  copyCode,
  setupThemeToggle,
  setupFullscreenToggle,
  setupPedagogyTooltips,
  setupUndoRedo,
  setupModifierDropdown,
  setupContextMenu,
  setupAppMenu,
  setupAppMenuActions,
} from "./ui.js";
import {
  computeLayout,
  render,
  renderClassBlock,
  renderConstructorBlock,
  renderMainMethodBlock,
  renderVariableBlock,
  renderVariableValueBlock,
  renderPropAssignBlock,
  renderParameterBlock,
  renderArgumentBlock,
  renderPrintBlock,
  renderThisBlock,
  renderSuperBlock,
  renderMethodBlock,
  renderMethodCallBlock,
  renderObjectCallerBlock,
  renderNewObjectBlock,
  renderExtendsBlock,
  renderReturnBlock,
  renderJumpBlock,
  renderControlBlock,
  renderForBlock,
  renderOperatorBlock,
  renderImplementsBlock,
  renderInterfaceBlock,
  renderInterfaceMethodBlock,
  renderInputPill,
} from "./renderer.js";
import { startDrag, startSpawn, setupDragListeners } from "./dragDrop.js";
import { setupTutorialModal } from "./tutorial.js";
import { generateJavaCode } from "./codegen.js";
import { t } from "./language.js";

window.updateBlockData = updateBlockData;
window.startDrag = startDrag;
window.startSpawn = startSpawn;
window.switchCategory = switchCategory;
window.copyCode = copyCode;
window.closeTab = closeTab;
window.switchTab = switchTab;
window.renderWorkspace = render;
window.isCodeGeneratedAndReady = false;

// --- ARRAY-DRIVEN PALETTE INITIALIZATION ---
function initPalette() {
  const paletteConfig = [
    {
      id: "class",
      type: "class",
      render: renderClassBlock,
      x: 2,
      y: 2,
      width: 320,
      totalHeight: 120,
      data: { name: "Main", access: "default" },
    },
    {
      id: "extends",
      type: "extends",
      render: renderExtendsBlock,
      x: 2,
      y: 5,
      width: 180,
      height: 50,
      data: { superClass: "Superclass" },
    },
    {
      id: "attr",
      type: "variable",
      render: renderVariableBlock,
      x: 2,
      y: 2,
      width: 360,
      height: 50,
      data: { access: "default", type: "int", name: "x" },
    },
    {
      id: "construct",
      type: "construct",
      render: renderConstructorBlock,
      x: 2,
      y: 2,
      width: 320,
      totalHeight: 120,
      data: { name: "Main", access: "public" },
    },
    {
      id: "method",
      type: "main-method",
      render: renderMainMethodBlock,
      x: 2,
      y: 2,
      width: 260,
      totalHeight: 120,
      data: {},
    },
    {
      id: "custom-method",
      type: "method",
      render: renderMethodBlock,
      x: 2,
      y: 2,
      width: 320,
      totalHeight: 120,
      data: { access: "public", returnType: "void", name: "myMethod" },
    },
    {
      id: "object-caller",
      type: "object-caller",
      render: renderObjectCallerBlock,
      x: 2,
      y: 5,
      data: { objectName: "myObject" },
    },
    {
      id: "method-call",
      type: "method-call",
      render: renderMethodCallBlock,
      x: 10,
      y: 5,
      width: 140,
      height: 50,
      data: { methodName: "runMethod" },
    },
    {
      id: "print",
      type: "print",
      render: renderPrintBlock,
      x: 2,
      y: 5,
      width: 350,
      height: 50,
      data: { value: "Hello, World!" },
    },
    {
      id: "val",
      type: "variable-value",
      render: renderVariableValueBlock,
      x: 2,
      y: 5,
      width: 480,
      height: 50,
      data: { access: "default", type: "int", name: "y", value: "0" },
    },
    {
      id: "param",
      type: "parameter",
      render: renderParameterBlock,
      x: 10,
      y: 5,
      width: 220,
      height: 50,
      data: { type: "int", name: "parameter" },
    },
    {
      id: "arg",
      type: "argument",
      render: renderArgumentBlock,
      x: 10,
      y: 5,
      width: 100,
      height: 50,
      data: { name: "var/value" },
    },
    { id: "this", type: "this", render: renderThisBlock, x: 7, y: 5 },
    { id: "super", type: "super", render: renderSuperBlock, x: 7, y: 5 },
    {
      id: "new-object",
      type: "new-object",
      render: renderNewObjectBlock,
      x: 2,
      y: 5,
      width: 438,
      height: 50,
      data: { classRef: "Main", objName: "myObject", classObj: "Main" },
    },
    {
      id: "if",
      type: "if",
      render: renderControlBlock,
      x: 2,
      y: 2,
      width: 320,
      data: { condition: "x > 5" },
    },
    {
      id: "else-if",
      type: "else-if",
      render: renderControlBlock,
      x: 2,
      y: 2,
      width: 320,
      data: { condition: "x < 0" },
    },
    {
      id: "else",
      type: "else",
      render: renderControlBlock,
      x: 2,
      y: 2,
      width: 320,
      data: {},
    },
    {
      id: "switch",
      type: "switch",
      render: renderControlBlock,
      x: 2,
      y: 2,
      width: 320,
      data: { condition: "opsi" },
    },
    {
      id: "case",
      type: "case",
      render: renderControlBlock,
      x: 2,
      y: 2,
      width: 320,
      data: { condition: "1" },
    },
    {
      id: "for",
      type: "for",
      render: renderForBlock,
      x: 2,
      y: 2,
      width: 400,
      data: { Inisialisasi: "int i=0", Kondisi: "i<5", Update: "i++" },
    },
    {
      id: "while",
      type: "while",
      render: renderControlBlock,
      x: 2,
      y: 2,
      width: 320,
      data: { condition: "i < 10" },
    },
    {
      id: "do-while",
      type: "do-while",
      render: renderControlBlock,
      x: 2,
      y: 2,
      width: 320,
      data: { condition: "i < 10" },
    },
    {
      id: "break",
      type: "break",
      render: renderJumpBlock,
      x: 10,
      y: 5,
      width: 90,
      height: 50,
      data: {},
    },
    {
      id: "continue",
      type: "continue",
      render: renderJumpBlock,
      x: 10,
      y: 5,
      width: 90,
      height: 50,
      data: {},
    },
    { id: "return", type: "return", render: renderReturnBlock, x: 10, y: 5 },

    /* --- FIXED IDs DOWN HERE --- */
    {
      id: "op-value",
      type: "op-value",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      width: 80,
      data: { value: "field" },
    },
    {
      id: "op-add",
      type: "op-add",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      leftWidth: 40,
      rightWidth: 40,
      data: { left: "x", right: "y" },
    },
    {
      id: "op-sub",
      type: "op-sub",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      leftWidth: 40,
      rightWidth: 40,
      data: { left: "x", right: "y" },
    },
    {
      id: "op-multi",
      type: "op-multi",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      leftWidth: 40,
      rightWidth: 40,
      data: { left: "x", right: "y" },
    },
    {
      id: "op-div",
      type: "op-div",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      leftWidth: 40,
      rightWidth: 40,
      data: { left: "x", right: "y" },
    },
    {
      id: "op-mod",
      type: "op-mod",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      leftWidth: 40,
      rightWidth: 40,
      data: { left: "x", right: "y" },
    },
    {
      id: "op-assign",
      type: "op-assign",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      leftWidth: 40,
      rightWidth: 40,
      data: { left: "x", right: "10" },
    },
    {
      id: "op-inc",
      type: "op-inc",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      width: 80,
      data: { value: "x" },
    },
    {
      id: "op-dec",
      type: "op-dec",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      width: 80,
      data: { value: "x" },
    },
    {
      id: "op-less",
      type: "op-less",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      leftWidth: 40,
      rightWidth: 40,
      data: { left: "x", right: "10" },
    },
    {
      id: "op-greater",
      type: "op-greater",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      leftWidth: 40,
      rightWidth: 40,
      data: { left: "x", right: "10" },
    },
    {
      id: "op-less-eq",
      type: "op-less-eq",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      leftWidth: 40,
      rightWidth: 40,
      data: { left: "x", right: "10" },
    },
    {
      id: "op-greater-eq",
      type: "op-greater-eq",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      leftWidth: 40,
      rightWidth: 40,
      data: { left: "x", right: "10" },
    },
    {
      id: "op-equals",
      type: "op-equals",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      leftWidth: 40,
      rightWidth: 40,
      data: { left: "x", right: "y" },
    },
    {
      id: "op-not-equals",
      type: "op-not-equals",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      leftWidth: 40,
      rightWidth: 40,
      data: { left: "x", right: "y" },
    },
    {
      id: "op-and",
      type: "op-and",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      leftWidth: 50,
      rightWidth: 50,
      data: {},
    },
    {
      id: "op-or",
      type: "op-or",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      leftWidth: 50,
      rightWidth: 50,
      data: {},
    },
    {
      id: "op-not",
      type: "op-not",
      render: renderOperatorBlock,
      x: 2,
      y: 5,
      width: 88,
      data: { value: "true" },
    },
    {
      id: "interface",
      type: "interface",
      render: renderInterfaceBlock,
      x: 2,
      y: 2,
      width: 320,
      totalHeight: 120,
      data: { name: "MyInterface" },
    },
    {
      id: "implements",
      type: "implements",
      render: renderImplementsBlock,
      x: 2,
      y: 5,
      width: 180,
      height: 50,
      data: { interfaces: "MyInterface" },
    },
    {
      id: "interface-method",
      type: "interface-method",
      render: renderInterfaceMethodBlock,
      x: 2,
      y: 2,
      width: 320,
      height: 50,
      data: { access: "default", returnType: "void", name: "myMethod" },
    },
    {
      id: "prop-assign",
      type: "prop-assign",
      render: renderPropAssignBlock,
      x: 2,
      y: 5,
      width: 230,
      height: 50,
      data: { name: "x", value: "10" },
    },
    {
      id: "op-input",
      type: "op-input",
      render: renderInputPill,
      x: 2,
      y: 5,
      width: 145,
      data: { type: "String" },
    },
  ];

  paletteConfig.forEach((config) => {
    const svgElement = document.getElementById(`thumb-${config.id}-svg`);
    if (svgElement) {
      const isBumpBlock =
        config.type === "extends" ||
        config.type === "implements" ||
        config.type === "parameter" ||
        config.type === "argument";

      const blockData = {
        id: `thumb-${config.id}`,
        type: config.type,
        x: isBumpBlock ? 9 : 2, // Push it right so the left bump fits
        y: 4,
        children: [],
      };

      if (config.data) blockData.data = config.data;

      // 1. Compute baseline layout
      computeLayout(blockData);

      // ... [Keep your existing OVERRIDE logic for Binary Operators here] ...
      if (config.type.startsWith("op-") && blockData.leftWidth !== undefined) {
        const isBooleanOp = [
          "op-less",
          "op-greater",
          "op-less-eq",
          "op-greater-eq",
          "op-equals",
          "op-not-equals",
          "op-and",
          "op-or",
          "op-not",
        ].includes(blockData.type);

        // Make Hexagons wider (210px) so the inputs don't crash into the sharp points!
        blockData.width = isBooleanOp ? 184 : 174;

        // Match the massive padding we set in computeLayout
        const symbolPadding = [
          "op-less-eq",
          "op-greater-eq",
          "op-equals",
          "op-not-equals",
          "op-and",
          "op-or",
        ].includes(blockData.type)
          ? 80
          : 70;

        const inputW = (blockData.width - symbolPadding) / 2;
        blockData.leftWidth = inputW;
        blockData.rightWidth = inputW;
      }

      // 2. RENDER FIRST! This allows the renderer to finalize blockData.width
      config.render(blockData, svgElement);

      // 3. SET VIEWBOX SECOND based on the true rendered dimensions
      const finalW = blockData.width || 160;
      const finalH = blockData.totalHeight || blockData.height || 40;

      // Add the starting X coordinate to the viewBox width so the right side never clips
      const viewBoxW = Math.max(finalW + blockData.x + 6, 179.2);
      const viewBoxH = finalH + 14;

      svgElement.setAttribute("viewBox", `0 0 ${viewBoxW} ${viewBoxH}`);
      svgElement.style.width = "100%";
      svgElement.style.height = "auto";
      svgElement.style.maxHeight = "84px";
      svgElement.style.display = "block";
      svgElement.setAttribute(
        "preserveAspectRatio",
        "xMinYMin meet",
        "Overflow visible",
      );

      config.render(blockData, svgElement);
    }
  });
}

document.getElementById("btn-add-tab").onclick = () => {
  const newId = Date.now();
  workspaces.push({
    id: newId,
    name: `Workspace ${workspaces.length + 1}`,
    blocks: [],
    camera: { x: 0, y: 0, zoom: 1 },
    code: "",
    history: ["[]"],
    historyIndex: 0,
  });
  switchTab(newId);
};

// --- COMPLEX POPOVER INTERACTION STATE ---
let activeGenerationError = null;
let activeErrorLineNum = null;
let popoverMode = "hidden"; // "initial", "hover", "hidden"

window.clearErrorState = function () {
  const oldHighlight = document.getElementById("error-highlight");
  if (oldHighlight) oldHighlight.remove();

  document.querySelectorAll(".block-error-shadow").forEach((el) => {
    el.classList.remove("block-error-shadow");
  });

  hideErrorPopover();
  activeGenerationError = null;
  activeErrorLineNum = null;
  popoverMode = "hidden";
};

document.getElementById("btn-generate").onclick = () => {
  window.isCodeGeneratedAndReady = true;
  const ws = getActiveWorkspace();
  const codeOutput = document.getElementById("code-output");
  const codePre = document.getElementById("code-pre");

  try {
    const result = generateJavaCode(ws.blocks);
    const code = result.code;

    ws.code = code;
    codeOutput.textContent = code;
    codeOutput.style.color = "";
    if (window.Prism) Prism.highlightElement(codeOutput);

    window.clearErrorState();

    if (result.error) {
      const lines = code.split("\n");
      let lineIdx = -1;

      const isDuplicate =
        result.error.title.includes("Duplikasi") ||
        result.error.title.includes("Duplikat");
      const isOrphan = result.error.title.includes("Struktur Logika");

      if (isDuplicate || isOrphan) {
        const matches = [];
        lines.forEach((l, i) => {
          if (l.includes(result.error.searchString)) matches.push(i);
        });

        lineIdx = matches.length > 0 ? matches[matches.length - 1] : 0;
      } else {
        lineIdx = lines.findIndex((l) => l.includes(result.error.searchString));
        if (lineIdx === -1) lineIdx = 0;
      }

      const lineNum = lineIdx + 1;

      activeGenerationError = result.error;
      activeErrorLineNum = lineNum;

      const highlight = document.createElement("div");
      highlight.id = "error-highlight";
      highlight.style.top = `calc(15px + ${lineIdx * 21}px)`;

      highlight.style.width = `max(calc(100% + 50px), ${codePre.scrollWidth}px)`;
      codePre.appendChild(highlight);

      codePre.scrollTo({
        top: lineIdx * 21 - codePre.clientHeight / 2 + 15,
        behavior: "smooth",
      });

      popoverMode = "initial";
      showErrorPopover(result.error, lineNum, codePre);

      if (result.error.blockId) {
        const errorBlockSvg =
          document.getElementById(result.error.blockId) ||
          document.querySelector(`[data-id="${result.error.blockId}"]`);

        if (errorBlockSvg) {
          errorBlockSvg.classList.add("block-error-shadow");
        }
      }
    }
  } catch (error) {
    if (error.isCustomError) {
      showCustomAlert(error.title, error.message, error.detail, error.hint);
    } else {
      showCustomAlert(
        "Terjadi Kesalahan",
        error.message || "Kesalahan tidak dikenal.",
        "",
        "Silakan periksa blok Anda.",
      );
    }
    codeOutput.textContent =
      "// ERROR KONVERSI KODE\n// " + (error.message || error);
    codeOutput.style.color = "#ff4d4f";
  }
};

// --- HELPER TO COUNT INPUT BLOCKS ---
function countInputBlocks(blocks) {
  let count = 0;
  blocks.forEach((b) => {
    if (b.type === "op-input") count++;
    if (b.children) count += countInputBlocks(b.children);
  });
  return count;
}

// --- CODE RUNNER (SERVERLESS PROXY WITH VERCEL) ---
// --- HELPER TO CHECK FOR INPUT BLOCKS ---
function hasInputBlock(nodes) {
  if (!nodes) return false;
  for (const node of nodes) {
    if (node.type === "op-input") return true;
    if (node.children && hasInputBlock(node.children)) return true;
  }
  return false;
}

// --- CODE RUNNER & TERMINAL SIMULATOR ---
const btnRun = document.getElementById("btn-run");
if (btnRun) {
  btnRun.onclick = async () => {
    if (!window.isCodeGeneratedAndReady) {
      showCustomAlert(
        t("alert_run_need_convert_title"),
        t("alert_run_need_convert_msg"),
        t("alert_run_need_convert_detail"),
        "", // hint (left blank)
      );
      return;
    }

    const ws = getActiveWorkspace();

    const terminalOverlay = document.getElementById("terminal-overlay");
    const terminalContent = document.getElementById("terminal-content");
    // ... rest of your existing terminal logic ...
    terminalOverlay.classList.add("show");
    terminalContent.innerHTML = "";

    function printToTerminal(text) {
      if (!text) return;
      const lines = text.replace(/\r\n/g, "\n").split("\n");

      lines.forEach((line) => {
        const div = document.createElement("div");
        div.className = "term-line";

        div.textContent = line === "" ? "\u00A0" : line;

        terminalContent.appendChild(div);
      });
      terminalContent.scrollTop = terminalContent.scrollHeight;
    }

    let resolveTerminal = null;
    function askTerminalInput(promptData, fallbackFlag = false) {
      return new Promise((resolve) => {
        resolveTerminal = resolve;

        // --- 1. BULLETPROOF EXTRACTION ---
        // If an object gets passed in by mistake, safely unpack it!
        let textToPrint = "";
        let isFallback = fallbackFlag;

        if (typeof promptData === "object" && promptData !== null) {
          textToPrint = promptData.text || "";
          isFallback = promptData.isFallback || false;
        } else if (promptData) {
          textToPrint = String(promptData);
        }

        // --- 2. SAFE PRINTING ---
        if (textToPrint) {
          textToPrint = textToPrint.replace(/\\n/g, "\n").replace(/\\t/g, "\t");

          const lines = textToPrint.split("\n");
          lines.forEach((line) => {
            const div = document.createElement("div");
            div.className = isFallback
              ? "term-line system-fallback"
              : "term-line";
            div.textContent = line;
            terminalContent.appendChild(div);
          });
          terminalContent.scrollTop = terminalContent.scrollHeight;
        }

        const div = document.createElement("div");
        div.className = "term-input-line";
        const input = document.createElement("input");
        input.type = "text";
        div.appendChild(input);
        terminalContent.appendChild(div);

        setTimeout(() => input.focus(), 100);
        terminalContent.onclick = () => input.focus();

        input.onkeydown = (e) => {
          if (e.key === "Enter") {
            input.disabled = true;
            terminalContent.onclick = null;
            resolveTerminal = null;
            resolve(input.value);
          }
        };
      });
    }

    const originalIcon = btnRun.innerHTML;

    document.getElementById("terminal-close").onclick = () => {
      terminalOverlay.classList.remove("show");
      if (resolveTerminal) {
        resolveTerminal(null);
        btnRun.innerHTML = originalIcon;
        btnRun.disabled = false;
      }
    };

    // 1. Scan blocks and gather inputs interactively BEFORE hitting the API
    let prompts = [];
    let accumulatedPrints = [];

    function findInputs(nodes) {
      if (!nodes) return;
      for (const node of nodes) {
        // Prevent cross-contamination
        // Clear memory when entering a new class or method structural block
        if (
          ["class", "interface", "method", "main-method", "construct"].includes(
            node.type,
          )
        ) {
          accumulatedPrints = [];
        }

        if (node.type === "print") {
          let text = node.data.value || "";
          let cleanText = text.replace(/^"|"$/g, "").replace(/\\"/g, '"');
          if (cleanText.includes(" + ")) {
            cleanText =
              cleanText.split(" + ")[0].replace(/"/g, "").trim() + "...";
          }
          accumulatedPrints.push(cleanText);
        }

        if (node.type === "op-input") {
          let isFallback = accumulatedPrints.length === 0;
          let finalPrompt = !isFallback ? accumulatedPrints.join("\n") : "";

          prompts.push({ text: finalPrompt, isFallback: isFallback });
          accumulatedPrints = [];
        }

        if (node.children) findInputs(node.children);
      }
    }
    findInputs(ws.blocks);

    // 2. Ask user for all required inputs sequentially
    let stdInputs = [];
    if (prompts.length > 0) {
      for (let i = 0; i < prompts.length; i++) {
        let ans = await askTerminalInput(
          prompts[i].text,
          prompts[i].isFallback,
        );

        if (ans === null) return;
        stdInputs.push(ans);
      }
    }

    const finalStdin = stdInputs.length > 0 ? stdInputs.join("\n") + "\n" : "";

    // 3. Show loading animation in Terminal
    const runningDiv = document.createElement("div");
    runningDiv.className = "term-line";
    runningDiv.style.color = "#aaa";
    runningDiv.textContent = "Running...";
    terminalContent.appendChild(runningDiv);
    terminalContent.scrollTop = terminalContent.scrollHeight;

    const spinnerSVG = `
      <svg class="spinner-icon" width="20" height="20" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 2a2 2 0 1 1 4 0v6a2 2 0 1 1-4 0z" fill="currentColor"/>
        <path opacity=".87" d="M4.394 7.222a2 2 0 1 1 2.829-2.829l4.242 4.243a2 2 0 1 1-2.828 2.829z" fill="currentColor"/>
        <path opacity=".75" d="M2 17a2 2 0 1 1 0-4h6a2 2 0 1 1 0 4z" fill="currentColor"/>
        <path opacity=".63" d="M7.223 25.607a2 2 0 0 1-2.829-2.829l4.243-4.242a2 2 0 1 1 2.828 2.828z" fill="currentColor"/>
        <path opacity=".51" d="M17 28a2 2 0 1 1-4 0v-6a2 2 0 1 1 4 0z" fill="currentColor"/>
        <path opacity=".39" d="M25.606 22.778a2 2 0 0 1-2.828 2.829l-4.243-4.243a2 2 0 0 1 2.828-2.829z" fill="currentColor"/>
        <path opacity=".27" d="M28 13a2 2 0 1 1 0 4h-6a2 2 0 1 1 0-4z" fill="currentColor"/>
        <path opacity=".15" d="M22.778 4.393a2 2 0 0 1 2.828 2.829l-4.243 4.242a2 2 0 0 1-2.828-2.828z" fill="currentColor"/>
      </svg>
    `;

    btnRun.innerHTML = spinnerSVG;
    btnRun.disabled = true;

    // 4. SCall the external compiler API

    // GENERATE FRESH EXECUTION CODE HERE
    const executionResult = generateJavaCode(ws.blocks, true);

    const payload = {
      code: executionResult.code,
      compiler: "openjdk-25",
      stdin: finalStdin,
      input: finalStdin,
    };

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      btnRun.innerHTML = originalIcon;
      btnRun.disabled = false;

      // REMOVE "Running..." text smoothly
      if (runningDiv.parentNode) {
        runningDiv.parentNode.removeChild(runningDiv);
      }

      // DO NOT clear terminal content here so the prompt history stays!

      if (response.ok) {
        let finalOutput = "";

        if (data.error && data.error.trim().length > 0) {
          finalOutput += `[Status Eksekusi]: ${data.error.trim()}\n`;
        }
        if (data.stderr && data.stderr.trim().length > 0) {
          finalOutput += `[Error Log]:\n${data.stderr.trim()}\n`;
        }

        if (data.output !== undefined && data.output !== null) {
          let cleanOutput = data.output;

          // Strip out the prompt strings line-by-line
          prompts.forEach((promptObj) => {
            if (!promptObj.isFallback && promptObj.text) {
              const lines = promptObj.text.split("\n");

              lines.forEach((line) => {
                let originalText = line.replace("...", "").trim();
                if (originalText) {
                  const regex = new RegExp(
                    originalText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
                      "\\s*\\n?",
                    "",
                  );
                  cleanOutput = cleanOutput.replace(regex, "");
                }
              });
            }
          });

          finalOutput += cleanOutput;
        }

        // If the entire output is literally empty or just pure whitespace, print default
        if (finalOutput.trim() === "") {
          printToTerminal("Program selesai tanpa output.");
        } else {
          // console doesn't look weirdly padded at the bottom, but KEEP everything else!
          if (finalOutput.endsWith("\n")) {
            finalOutput = finalOutput.slice(0, -1);
          }
          printToTerminal(finalOutput);
        }
      } else {
        printToTerminal(
          `[Error Server] ${data.message || "Status " + response.status}`,
        );
      }
    } catch (error) {
      btnRun.innerHTML = originalIcon;
      btnRun.disabled = false;
      if (runningDiv.parentNode) runningDiv.parentNode.removeChild(runningDiv);
      printToTerminal(
        `[Error Jaringan] Tidak dapat terhubung ke server eksekusi.\n${error.message}`,
      );
    }
  };
}

const codePre = document.getElementById("code-pre");

// 1. Dismiss on outside click (only during 'initial' mode)
document.addEventListener("click", (e) => {
  // PREVENT instant disappearance when the generate button's click bubbles up
  if (e.target.closest("#btn-generate")) return;

  if (popoverMode === "initial") {
    const wrapper = document.getElementById("error-popover-wrapper");
    if (wrapper && !wrapper.contains(e.target)) {
      popoverMode = "hidden";
      hideErrorPopover();
    }
  }
});

// 2. Track Mouse Leave / Mouse Hover
document.addEventListener("mousemove", (event) => {
  if (!activeGenerationError) return;

  const highlight = document.getElementById("error-highlight");
  const wrapper = document.getElementById("error-popover-wrapper");

  // Check if mouse is over highlight
  let isOverHighlight = false;
  if (highlight) {
    const rect = highlight.getBoundingClientRect();
    isOverHighlight =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
  }

  // Check if mouse is over popover itself (allows user to move mouse into it to read)
  let isOverPopover = false;
  if (wrapper && !wrapper.classList.contains("fading-out")) {
    const pRect = wrapper.getBoundingClientRect();
    isOverPopover =
      event.clientX >= pRect.left &&
      event.clientX <= pRect.right &&
      event.clientY >= pRect.top &&
      event.clientY <= pRect.bottom;
  }

  if (popoverMode === "hidden" && isOverHighlight) {
    // FADE IN
    popoverMode = "hover";
    showErrorPopover(activeGenerationError, activeErrorLineNum, codePre);
  } else if (popoverMode === "hover" && !isOverHighlight && !isOverPopover) {
    // FADE OUT
    popoverMode = "hidden";
    hideErrorPopover();
  }
});

// --- SMART AUTOSAVE ON EXIT / REFRESH ---
// This guarantees no work is lost if the user abruptly closes the tab or refreshes
const performSmartSave = () => {
  const ws = getActiveWorkspace();
  if (ws) {
    // 1. Force save the exact tab they were currently looking at
    localStorage.setItem("oopify_active_tab", ws.id);
  }
  // 2. Force save all blocks and workspaces
  if (typeof saveState === "function") {
    saveState();
  }
};

// Catch page refreshes and standard tab closes
window.addEventListener("beforeunload", performSmartSave);

// Modern browsers recommend visibilitychange as the most reliable way
// to catch when a user closes the app on mobile or desktop
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    performSmartSave();
  }
});

setupThemeToggle();
setupAppMenu();
setupAppMenuActions();
setupFullscreenToggle();
setupDragListeners();
initPalette();
setupPedagogyTooltips();
setupUndoRedo();
setupTutorialModal();
setupBeforeUnloadAlert();
setupModifierDropdown();
setupContextMenu();
loadFromAutoSave();
renderTabs();
render();

// Automatically save state anytime an input field loses focus or select changes
document
  .getElementById("workspace-container")
  .addEventListener("change", () => {
    saveState();
  });

saveState(); // Capture the very first blank canvas state

// ============================================================
// ACTIVITY LOGGER — Hook into existing events via interceptors
// NO existing logic is modified. Only wrapping/observing.
// ============================================================

// Start a logging session
startSession();

// --- 1. BLOCK SPAWN: Intercept window.startSpawn ---
const _originalStartSpawn = window.startSpawn;
window.startSpawn = function (evt, type) {
  _originalStartSpawn(evt, type);
  logEvent("BLOCK_SPAWNED", { blockType: type });
};

// --- 2. BLOCK EDITED (textbox) + MODIFIER CHANGED (dropdown): Intercept handlePillInput ---
const _originalHandlePillInput = window.handlePillInput;
let _editDebounceTimer = null;
let _lastEditKey = "";
window.handlePillInput = function (element, blockId, prop) {
  _originalHandlePillInput(element, blockId, prop);
  // Debounce: only log once per field per 500ms to avoid per-keystroke spam
  const editKey = `${blockId}-${prop}`;
  if (_lastEditKey !== editKey) {
    _lastEditKey = editKey;
    clearTimeout(_editDebounceTimer);
    _editDebounceTimer = setTimeout(() => {
      const ws = getActiveWorkspace();
      const result = ws ? findBlockAndParent(ws.blocks, blockId) : null;
      const blockType = result && result.block ? result.block.type : "unknown";
      const isModifier = ["access", "type", "returnType", "static", "final", "abstract"].includes(prop);
      logEvent(isModifier ? "MODIFIER_CHANGED" : "BLOCK_EDITED", {
        blockType: blockType,
        blockId: blockId,
        field: prop,
        newValue: element.value,
      });
      _lastEditKey = "";
    }, 500);
  } else {
    clearTimeout(_editDebounceTimer);
    _editDebounceTimer = setTimeout(() => {
      const ws = getActiveWorkspace();
      const result = ws ? findBlockAndParent(ws.blocks, blockId) : null;
      const blockType = result && result.block ? result.block.type : "unknown";
      const isModifier = ["access", "type", "returnType", "static", "final", "abstract"].includes(prop);
      logEvent(isModifier ? "MODIFIER_CHANGED" : "BLOCK_EDITED", {
        blockType: blockType,
        blockId: blockId,
        field: prop,
        newValue: element.value,
      });
      _lastEditKey = "";
    }, 500);
  }
};

// --- 3. BLOCK DROP / DELETE / DETACH: Intercept mouseup on workspace ---
// We listen to the same mouseup event AFTER the existing handler runs.
// Track spawned blocks to detect drop vs delete.
let _lastSpawnedType = null;
const _origStartSpawn2 = window.startSpawn;
window.startSpawn = function (evt, type) {
  _lastSpawnedType = type;
  _origStartSpawn2(evt, type);
};

const _origStartDrag = window.startDrag;
window.startDrag = function (evt, blockId, parentId) {
  // Log detach if block was inside a parent
  if (parentId && parentId !== "null") {
    const ws = getActiveWorkspace();
    const result = ws ? findBlockAndParent(ws.blocks, blockId) : null;
    const blockType = result && result.block ? result.block.type : "unknown";
    logEvent("BLOCK_DETACHED", {
      blockType: blockType,
      blockId: blockId,
      fromContainer: parentId,
    });
  }
  _origStartDrag(evt, blockId, parentId);
};

// --- 4. BLOCK DELETE (trash zone): Observe via MutationObserver on block count ---
let _prevBlockCount = getActiveWorkspace()?.blocks?.length || 0;
const _origSaveState = saveState;
// We hook into saveState which is called after every drop/delete
// Check block count delta to detect deletions
window.addEventListener("mouseup", () => {
  setTimeout(() => {
    const ws = getActiveWorkspace();
    if (!ws) return;
    const currentCount = ws.blocks.length;
    if (currentCount < _prevBlockCount) {
      logEvent("BLOCK_DELETED", {
        blocksRemoved: _prevBlockCount - currentCount,
        totalBlocksRemaining: currentCount,
      });
    } else if (_lastSpawnedType && currentCount <= _prevBlockCount) {
      // Block was spawned but ended up in a container (count didn't increase at root)
      logEvent("BLOCK_DROPPED", {
        blockType: _lastSpawnedType,
        totalBlocksOnWorkspace: currentCount,
      });
    }
    _prevBlockCount = currentCount;
    _lastSpawnedType = null;
  }, 50);
});

// --- 5. UNDO / REDO: Intercept via button click + keyboard ---
const _btnUndo = document.getElementById("btn-undo");
const _btnRedo = document.getElementById("btn-redo");
if (_btnUndo) {
  _btnUndo.addEventListener("click", () => logEvent("UNDO"), true);
}
if (_btnRedo) {
  _btnRedo.addEventListener("click", () => logEvent("REDO"), true);
}
// Also catch keyboard undo/redo
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
    logEvent("UNDO");
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
    logEvent("REDO");
  }
}, true);

// --- 6. CODE GENERATED: Intercept btn-generate ---
const _btnGenerate = document.getElementById("btn-generate");
if (_btnGenerate) {
  _btnGenerate.addEventListener("click", () => {
    // Defer to let the original handler run first
    setTimeout(() => {
      const ws = getActiveWorkspace();
      const hasError = !!document.getElementById("error-highlight");
      logEvent("CODE_GENERATED", {
        hasError: hasError,
        codeLength: (ws?.code || "").length,
      });
    }, 100);
  }, true);
}

// --- 7. CODE RUN: Intercept btn-run ---
const _btnRunLog = document.getElementById("btn-run");
if (_btnRunLog) {
  _btnRunLog.addEventListener("click", () => {
    if (window.isCodeGeneratedAndReady) {
      logEvent("CODE_RUN");
    }
  }, true);
}

// --- 8. SELECT/DROPDOWN CHANGE (modifier, datatype): Observe via change event ---
document.getElementById("workspace-container")?.addEventListener("change", (e) => {
  const target = e.target;
  if (target.tagName === "SELECT") {
    const blockGroup = target.closest("g[data-id]");
    const blockId = blockGroup ? blockGroup.getAttribute("data-id") : "unknown";
    const ws = getActiveWorkspace();
    const result = ws ? findBlockAndParent(ws.blocks, blockId) : null;
    const blockType = result && result.block ? result.block.type : "unknown";
    logEvent("MODIFIER_CHANGED", {
      blockType: blockType,
      blockId: blockId,
      field: target.getAttribute("data-prop") || target.name || "dropdown",
      newValue: target.value,
    });
  }
}, true);

// --- EXPOSE LOG FUNCTIONS TO WINDOW (for Log Panel UI) ---
window._logGetEntries = getEntries;
window._logGetCount = getEntryCount;
window._logExportJSON = exportJSON;
window._logDownload = downloadLog;
window._logClear = clearLog;
window._logEvent = logEvent;
