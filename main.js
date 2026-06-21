import {
  updateBlockData,
  workspaces,
  getActiveWorkspace,
  saveState,
  loadFromAutoSave,
} from "./state.js";
import {
  renderTabs,
  switchTab,
  closeTab,
  switchCategory,
  copyCode,
  setupThemeToggle,
  setupFullscreenToggle,
  setupUndoRedo,
  setupModifierDropdown,
  setupAppMenu,
  setupAppMenuActions,
  setupGlobalActions,
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
import { activityLogger } from "./activityLogger.js";

window.updateBlockData = updateBlockData;
window.startDrag = startDrag;
window.startSpawn = startSpawn;

// ── Wrap updateBlockData to intercept input/dropdown changes for logging ──────
// The original updateBlockData is preserved; we only observe what it receives.
window.updateBlockData = function (id, key, value) {
  // Get old value before update (for logging)
  const ws = getActiveWorkspace ? getActiveWorkspace() : null;
  let oldValue;
  if (ws) {
    const { findBlockAndParent } = window._stateHelpers || {};
    // We don't expose findBlockAndParent, so just skip oldValue tracking
    oldValue = undefined;
  }

  // Call original function
  updateBlockData(id, key, value);

  // Determine event type: access/modifier fields = MODIFIER_CHANGED, else BLOCK_EDITED
  const modifierFields = ["access", "type", "returnType", "superClass", "interfaces", "classRef", "classObj"];
  const eventName = modifierFields.includes(key) ? "MODIFIER_CHANGED" : "BLOCK_EDITED";

  activityLogger.logEvent(eventName, {
    blockId: id,
    field: key,
    newValue: value,
  });
};
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
document.getElementById("btn-generate").onclick = () => {
  window.isCodeGeneratedAndReady = true;
  const ws = getActiveWorkspace();
  const codeOutput = document.getElementById("code-output");

  let hasError = false;
  try {
    // Generate the code, completely ignoring any block errors or orphans
    const result = generateJavaCode(ws.blocks);
    const code = result.code;

    ws.code = code;
    codeOutput.textContent = code;
    codeOutput.style.color = ""; // Reset text color

    if (window.Prism) Prism.highlightElement(codeOutput);
  } catch (error) {
    // This will only trigger if the compiler itself catastrophically crashes,
    // not for user logic errors.
    hasError = true;
    console.error(error);
    codeOutput.textContent =
      "// FATAL COMPILER ERROR\n// " + (error.message || error);
    codeOutput.style.color = "#ff4d4f";
  }
  // [LOG] Code generation event
  activityLogger.logEvent("CODE_GENERATED", { hasError });
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
      alert(
        `${t("alert_run_need_convert_title")}\n${t("alert_run_need_convert_msg")}`,
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

    // 4. Call the compiler via Vercel Serverless Function
    // ── api/run.js meneruskan request ke Piston API ───────────
    // Untuk ganti compiler: ubah logika di api/run.js saja,
    // tidak perlu ubah kode frontend ini.
    // ─────────────────────────────────────────────────────────
    const URL_COMPILER = "/api/run";

    // GENERATE FRESH EXECUTION CODE HERE
    const executionResult = generateJavaCode(ws.blocks, true);

    // Adapter: normalisasi response ke format { output, stderr, error }
    // api/run.js sudah return format ini langsung, adapter ini sebagai safety net
    function normalizePistonResponse(data) {
      // api/run.js sudah return { output, stderr, error } langsung
      if (data.output !== undefined) return data;
      // fallback jika response masih format Piston mentah
      const run = data.run || {};
      return {
        output: run.stdout || "",
        stderr: run.stderr || "",
        error: run.code !== 0 ? `Exit code ${run.code}` : "",
      };
    }

    // Java mengharuskan filename = nama public class
    // Ekstrak nama class pertama dari kode yang di-generate
    const classNameMatch = executionResult.code.match(/public\s+class\s+(\w+)/);
    const javaFileName = classNameMatch ? `${classNameMatch[1]}.java` : "Main.java";

    const pistonPayload = {
      files: [{ name: javaFileName, content: executionResult.code }],

      stdin: finalStdin,
    };

    try {
      const response = await fetch(URL_COMPILER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pistonPayload),
      });

      const raw = await response.json();
      const data = normalizePistonResponse(raw);

      btnRun.innerHTML = originalIcon;
      btnRun.disabled = false;

      // Log CODE_RUN event
      if (window.activityLogger) {
        window.activityLogger.logEvent("CODE_RUN", {
          exitCode: raw.run?.code ?? (raw.error ? 1 : 0),
          hasStderr: !!(raw.stderr?.trim() || raw.run?.stderr?.trim()),
        });
      }

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
setupUndoRedo();
setupTutorialModal();
setupModifierDropdown();
setupGlobalActions();
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

// ── Initialize Activity Logger & Register Drag Callbacks ──────────────────────
activityLogger.init();

// ── Wrap window.applyModifier for dropdown/modifier logging ───────────────────
// applyModifier is set by setupModifierDropdown() in ui.js.
// It bypasses updateBlockData, so we must wrap it here separately.
const _origApplyModifier = window.applyModifier;
window.applyModifier = function (blockId, key, val, closeAfter) {
  // Call original first
  _origApplyModifier(blockId, key, val, closeAfter);
  // Then log
  activityLogger.logEvent("MODIFIER_CHANGED", {
    blockId,
    field: key,
    newValue: val,
  });
};

// Callbacks from dragDrop.js hooks (set here, after setupDragListeners runs)
window.onAfterSpawn = (block) => {
  activityLogger.logEvent("BLOCK_SPAWNED", {
    blockId: block.id,
    blockType: block.type,
  });
};

window.onAfterDetach = (block, fromParent) => {
  activityLogger.logEvent("BLOCK_DETACHED", {
    blockId: block.id,
    blockType: block.type,
    fromContainer: fromParent ? fromParent.type : null,
    fromContainerName: fromParent?.data?.name,
  });
};

window.onAfterDelete = (block) => {
  activityLogger.logEvent("BLOCK_DELETED", {
    blockId: block.id,
    blockType: block.type,
    blockName: block.data?.name,
  });
};

window.onAfterDrop = (block, drop) => {
  if (drop) {
    // Dropped into a container (nested)
    activityLogger.logEvent("BLOCK_DROPPED", {
      blockId: block.id,
      blockType: block.type,
      targetContainer: drop.container.type,
      targetContainerName: drop.container.data?.name,
      dropIndex: drop.index,
    });
  } else {
    // Dropped freely on canvas (already moved, no nesting)
    activityLogger.logEvent("BLOCK_DROPPED", {
      blockId: block.id,
      blockType: block.type,
      targetContainer: null,
    });
  }
};

// Hook undo/redo via button & keyboard (undo/redo not exposed to window)
document.getElementById("btn-undo")?.addEventListener("click", () => {
  activityLogger.logEvent("UNDO", {});
}, { capture: false });
document.getElementById("btn-redo")?.addEventListener("click", () => {
  activityLogger.logEvent("REDO", {});
}, { capture: false });
// Also hook Ctrl+Z / Ctrl+Y keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  if (e.ctrlKey && e.key === "z") activityLogger.logEvent("UNDO", {});
  if (e.ctrlKey && (e.key === "y" || e.key === "Z")) activityLogger.logEvent("REDO", {});
});
