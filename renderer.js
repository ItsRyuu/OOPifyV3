import { dragInfo, getActiveWorkspace, findBlockAndParent } from "./state.js";
import { t } from "./language.js";

window.handlePillInput = function (element, blockId, prop) {
  const newVal = element.value;
  const ws = getActiveWorkspace();
  if (!ws) return;

  const result = findBlockAndParent(ws.blocks, blockId);
  if (result && result.block) {
    if (
      typeof window.activeEditOldVal === "undefined" ||
      window.activeEditBlockId !== blockId
    ) {
      window.activeEditOldVal = result.block.data[prop] || "";
      window.activeEditBlockId = blockId;
    }

    if (!result.block.data) result.block.data = {};
    result.block.data[prop] = newVal;
  }
  if (window.updateBlockData) window.updateBlockData(blockId, prop, newVal);

  window.activeFocus = {
    id: blockId,
    prop: prop,
    pos: element.selectionStart,
  };

  window.isRenderingInput = true;
  if (window.renderWorkspace) window.renderWorkspace();
  else if (typeof render === "function") render();
  window.isRenderingInput = false;
};

window.handleNameCommit = function (oldVal, newVal, blockId) {
  const ws = getActiveWorkspace();

  if (ws && oldVal !== undefined && oldVal !== null && oldVal !== newVal) {
    const result = findBlockAndParent(ws.blocks, blockId);
    if (
      result &&
      result.block &&
      (result.block.type === "class" || result.block.type === "interface")
    ) {
      const cascadeRename = (blocks) => {
        blocks.forEach((b) => {
          if (b.type === "extends" && b.data.superClass === oldVal)
            b.data.superClass = newVal;
          if (b.type === "implements" && b.data.interfaces === oldVal)
            b.data.interfaces = newVal;
          if (b.type === "new-object") {
            if (b.data.classRef === oldVal) b.data.classRef = newVal;
            if (b.data.classObj === oldVal) b.data.classObj = newVal;
          }

          if (
            b.type === "extends" &&
            (!b.data.superClass ||
              b.data.superClass === "Object" ||
              b.data.superClass === "Superclass" ||
              b.data.superClass === "Interface")
          ) {
            const parentRes = findBlockAndParent(ws.blocks, b.id);
            if (
              parentRes &&
              parentRes.parent &&
              parentRes.parent.id !== blockId
            ) {
              const isParentInterface = parentRes.parent.type === "interface";
              if (isParentInterface && result.block.type === "interface")
                b.data.superClass = newVal;
              else if (!isParentInterface && result.block.type === "class")
                b.data.superClass = newVal;
            }
          }

          if (
            b.type === "implements" &&
            (!b.data.interfaces || b.data.interfaces === "Interface")
          ) {
            const parentRes = findBlockAndParent(ws.blocks, b.id);
            if (
              parentRes &&
              parentRes.parent &&
              parentRes.parent.id !== blockId
            ) {
              if (result.block.type === "interface") b.data.interfaces = newVal;
            }
          }

          if (b.type === "new-object") {
            if (
              !b.data.classRef ||
              b.data.classRef === "Object" ||
              b.data.classRef === "Main"
            ) {
              b.data.classRef = newVal;
            }
            if (
              !b.data.classObj ||
              b.data.classObj === "Object" ||
              b.data.classObj === "Main"
            ) {
              if (result.block.type === "class") b.data.classObj = newVal;
            }
          }

          if (b.children) cascadeRename(b.children);
        });
      };
      cascadeRename(ws.blocks);
      if (window.renderWorkspace) window.renderWorkspace();
      else if (typeof render === "function") render();
    }
  }
};

window.cascadeDeleteBlueprint = function (deletedName) {
  const ws = getActiveWorkspace();
  if (!ws || !deletedName) return;

  const cascadeDelete = (blocks) => {
    blocks.forEach((b) => {
      // 1. Reset Extends
      if (b.type === "extends" && b.data.superClass === deletedName) {
        const result = findBlockAndParent(ws.blocks, b.id);
        b.data.superClass =
          result && result.parent && result.parent.type === "interface"
            ? "Interface"
            : "Object";
      }
      // 2. Reset Implements
      if (b.type === "implements" && b.data.interfaces === deletedName) {
        b.data.interfaces = "Interface";
      }
      // 3. Reset New Object
      if (b.type === "new-object") {
        if (b.data.classRef === deletedName) b.data.classRef = "Object";
        if (b.data.classObj === deletedName) b.data.classObj = "Object";
      }
      // 4. Check nested blocks
      if (b.children) cascadeDelete(b.children);
    });
  };

  cascadeDelete(ws.blocks);

  if (window.renderWorkspace) window.renderWorkspace();
  else if (typeof render === "function") render();
};

// --- DYNAMIC WIDTH ENGINE ---
window.measureTextWidth = function (text, font) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = font || "14px 'SN Pro', sans-serif";
  return context.measureText(text || "").width;
};

// --- MODIFIER TEXT GENERATOR ---
function getModifierText(block) {
  let parts = [];
  const acc = block.data.access?.trim();

  if (acc) parts.push(acc);
  else parts.push("default");

  if (block.type !== "method" && block.data.isAbstract) parts.push("abstract");
  if (block.data.isStatic) parts.push("static");
  if (block.data.isFinal) parts.push("final");

  return parts.join(" ");
}

const HEADER_HEIGHT = 50;
const FOOTER_HEIGHT = 20;
const STEM_WIDTH = 12;
const TAB_OFFSET = 35;
const NOTCH_X = 9;
const DENT_START_X = 21;

const NOTCH_PATH = `c-.53 0-.931.47-.931 1 a7 7 0 1 1-14 0 c0-.53-.402-1-.931-1`;
const FOOTER_DENT_PATH = `a 7 7 0 1 0 14 0`;
const BOTTOM_NOTCH_PATH = `a7 7 0 1 1 -14 0`;
const DENT_PATH = `a7 7 0 1 0 14 0`;

// --- UTILITY: HTML ESCAPE ---
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getParentIdStr(blockId) {
  const result = findBlockAndParent(getActiveWorkspace().blocks, blockId);
  return result && result.parent ? result.parent.id : "null";
}

function renderChildBlocks(block, svgContainer) {
  if (!block.children) return;

  block.children.forEach((child) => {
    if (child.type === "construct") renderConstructorBlock(child, svgContainer);
    else if (child.type === "main-method")
      renderMainMethodBlock(child, svgContainer);
    else if (child.type === "method") renderMethodBlock(child, svgContainer);
    else if (child.type === "object-caller")
      renderObjectCallerBlock(child, svgContainer);
    else if (child.type === "method-call")
      renderMethodCallBlock(child, svgContainer);
    else if (child.type === "variable-value")
      renderVariableValueBlock(child, svgContainer);
    else if (child.type === "variable")
      renderVariableBlock(child, svgContainer);
    else if (child.type === "parameter")
      renderParameterBlock(child, svgContainer);
    else if (child.type === "argument")
      renderArgumentBlock(child, svgContainer);
    else if (child.type === "print") renderPrintBlock(child, svgContainer);
    else if (child.type === "this") renderThisBlock(child, svgContainer);
    else if (child.type === "super") renderSuperBlock(child, svgContainer);
    else if (child.type === "prop-assign")
      renderPropAssignBlock(child, svgContainer);
    else if (child.type === "op-input") renderInputPill(child, svgContainer);
    else if (child.type === "new-object")
      renderNewObjectBlock(child, svgContainer);
    else if (child.type === "extends") renderExtendsBlock(child, svgContainer);
    else if (child.type === "return") renderReturnBlock(child, svgContainer);
    else if (child.type === "break" || child.type === "continue")
      renderJumpBlock(child, svgContainer);
    else if (child.type === "for") renderForBlock(child, svgContainer);
    else if (child.type.startsWith("op-"))
      renderOperatorBlock(child, svgContainer);
    else if (
      ["if", "else-if", "else", "while", "do-while", "switch", "case"].includes(
        child.type,
      )
    ) {
      renderControlBlock(child, svgContainer);
    } else if (child.type === "interface")
      renderInterfaceBlock(child, svgContainer);
    else if (child.type === "implements")
      renderImplementsBlock(child, svgContainer);
    else if (child.type === "interface-method")
      renderInterfaceMethodBlock(child, svgContainer);
  });
}

// --- PASS 1: LAYOUT CALCULATOR ---
export function computeLayout(block) {
  if (block.type === "parameter") {
    const typeText = block.data.type || "int";
    const nameText = block.data.name || "";
    const typeW = Math.max(
      60,
      window.measureTextWidth(typeText, "bold 13px 'SN Pro'") + 38,
    );
    const nameW = Math.max(
      100,
      window.measureTextWidth(nameText, "14px 'SN Pro'") + 24,
    );
    block.width = 15 + typeW + 10 + nameW + 15;
    block.height = 50;
    if (block.children) block.children.forEach((child) => computeLayout(child));
    return 0;
  }

  if (block.type === "argument" || block.type === "method-call") {
    const inlineChild = block.children
      ? block.children.find(
          (c) => c.type.startsWith("op-") || c.type === "argument",
        )
      : null;
    if (inlineChild) computeLayout(inlineChild);

    if (block.children) {
      block.children.forEach((c) => {
        if (c.type === "argument") computeLayout(c);
      });
    }

    if (block.type === "method-call") {
      const methodText = block.data.methodName || "";
      const methodW = Math.max(
        90,
        window.measureTextWidth(methodText, "14px 'SN Pro'") + 24,
      );
      block.width = 15 + methodW + 15;
      block.methodW = methodW;
      block.height = 50;
    } else {
      const inlineWidth = inlineChild ? inlineChild.width : 60;
      const inlineHeight = inlineChild ? inlineChild.height : 30;
      block.width = 15 + inlineWidth + 22;
      block.height = Math.max(50, inlineHeight + 20);
    }

    return 0;
  }

  if (
    [
      "variable",
      "variable-value",
      "print",
      "break",
      "continue",
      "object-caller",
      "new-object",
      "interface-method",
    ].includes(block.type)
  ) {
    block.height = 50; // Default height

    if (block.type === "print") {
      const valText = block.data.value || "";
      const valW = Math.max(
        120,
        window.measureTextWidth(valText, "14px 'SN Pro'") + 24,
      );
      block.width = 70 + valW + 15;
      block.valW = valW;
    } else if (block.type === "object-caller") {
      const objText = block.data.objectName || "";
      const objW = Math.max(
        80,
        window.measureTextWidth(objText, "14px 'SN Pro'") + 24,
      );
      block.width = 12 + objW + 12;
      block.objW = objW;
    } else if (block.type === "variable") {
      block.width = 350;
    } else if (block.type === "variable-value") {
      const accessText = getModifierText(block);
      const typeText = block.data.type || "int";
      const nameText = block.data.name || "";

      const dropW = Math.max(
        80,
        window.measureTextWidth(accessText, "bold 13px 'SN Pro'") + 40,
      );
      const typeW = Math.max(
        60,
        window.measureTextWidth(typeText, "bold 13px 'SN Pro'") + 40,
      );
      const nameW = Math.max(
        120,
        window.measureTextWidth(nameText, "14px 'SN Pro'") + 24,
      );

      const inlineChild = block.children
        ? block.children.find((c) => c.type.startsWith("op-"))
        : null;
      if (inlineChild) computeLayout(inlineChild);

      let inlineWidth = inlineChild ? inlineChild.width : 60;
      let inlineHeight = inlineChild ? inlineChild.height : 30; // Elastic height

      block.width =
        15 + dropW + 10 + typeW + 10 + nameW + 25 + inlineWidth + 15;
      block.height = 50;

      block.dropW = dropW;
      block.typeW = typeW;
      block.nameW = nameW;
    } else if (block.type === "break" || block.type === "continue") {
      block.width = 90;
    } else if (block.type === "new-object") {
      block.width = 438;
    } else if (block.type === "interface-method") {
      const rawAccess = block.data.access || "default";
      const accessText = "abstract " + rawAccess;
      const typeText = block.data.returnType || "void";
      const nameText = block.data.name || "";

      const dropW = Math.max(
        110,
        window.measureTextWidth(accessText, "bold 13px 'SN Pro'") + 40,
      );
      const typeW = Math.max(
        60,
        window.measureTextWidth(typeText, "bold 13px 'SN Pro'") + 38,
      );
      const nameW = Math.max(
        120,
        window.measureTextWidth(nameText, "14px 'SN Pro'") + 24,
      );

      block.width = 15 + dropW + 10 + typeW + 10 + nameW + 12;
    }

    if (block.children) block.children.forEach((child) => computeLayout(child));

    // Crucial: Return dynamic elastic height instead of hardcoded 50
    return block.height;
  }

  if (block.type === "extends" || block.type === "implements") {
    let currentVal =
      block.type === "extends"
        ? block.data.superClass || "Object"
        : block.data.interfaces || "Interface";
    if (block.id.startsWith("thumb-"))
      currentVal = block.type === "extends" ? "Superclass" : "Interface";
    const dropW = Math.max(
      90,
      window.measureTextWidth(currentVal, "bold 13px 'SN Pro'") + 38,
    );
    block.width = (block.type === "extends" ? 72 : 90) + dropW + 16;
    block.height = 50;
    return 0;
  }

  if (["this", "super", "return"].includes(block.type)) {
    const inlineChild = block.children
      ? block.children.find((c) => c.type.startsWith("op-"))
      : null;

    if (inlineChild) computeLayout(inlineChild);

    let inlineWidth = inlineChild ? inlineChild.width : 60;
    let inlineHeight = inlineChild ? inlineChild.height : 30; // Elastic height

    let baseWidth =
      block.type === "this" ? 55 : block.type === "super" ? 65 : 70;

    block.width = baseWidth + inlineWidth + 15;

    block.headerHeight = 50;
    block.height = block.headerHeight;

    return block.height;
  }

  if (block.type === "prop-assign") {
    const inlineChild = block.children
      ? block.children.find((c) => c.type.startsWith("op-"))
      : null;
    if (inlineChild) computeLayout(inlineChild);

    const nameW = Math.max(
      80,
      window.measureTextWidth(block.data.name || "", "13px 'SN Pro'") + 24,
    );
    block.nameW = nameW;

    let inlineWidth = inlineChild ? inlineChild.width : 60;
    let inlineHeight = inlineChild ? inlineChild.height : 30; // Elastic height

    block.width = 50 + nameW + 25 + inlineWidth + 15;
    block.height = 50;

    return block.height;
  }

  if (block.type === "op-input") {
    block.height = 40;
    const typeMap = {
      String: t("scan_string"),
      int: t("scan_int"),
      double: t("scan_double"),
      boolean: t("scan_boolean"),
    };
    let displayLabel = typeMap[block.data.type || "String"];
    if (block.id && block.id.startsWith("thumb-op-input"))
      displayLabel = "Scan Input";
    block.width = Math.max(
      90,
      window.measureTextWidth(displayLabel, "bold 15px 'SN Pro'") + 38,
    );
    return 0;
  }

  if (block.type.startsWith("op-")) {
    const isUnary = ["op-value", "op-inc", "op-dec", "op-not"].includes(
      block.type,
    );

    if (isUnary) {
      let valStr = block.data.value || "";
      let padding =
        block.type === "op-not" ? 60 : block.type === "op-value" ? 30 : 50;
      let minW =
        block.type === "op-not" ? 88 : block.type === "op-value" ? 60 : 90;

      let textW = window.measureTextWidth(valStr, "14px 'SN Pro'");
      block.width = Math.max(minW, textW + padding + 12);

      // Standardize unary operator height to 36
      block.height = 36;
    } else {
      let leftChild = block.children
        ? block.children.find((c) => c.slot === "left")
        : null;
      let rightChild = block.children
        ? block.children.find((c) => c.slot === "right")
        : null;

      const isHoleOnlyOp = block.type === "op-and" || block.type === "op-or";

      if (leftChild) computeLayout(leftChild);
      if (rightChild) computeLayout(rightChild);

      let leftW = leftChild
        ? leftChild.width
        : isHoleOnlyOp
          ? 48
          : Math.max(
              40,
              window.measureTextWidth(block.data.left || "", "14px 'SN Pro'") +
                30,
            );

      let rightW = rightChild
        ? rightChild.width
        : isHoleOnlyOp
          ? 48
          : Math.max(
              40,
              window.measureTextWidth(block.data.right || "", "14px 'SN Pro'") +
                30,
            );

      // Reset hole heights to 24px so they fit neatly inside a 36px block
      let leftH = leftChild ? leftChild.height : 24;
      let rightH = rightChild ? rightChild.height : 24;

      block.leftWidth = leftW;
      block.rightWidth = rightW;

      let symbolPadding = [
        "op-less",
        "op-greater",
        "op-less-eq",
        "op-greater-eq",
        "op-equals",
        "op-not-equals",
        "op-and",
        "op-or",
      ].includes(block.type)
        ? 50
        : 40;
      block.width = leftW + rightW + symbolPadding;

      // Standardize binary operator height to 36 (will stretch if leftH/rightH > 24)
      block.height = Math.max(36, leftH + 12, rightH + 12);
    }
    return 0;
  }

  // --- CONTROL BLOCKS & WRAPPERS (If, While, Methods, Classes) ---

  if (
    ["if", "else-if", "else", "while", "do-while", "switch", "case"].includes(
      block.type,
    )
  ) {
    const inlineChild = block.children
      ? block.children.find((c) => c.type.startsWith("op-"))
      : null;
    if (inlineChild) computeLayout(inlineChild);
    const inlineWidth = inlineChild ? inlineChild.width : 60;
    block.width = Math.max(160, 65 + inlineWidth + 30);
  }

  // 1. Calculate elastic header based on tallest inline child
  let inlineChildForHeight = block.children
    ? block.children.find((c) => c.type.startsWith("op-"))
    : null;
  let inlineHeight = inlineChildForHeight ? inlineChildForHeight.height : 30;

  block.headerHeight = Math.max(HEADER_HEIGHT, inlineHeight + 20);
  let currentY = block.headerHeight;

  // 2. Tally up the heights of the vertically stacked children
  if (block.children) {
    block.children.forEach((child) => {
      if (
        !["parameter", "argument", "extends", "implements"].includes(
          child.type,
        ) &&
        !child.type.startsWith("op-")
      ) {
        currentY += computeLayout(child);
      } else {
        computeLayout(child);
      }
    });
  }

  // 3. Compute final inner bounds
  let verticalChildren = block.children
    ? block.children.filter(
        (c) =>
          !["parameter", "argument", "extends", "implements"].includes(
            c.type,
          ) && !c.type.startsWith("op-"),
      )
    : [];

  let innerHeight =
    verticalChildren.length > 0 ? currentY - block.headerHeight : 30;
  block.totalHeight = block.headerHeight + innerHeight + FOOTER_HEIGHT;

  if (block.type === "interface") {
    const nameW = Math.max(
      160,
      window.measureTextWidth(block.data.name || "", "14px 'SN Pro'") + 24,
    );
    block.nameW = nameW;
    block.width = 90 + nameW + 15;
  } else if (block.type === "main-method") {
    block.width = 240;
  } else if (block.type === "for") {
    const initW = Math.max(
      80,
      window.measureTextWidth(block.data.Inisialisasi || "", "13px 'SN Pro'") +
        24,
    );
    const condW = Math.max(
      80,
      window.measureTextWidth(block.data.Kondisi || "", "13px 'SN Pro'") + 24,
    );
    const updW = Math.max(
      80,
      window.measureTextWidth(block.data.Update || "", "13px 'SN Pro'") + 24,
    );
    block.width = 50 + initW + 5 + condW + 5 + updW + 15;
    block.initW = initW;
    block.condW = condW;
    block.updW = updW;
  } else if (
    !["if", "else-if", "while", "do-while", "switch", "case"].includes(
      block.type,
    )
  ) {
    block.width = block.width || 320;
  }

  return block.totalHeight;
}

// --- SVG FACTORY UTILITIES ---
function createBlockGroup(block) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const isPalette = block.id && block.id.startsWith("thumb-");

  // ---> NEW: Attach the ID so main.js and CSS can target it for the red glow
  if (block.id) {
    g.setAttribute("id", block.id);
    g.setAttribute("data-id", block.id);
  }

  if (isPalette) {
    g.setAttribute("class", "palette-block-g");
  } else {
    g.setAttribute("class", "grab-cursor");
    g.setAttribute(
      "onmousedown",
      `startDrag(evt, '${block.id}', '${getParentIdStr(block.id)}')`,
    );
  }
  return g;
}

function createPath(d, fill, stroke, block) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", fill);
  path.setAttribute("stroke", stroke);
  path.setAttribute("stroke-width", "2");
  path.setAttribute("transform", `translate(${block.x}, ${block.y})`);
  return path;
}

function createText(content, x, y, customAttrs = {}) {
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", x);
  text.setAttribute("y", y);
  text.setAttribute("fill", "white");
  text.setAttribute("font-size", "14px");
  text.setAttribute("font-weight", "bold");
  Object.entries(customAttrs).forEach(([k, v]) => text.setAttribute(k, v));
  text.textContent = content;
  return text;
}

function createForeignObject(x, y, w, h, innerHTML) {
  const fo = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "foreignObject",
  );
  fo.setAttribute("x", x);
  fo.setAttribute("y", y);
  fo.setAttribute("width", w);
  fo.setAttribute("height", h);
  fo.innerHTML = innerHTML;
  return fo;
}

function createRect(x, y, w, h, rx, ry, fill, stroke) {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", x);
  rect.setAttribute("y", y);
  rect.setAttribute("width", w);
  rect.setAttribute("height", h);
  if (rx) rect.setAttribute("rx", rx);
  if (ry) rect.setAttribute("ry", ry);
  rect.setAttribute("fill", fill);
  rect.setAttribute("stroke", stroke);
  rect.setAttribute("stroke-width", "2");
  return rect;
}

// --- PASS 2: DRAWING FUNCTIONS ---
export function renderClassBlock(block, svgContainer) {
  const accessText = getModifierText(block);
  const nameText = block.data.name || "";
  const dropW = Math.max(
    80,
    window.measureTextWidth(accessText, "bold 13px 'SN Pro'") + 40,
  );
  const nameW = Math.max(
    120,
    window.measureTextWidth(nameText, "14px 'SN Pro'") + 24,
  );
  block.width = 15 + dropW + 10 + nameW + 12;

  let currentY = HEADER_HEIGHT;
  let currentX = block.width;

  const extendsBlock = block.children.find((c) => c.type === "extends");
  const implementsBlocks = block.children.filter(
    (c) => c.type === "implements",
  );

  const horizontalBlocks = [];
  if (extendsBlock) horizontalBlocks.push(extendsBlock);
  horizontalBlocks.push(...implementsBlocks);

  horizontalBlocks.forEach((child) => {
    child.x = block.x + currentX;
    child.y = block.y;
    currentX += child.width;
  });

  block.children.forEach((child) => {
    if (
      child.type !== "extends" &&
      child.type !== "implements" &&
      child.type !== "parameter" &&
      child.type !== "argument"
    ) {
      child.x = block.x + STEM_WIDTH;
      child.y = block.y + currentY;
      currentY += child.totalHeight || child.height || 50;
    }
  });

  let innerHeight =
    block.children.filter(
      (c) =>
        !["parameter", "argument", "extends", "implements"].includes(c.type),
    ).length > 0
      ? currentY - HEADER_HEIGHT
      : 30;
  const g = createBlockGroup(block);
  const pathData = `M 0 0 H ${block.width} v 18 l -8 5.6 q -2 1.4 0 2.8 l 8 5.6 v 18 H ${TAB_OFFSET + 1} ${NOTCH_PATH} H ${STEM_WIDTH} v ${innerHeight} H ${DENT_START_X} ${FOOTER_DENT_PATH} H ${block.width} v ${FOOTER_HEIGHT} H 0 Z`;
  g.appendChild(createPath(pathData, "#9966FF", "#774DCB", block));

  const chevronSVG = `<svg viewBox="0 0 9 6" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 9px; height: 6px; min-width: 9px; margin-left: 6px; flex-shrink: 0; display: block;"><path d="M4.39 5.112a.74.74 0 0 1-.528-.234L.186 1.118a.7.7 0 0 1-.142-.21A.7.7 0 0 1 0 .66Q0 .48.088.327a.66.66 0 0 1 .234-.24A.65.65 0 0 1 .654 0q.274 0 .479.2l3.259 3.346L7.642.2a.664.664 0 0 1 1.045.127.65.65 0 0 1 .087.332.6.6 0 0 1-.19.454L4.917 4.878a.8.8 0 0 1-.249.176.8.8 0 0 1-.278.058" fill="#fff"/></svg>`;
  g.appendChild(
    createForeignObject(
      block.x + 10,
      block.y + 10,
      dropW,
      30,
      `<button class="custom-dropdown-btn" onmousedown="event.stopPropagation()" style="width: ${dropW}px; background: #855CD6; border-color: #774DCB;" onclick="openModifierMenu(this, '${block.id}', 'class', '#855CD6')"><span style="white-space: nowrap;">${accessText}</span>${chevronSVG}</button>`,
    ),
  );

  g.appendChild(
    createForeignObject(
      block.x + 10 + dropW + 10,
      block.y + 10,
      nameW,
      30,
      `<input type="text" data-block-id="${block.id}" data-prop="name" value="${escapeHtml(nameText)}" 
      onfocus="if(typeof window.activeEditOldVal === 'undefined') { window.activeEditOldVal = this.value; window.activeEditBlockId = '${block.id}'; }" 
      oninput="window.handlePillInput(this, '${block.id}', 'name')" 
      onblur="if(!window.isRenderingInput) { 
          if(window.activeEditOldVal !== undefined && window.activeEditOldVal !== this.value) { 
              window.handleNameCommit(window.activeEditOldVal, this.value, '${block.id}'); 
          } 
          window.activeEditOldVal = undefined; 
          window.activeEditBlockId = undefined; 
      }" 
      onkeydown="if(event.key === 'Enter') this.blur();" 
      placeholder="${t("ph_class")}" style="width: ${nameW}px; height: 100%; box-sizing: border-box; border: 2px solid #774DCB; border-radius: 15px; padding: 0 10px; font-size: 14px; outline: none; color: #333; background: white; font-family: 'SN Pro', sans-serif;">`,
    ),
  );

  svgContainer.appendChild(g);
  renderChildBlocks(block, svgContainer);
}

export function renderInterfaceBlock(block, svgContainer) {
  const nameText = block.data?.name || "";

  const nameW = Math.max(
    134,
    window.measureTextWidth(nameText, "14px 'SN Pro'") + 24,
  );

  block.width = 93 + nameW + 12;

  let currentY = HEADER_HEIGHT;
  let currentX = block.width;

  const extendsBlocks = (block.children || []).filter(
    (c) => c.type === "extends",
  );

  extendsBlocks.forEach((child) => {
    child.x = block.x + currentX;
    child.y = block.y;
    currentX += child.width;
  });

  (block.children || []).forEach((child) => {
    if (child.type !== "extends") {
      child.x = block.x + STEM_WIDTH;
      child.y = block.y + currentY;
      currentY += child.totalHeight || child.height || 50;
    }
  });

  let innerHeight = Math.max(
    30,
    (block.children || []).filter((c) => c.type !== "extends").length > 0
      ? currentY - HEADER_HEIGHT
      : 30,
  );

  const g = createBlockGroup(block);

  const pathData = `M 0 0 H ${block.width} v 18 l -8 5.6 q -2 1.4 0 2.8 l 8 5.6 v 18 H ${TAB_OFFSET + 1} ${NOTCH_PATH} H ${STEM_WIDTH} v ${innerHeight} H ${DENT_START_X} ${FOOTER_DENT_PATH} H ${block.width} v ${FOOTER_HEIGHT} H 0 Z`;

  g.appendChild(createPath(pathData, "#9966FF", "#774DCB", block));
  g.appendChild(createText("interface", block.x + 15, block.y + 30));

  g.appendChild(
    createForeignObject(
      block.x + 88,
      block.y + 10,
      nameW,
      30,
      `<input data-block-id="${block.id}" data-prop="name" style="width:${nameW}px;height:100%;box-sizing:border-box;border:2px solid #774DCB;border-radius:15px;padding:0 10px;font-size:14px;outline:none;color:#333;" value="${escapeHtml(nameText)}" 
      onfocus="if(typeof window.activeEditOldVal === 'undefined') { window.activeEditOldVal = this.value; window.activeEditBlockId = '${block.id}'; }" 
      oninput="window.handlePillInput(this,'${block.id}','name')" 
      onblur="if(!window.isRenderingInput) { 
          if(window.activeEditOldVal !== undefined && window.activeEditOldVal !== this.value) { 
              window.handleNameCommit(window.activeEditOldVal, this.value, '${block.id}'); 
          } 
          window.activeEditOldVal = undefined; 
          window.activeEditBlockId = undefined; 
      }" 
      onkeydown="if(event.key === 'Enter') this.blur();" 
      placeholder="${t("ph_interface")}">`,
    ),
  );

  svgContainer.appendChild(g);
  renderChildBlocks(block, svgContainer);
}

export function renderExtendsBlock(block, svgContainer) {
  let val = block.id.startsWith("thumb-")
    ? "Superclass"
    : block.data.superClass || "Object";
  const dropW = Math.max(
    90,
    window.measureTextWidth(val, "bold 13px 'SN Pro'") + 38,
  );
  block.width = 72 + dropW + 16;
  const g = createBlockGroup(block);
  const pathData = `M 0 0 H ${block.width} v 18 l -8 5.6 q -2 1.4 0 2.8 l 8 5.6 v 18 H 0 v -18 l -8 -5.6 q -2 -1.4 0 -2.8 l 8 -5.6 v -18 Z`;
  g.appendChild(createPath(pathData, "#9966FF", "#774DCB", block));
  g.appendChild(createText("extends", block.x + 10, block.y + 30));
  const chevronSVG = `<svg viewBox="0 0 9 6" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 9px; height: 6px; min-width: 9px; margin-left: 6px; flex-shrink: 0; display: block;"><path d="M4.39 5.112a.74.74 0 0 1-.528-.234L.186 1.118a.7.7 0 0 1-.142-.21A.7.7 0 0 1 0 .66Q0 .48.088.327a.66.66 0 0 1 .234-.24A.65.65 0 0 1 .654 0q.274 0 .479.2l3.259 3.346L7.642.2a.664.664 0 0 1 1.045.127.65.65 0 0 1 .087.332.6.6 0 0 1-.19.454L4.917 4.878a.8.8 0 0 1-.249.176.8.8 0 0 1-.278.058" fill="#fff"/></svg>`;
  g.appendChild(
    createForeignObject(
      block.x + 72,
      block.y + 10,
      dropW,
      30,
      `<button class="custom-dropdown-btn" onmousedown="event.stopPropagation()" style="width: ${dropW}px; background: #855CD6; border-color: #774DCB;" onclick="openModifierMenu(this, '${block.id}', 'extends', '#855CD6')"><span style="white-space: nowrap;">${escapeHtml(val)}</span>${chevronSVG}</button>`,
    ),
  );
  svgContainer.appendChild(g);
}

export function renderImplementsBlock(block, svgContainer) {
  let val = block.id.startsWith("thumb-")
    ? "Interface"
    : block.data.interfaces || "Interface";
  const dropW = Math.max(
    90,
    window.measureTextWidth(val, "bold 13px 'SN Pro'") + 38,
  );
  block.width = 90 + dropW + 16;
  const g = createBlockGroup(block);
  const pathData = `M 0 0 H ${block.width} v 18 l -8 5.6 q -2 1.4 0 2.8 l 8 5.6 v 18 H 0 v -18 l -8 -5.6 q -2 -1.4 0 -2.8 l 8 -5.6 v -18 Z`;
  g.appendChild(createPath(pathData, "#9966FF", "#774DCB", block));
  g.appendChild(
    createText("implements", block.x + 10, block.y + 30, {
      "font-size": "13px",
    }),
  );
  const chevronSVG = `<svg viewBox="0 0 9 6" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 9px; height: 6px; min-width: 9px; margin-left: 6px; flex-shrink: 0; display: block;"><path d="M4.39 5.112a.74.74 0 0 1-.528-.234L.186 1.118a.7.7 0 0 1-.142-.21A.7.7 0 0 1 0 .66Q0 .48.088.327a.66.66 0 0 1 .234-.24A.65.65 0 0 1 .654 0q.274 0 .479.2l3.259 3.346L7.642.2a.664.664 0 0 1 1.045.127.65.65 0 0 1 .087.332.6.6 0 0 1-.19.454L4.917 4.878a.8.8 0 0 1-.249.176.8.8 0 0 1-.278.058" fill="#fff"/></svg>`;
  g.appendChild(
    createForeignObject(
      block.x + 90,
      block.y + 10,
      dropW,
      30,
      `<button class="custom-dropdown-btn" onmousedown="event.stopPropagation()" style="width: ${dropW}px; background: #855CD6; border-color: #774DCB;" onclick="openModifierMenu(this, '${block.id}', 'implements', '#855CD6')"><span style="white-space: nowrap;">${escapeHtml(val)}</span>${chevronSVG}</button>`,
    ),
  );
  svgContainer.appendChild(g);
}

export function renderVariableBlock(block, svgContainer) {
  const accessText = getModifierText(block);
  const typeText = block.data.type || "int";
  const nameText = block.data.name || "";
  const dropW = Math.max(
    80,
    window.measureTextWidth(accessText, "bold 13px 'SN Pro'") + 40,
  );
  const typeW = Math.max(
    60,
    window.measureTextWidth(typeText, "bold 13px 'SN Pro'") + 40,
  );
  const nameW = Math.max(
    120,
    window.measureTextWidth(nameText, "14px 'SN Pro'") + 24,
  );
  block.width = 15 + dropW + 10 + typeW + 10 + nameW + 10;
  block.height = 50;
  const g = createBlockGroup(block);
  const pathData = `M 0 0 h ${NOTCH_X} ${DENT_PATH} H ${block.width} v ${block.height} H ${NOTCH_X + 14} ${BOTTOM_NOTCH_PATH} H 0 Z`;
  g.appendChild(createPath(pathData, "#ff661a", "#CC5214", block));
  const chevronSVG = `<svg viewBox="0 0 9 6" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 9px; height: 6px; min-width: 9px; margin-left: 6px; flex-shrink: 0; display: block;"><path d="M4.39 5.112a.74.74 0 0 1-.528-.234L.186 1.118a.7.7 0 0 1-.142-.21A.7.7 0 0 1 0 .66Q0 .48.088.327a.66.66 0 0 1 .234-.24A.65.65 0 0 1 .654 0q.274 0 .479.2l3.259 3.346L7.642.2a.664.664 0 0 1 1.045.127.65.65 0 0 1 .087.332.6.6 0 0 1-.19.454L4.917 4.878a.8.8 0 0 1-.249.176.8.8 0 0 1-.278.058" fill="#fff"/></svg>`;
  g.appendChild(
    createForeignObject(
      block.x + 10,
      block.y + 10,
      dropW,
      30,
      `<button class="custom-dropdown-btn" onmousedown="event.stopPropagation()" style="width: ${dropW}px; background: #E05A16; border-color: #CC5214;" onclick="openModifierMenu(this, '${block.id}', 'variable', '#E05A16')"><span style="white-space: nowrap;">${accessText}</span>${chevronSVG}</button>`,
    ),
  );
  let curX = 10 + dropW + 10;
  g.appendChild(
    createForeignObject(
      block.x + curX,
      block.y + 10,
      typeW,
      30,
      `<button class="custom-dropdown-btn" onmousedown="event.stopPropagation()" style="width: ${typeW}px; background: #E05A16; border-color: #CC5214;" onclick="openModifierMenu(this, '${block.id}', 'dataType', '#E05A16')"><span style="white-space: nowrap;">${typeText}</span>${chevronSVG}</button>`,
    ),
  );
  curX += typeW + 10;
  g.appendChild(
    createForeignObject(
      block.x + curX,
      block.y + 10,
      nameW,
      30,
      `<input type="text" data-block-id="${block.id}" data-prop="name" value="${escapeHtml(nameText)}" oninput="handlePillInput(this, '${block.id}', 'name')" placeholder="${t("ph_attr")}" style="width: ${nameW}px; height: 100%; box-sizing: border-box; border: 2px solid #CC5214; border-radius: 15px; padding: 0 10px; font-size: 14px; outline: none; color: #333; background: white; font-family: 'SN Pro', sans-serif;">`,
    ),
  );
  svgContainer.appendChild(g);
}

export function renderVariableValueBlock(block, svgContainer) {
  const accessText = getModifierText(block);
  const typeText = block.data.type || "int";
  const nameText = block.data.name || "";

  const dropW =
    block.dropW ||
    Math.max(
      80,
      window.measureTextWidth(accessText, "bold 13px 'SN Pro'") + 40,
    );
  const typeW =
    block.typeW ||
    Math.max(60, window.measureTextWidth(typeText, "bold 13px 'SN Pro'") + 40);
  const nameW =
    block.nameW ||
    Math.max(120, window.measureTextWidth(nameText, "14px 'SN Pro'") + 24);

  const inlineChild = block.children
    ? block.children.find((c) => c.type.startsWith("op-"))
    : null;
  let inlineWidth = inlineChild ? inlineChild.width : 60;

  block.width = 15 + dropW + 10 + typeW + 10 + nameW + 25 + inlineWidth + 15;
  block.height = 50;

  const g = createBlockGroup(block);
  const pathData = `M 0 0 h ${NOTCH_X} ${DENT_PATH} H ${block.width} v ${block.height} H ${NOTCH_X + 14} ${BOTTOM_NOTCH_PATH} H 0 Z`;
  g.appendChild(createPath(pathData, "#ff661a", "#CC5214", block));

  const chevronSVG = `<svg viewBox="0 0 9 6" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 9px; height: 6px; min-width: 9px; margin-left: 6px; flex-shrink: 0; display: block;"><path d="M4.39 5.112a.74.74 0 0 1-.528-.234L.186 1.118a.7.7 0 0 1-.142-.21A.7.7 0 0 1 0 .66Q0 .48.088.327a.66.66 0 0 1 .234-.24A.65.65 0 0 1 .654 0q.274 0 .479.2l3.259 3.346L7.642.2a.664.664 0 0 1 1.045.127.65.65 0 0 1 .087.332.6.6 0 0 1-.19.454L4.917 4.878a.8.8 0 0 1-.249.176.8.8 0 0 1-.278.058" fill="#fff"/></svg>`;

  // 1. Modifier Dropdown
  g.appendChild(
    createForeignObject(
      block.x + 10,
      block.y + 10,
      dropW,
      30,
      `<button class="custom-dropdown-btn" onmousedown="event.stopPropagation()" style="width: ${dropW}px; background: #E05A16; border-color: #CC5214;" onclick="openModifierMenu(this, '${block.id}', 'variable-value', '#E05A16')"><span style="white-space: nowrap;">${accessText}</span>${chevronSVG}</button>`,
    ),
  );

  let curX = 10 + dropW + 10;

  // 2. Data Type Dropdown
  g.appendChild(
    createForeignObject(
      block.x + curX,
      block.y + 10,
      typeW,
      30,
      `<button class="custom-dropdown-btn" onmousedown="event.stopPropagation()" style="width: ${typeW}px; background: #E05A16; border-color: #CC5214;" onclick="openModifierMenu(this, '${block.id}', 'dataType', '#E05A16')"><span style="white-space: nowrap;">${typeText}</span>${chevronSVG}</button>`,
    ),
  );

  curX += typeW + 10;

  // 3. Variable Name Input
  g.appendChild(
    createForeignObject(
      block.x + curX,
      block.y + 10,
      nameW,
      30,
      `<input type="text" data-block-id="${block.id}" data-prop="name" value="${escapeHtml(nameText)}" oninput="handlePillInput(this, '${block.id}', 'name')" placeholder="${t("ph_attr")}" style="width: ${nameW}px; height: 100%; box-sizing: border-box; border: 2px solid #CC5214; border-radius: 15px; padding: 0 10px; font-size: 14px; outline: none; color: #333; background: white; font-family: 'SN Pro', sans-serif;">`,
    ),
  );

  curX += nameW + 8;

  // 4. Equals Sign
  g.appendChild(
    createText("=", block.x + curX, block.y + 30, { "font-size": "16px" }),
  );

  curX += 20;

  // 5. Draw the attached Pill OR an empty Dropzone Hole ---
  if (inlineChild) {
    inlineChild.x = block.x + curX;
    inlineChild.y = block.y + 7;
  } else {
    g.appendChild(
      createRect(
        block.x + curX,
        block.y + 10,
        60,
        30,
        15,
        15,
        "#CC5214",
        "#CC5214",
      ),
    );
  }

  svgContainer.appendChild(g);
  renderChildBlocks(block, svgContainer);
}

export function renderPropAssignBlock(block, svgContainer) {
  const g = createBlockGroup(block);
  const pathData = `M 0 0 h ${NOTCH_X} ${DENT_PATH} H ${block.width || 230} v 50 H ${NOTCH_X + 14} ${BOTTOM_NOTCH_PATH} H 0 Z`;
  g.appendChild(createPath(pathData, "#ff661a", "#CC5214", block));
  g.appendChild(createText("Set", block.x + 15, block.y + 30));
  g.appendChild(
    createForeignObject(
      block.x + 50,
      block.y + 10,
      block.nameW || 80,
      30,
      `<input data-block-id="${block.id}" data-prop="name" style="width: 100%; height: 100%; box-sizing: border-box; border: 2px solid #CC5214; border-radius: 15px; padding: 0 10px; font-size: 13px; font-family: 'SN Pro', sans-serif; outline: none; color: #333;" value="${escapeHtml(block.data.name || "")}" oninput="handlePillInput(this, '${block.id}', 'name')" placeholder="${t("ph_attr_short")}">`,
    ),
  );
  g.appendChild(
    createText("=", block.x + 50 + (block.nameW || 80) + 7, block.y + 31, {
      "font-size": "16px",
    }),
  );
  const inlineChild = block.children
    ? block.children.find((c) => c.type.startsWith("op-"))
    : null;
  if (inlineChild) {
    inlineChild.x = block.x + 50 + (block.nameW || 80) + 25;
    inlineChild.y = block.y + 7;
  } else {
    g.appendChild(
      createRect(
        block.x + 50 + (block.nameW || 80) + 25,
        block.y + 10,
        60,
        30,
        15,
        15,
        "#CC5214",
        "#CC5214",
      ),
    );
  }
  svgContainer.appendChild(g);
  renderChildBlocks(block, svgContainer);
}

export function renderInputPill(block, svgContainer) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

  if (block.id) {
    g.setAttribute("id", block.id);
    g.setAttribute("data-id", block.id);
  }
  g.setAttribute("class", "grab-cursor");
  g.setAttribute(
    "onmousedown",
    `startDrag(evt, '${block.id}', '${getParentIdStr(block.id)}')`,
  );

  const typeMap = {
    String: t("scan_string"),
    int: t("scan_int"),
    double: t("scan_double"),
    boolean: t("scan_boolean"),
  };
  let displayLabel = typeMap[block.data.type || "String"];
  if (block.id && block.id.startsWith("thumb-op-input"))
    displayLabel = "Scan Input";
  const labelW = Math.max(
    90,
    window.measureTextWidth(displayLabel, "bold 15px 'SN Pro'") + 40,
  );
  block.width = labelW;
  const h = 36;
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("width", labelW);
  rect.setAttribute("height", h);
  rect.setAttribute("rx", h / 2);
  rect.setAttribute("ry", h / 2);
  rect.setAttribute("fill", "#ff661a");
  rect.setAttribute("stroke", "#CC5214");
  rect.setAttribute("stroke-width", "2");
  rect.setAttribute("transform", `translate(${block.x}, ${block.y})`);
  g.appendChild(rect);
  const chevronSVG = `<svg viewBox="0 0 9 6" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 9px; height: 6px; min-width: 9px; margin-left: 6px; flex-shrink: 0; display: block;"><path d="M4.39 5.112a.74.74 0 0 1-.528-.234L.186 1.118a.7.7 0 0 1-.142-.21A.7.7 0 0 1 0 .66Q0 .48.088.327a.66.66 0 0 1 .234-.24A.65.65 0 0 1 .654 0q.274 0 .479.2l3.259 3.346L7.642.2a.664.664 0 0 1 1.045.127.65.65 0 0 1 .087.332.6.6 0 0 1-.19.454L4.917 4.878a.8.8 0 0 1-.249.176.8.8 0 0 1-.278.058" fill="#fff"/></svg>`;
  const fo = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "foreignObject",
  );
  fo.setAttribute("x", block.x);
  fo.setAttribute("y", block.y + 6);
  fo.setAttribute("width", labelW);
  fo.setAttribute("height", 24);
  fo.innerHTML = `<button class="custom-dropdown-btn" onmousedown="event.stopPropagation()" style="width: 100%; height: 100%; background: transparent; border: none; padding: 0 16px;" onclick="openModifierMenu(this, '${block.id}', 'scan', '#ff661a')"><span style="white-space: nowrap; font-size: 15px;">${displayLabel}</span>${chevronSVG}</button>`;
  g.appendChild(fo);
  svgContainer.appendChild(g);
}

export function renderConstructorBlock(block, svgContainer) {
  const accessText = getModifierText(block);
  const nameText = block.data.name || "";
  const dropW = Math.max(
    80,
    window.measureTextWidth(accessText, "bold 13px 'SN Pro'") + 40,
  );
  const nameW = Math.max(
    120,
    window.measureTextWidth(nameText, "14px 'SN Pro'") + 24,
  );
  block.width = 15 + dropW + 10 + nameW + 12;
  let currentY = HEADER_HEIGHT;
  let currentX = block.width;
  block.children.forEach((child) => {
    if (child.type === "parameter") {
      child.x = block.x + currentX;
      child.y = block.y;
      currentX += child.width;
    } else {
      child.x = block.x + STEM_WIDTH;
      child.y = block.y + currentY;
      currentY += child.totalHeight || child.height || 50;
    }
  });
  let innerHeight =
    block.children.filter(
      (c) => c.type !== "parameter" && c.type !== "argument",
    ).length > 0
      ? currentY - HEADER_HEIGHT
      : 30;
  const g = createBlockGroup(block);
  const pathData = `M 0 0 h ${NOTCH_X} ${DENT_PATH} H ${block.width} v 18 h -7 a 3 3 0 0 0 -3 3 v 8 a 3 3 0 0 0 3 3 h 7 v 18 H ${TAB_OFFSET + 1} ${NOTCH_PATH} H ${STEM_WIDTH} v ${innerHeight} H ${DENT_START_X} ${FOOTER_DENT_PATH} H ${block.width} v ${FOOTER_HEIGHT} H ${NOTCH_X + 14} ${BOTTOM_NOTCH_PATH} H 0 Z`;
  g.appendChild(createPath(pathData, "#4c97ff", "#3b78cc", block));
  const chevronSVG = `<svg viewBox="0 0 9 6" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 9px; height: 6px; min-width: 9px; margin-left: 6px; flex-shrink: 0; display: block;"><path d="M4.39 5.112a.74.74 0 0 1-.528-.234L.186 1.118a.7.7 0 0 1-.142-.21A.7.7 0 0 1 0 .66Q0 .48.088.327a.66.66 0 0 1 .234-.24A.65.65 0 0 1 .654 0q.274 0 .479.2l3.259 3.346L7.642.2a.664.664 0 0 1 1.045.127.65.65 0 0 1 .087.332.6.6 0 0 1-.19.454L4.917 4.878a.8.8 0 0 1-.249.176.8.8 0 0 1-.278.058" fill="#fff"/></svg>`;
  g.appendChild(
    createForeignObject(
      block.x + 10,
      block.y + 10,
      dropW,
      30,
      `<button class="custom-dropdown-btn" onmousedown="event.stopPropagation()" style="width: ${dropW}px; background: #4280D7; border-color: #3b78cc;" onclick="openModifierMenu(this, '${block.id}', 'construct', '#4280D7')"><span style="white-space: nowrap;">${accessText}</span>${chevronSVG}</button>`,
    ),
  );
  g.appendChild(
    createForeignObject(
      block.x + 10 + dropW + 10,
      block.y + 10,
      nameW,
      30,
      `<input type="text" data-block-id="${block.id}" data-prop="name" value="${escapeHtml(nameText)}" oninput="handlePillInput(this, '${block.id}', 'name')" placeholder="${t("ph_construct")}" style="width: ${nameW}px; height: 100%; box-sizing: border-box; border: 2px solid #3b78cc; border-radius: 15px; padding: 0 10px; font-size: 14px; outline: none; color: #333; background: white; font-family: 'SN Pro', sans-serif;">`,
    ),
  );
  svgContainer.appendChild(g);
  renderChildBlocks(block, svgContainer);
}

export function renderMainMethodBlock(block, svgContainer) {
  let currentY = HEADER_HEIGHT;
  block.children.forEach((child) => {
    child.x = block.x + STEM_WIDTH;
    child.y = block.y + currentY;
    currentY += child.totalHeight || child.height || 50;
  });
  let innerHeight = block.children.length > 0 ? currentY - HEADER_HEIGHT : 30;
  const g = createBlockGroup(block);
  const w = block.width;
  let pathData = `M 0 0 h ${NOTCH_X} ${DENT_PATH} H ${w} v 50 H ${TAB_OFFSET + 1} ${NOTCH_PATH} H ${STEM_WIDTH} v ${innerHeight} H ${DENT_START_X} ${FOOTER_DENT_PATH} H ${w} v ${FOOTER_HEIGHT} H ${NOTCH_X + 14} ${BOTTOM_NOTCH_PATH} H 0 Z`;
  g.appendChild(createPath(pathData, "#59c059", "#389e38", block));

  const textX = block.x + w / 2 - 23;
  const text = createText("MAIN", textX, block.y + 30, {
    "font-size": "1rem",
    "text-decoration": "underline",
  });
  g.appendChild(text);
  svgContainer.appendChild(g);
  renderChildBlocks(block, svgContainer);
}

export function renderMethodBlock(block, svgContainer) {
  const accessText = getModifierText(block);
  const typeText = block.data.returnType || "void";
  const nameText = block.data.name || "";
  const dropW = Math.max(
    80,
    window.measureTextWidth(accessText, "bold 13px 'SN Pro'") + 40,
  );
  const typeW = Math.max(
    60,
    window.measureTextWidth(typeText, "bold 13px 'SN Pro'") + 40,
  );
  const nameW = Math.max(
    132,
    window.measureTextWidth(nameText, "14px 'SN Pro'") + 24,
  );
  block.width = 15 + dropW + 10 + typeW + 10 + nameW + 12;
  let currentY = HEADER_HEIGHT;
  let currentX = block.width;
  block.children.forEach((child) => {
    if (child.type === "parameter") {
      child.x = block.x + currentX;
      child.y = block.y;
      currentX += child.width;
    } else {
      child.x = block.x + STEM_WIDTH;
      child.y = block.y + currentY;
      currentY += child.totalHeight || child.height || 50;
    }
  });
  let innerHeight =
    block.children.filter(
      (c) => c.type !== "parameter" && c.type !== "argument",
    ).length > 0
      ? currentY - HEADER_HEIGHT
      : 30;
  const g = createBlockGroup(block);
  const pathData = `M 0 0 h ${NOTCH_X} ${DENT_PATH} H ${block.width} v 18 h -7 a 3 3 0 0 0 -3 3 v 8 a 3 3 0 0 0 3 3 h 7 v 18 H ${TAB_OFFSET + 1} ${NOTCH_PATH} H ${STEM_WIDTH} v ${innerHeight} H ${DENT_START_X} ${FOOTER_DENT_PATH} H ${block.width} v ${FOOTER_HEIGHT} H ${NOTCH_X + 14} ${BOTTOM_NOTCH_PATH} H 0 Z`;
  g.appendChild(createPath(pathData, "#59c059", "#389e38", block));
  const chevronSVG = `<svg viewBox="0 0 9 6" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 9px; height: 6px; min-width: 9px; margin-left: 6px; flex-shrink: 0; display: block;"><path d="M4.39 5.112a.74.74 0 0 1-.528-.234L.186 1.118a.7.7 0 0 1-.142-.21A.7.7 0 0 1 0 .66Q0 .48.088.327a.66.66 0 0 1 .234-.24A.65.65 0 0 1 .654 0q.274 0 .479.2l3.259 3.346L7.642.2a.664.664 0 0 1 1.045.127.65.65 0 0 1 .087.332.6.6 0 0 1-.19.454L4.917 4.878a.8.8 0 0 1-.249.176.8.8 0 0 1-.278.058" fill="#fff"/></svg>`;
  g.appendChild(
    createForeignObject(
      block.x + 10,
      block.y + 10,
      dropW,
      30,
      `<button class="custom-dropdown-btn" onmousedown="event.stopPropagation()" style="width: ${dropW}px; background: #48AA48; border-color: #389e38;" onclick="openModifierMenu(this, '${block.id}', 'method', '#48AA48')"><span style="white-space: nowrap;">${accessText}</span>${chevronSVG}</button>`,
    ),
  );
  let curX = 10 + dropW + 10;
  g.appendChild(
    createForeignObject(
      block.x + curX,
      block.y + 10,
      typeW,
      30,
      `<button class="custom-dropdown-btn" onmousedown="event.stopPropagation()" style="width: ${typeW}px; background: #48AA48; border-color: #389e38;" onclick="openModifierMenu(this, '${block.id}', 'returnType', '#48AA48')"><span style="white-space: nowrap;">${typeText}</span>${chevronSVG}</button>`,
    ),
  );
  curX += typeW + 10;
  g.appendChild(
    createForeignObject(
      block.x + curX,
      block.y + 10,
      nameW,
      30,
      `<input type="text" data-block-id="${block.id}" data-prop="name" value="${escapeHtml(nameText)}" oninput="handlePillInput(this, '${block.id}', 'name')" placeholder="${t("ph_method")}" style="width: ${nameW}px; height: 100%; box-sizing: border-box; border: 2px solid #389e38; border-radius: 15px; padding: 0 10px; font-size: 14px; outline: none; color: #333; background: white; font-family: 'SN Pro', sans-serif;">`,
    ),
  );
  svgContainer.appendChild(g);
  renderChildBlocks(block, svgContainer);
}

export function renderInterfaceMethodBlock(block, svgContainer) {
  const ws = getActiveWorkspace();
  let isInsideInterface = false;

  if (ws && !block.id.startsWith("thumb-")) {
    const findParent = (list, parentNode = null) => {
      for (const b of list) {
        if (b.id === block.id) {
          if (parentNode && parentNode.type === "interface")
            isInsideInterface = true;
          return true;
        }
        if (b.children && findParent(b.children, b)) return true;
      }
      return false;
    };
    findParent(ws.blocks);
  }

  if (isInsideInterface) {
    block.data.access = "public";
  }

  const rawAccess = block.data.access || "default";
  const accessText = `${rawAccess} abstract`;
  const typeText = block.data.returnType || "void";
  const nameText = block.data.name || "";

  const accessChevronSpace = isInsideInterface ? 20 : 40;
  const dropW = Math.max(
    isInsideInterface ? 90 : 110,
    window.measureTextWidth(accessText, "bold 13px 'SN Pro'") +
      accessChevronSpace,
  );
  const typeW = Math.max(
    60,
    window.measureTextWidth(typeText, "bold 13px 'SN Pro'") + 38,
  );
  const nameW = Math.max(
    120,
    window.measureTextWidth(nameText, "14px 'SN Pro'") + 24,
  );

  block.width = 15 + dropW + 10 + typeW + 10 + nameW + 12;
  let currentX = block.width;

  if (block.children) {
    block.children.forEach((child) => {
      if (child.type === "parameter") {
        child.x = block.x + currentX;
        child.y = block.y;
        currentX += child.width || 220;
      }
    });
  }

  block.height = 50;
  const g = createBlockGroup(block);
  const pathData = `M 0 0 h ${NOTCH_X} ${DENT_PATH} H ${block.width} v 18 h -7 a 3 3 0 0 0 -3 3 v 8 a 3 3 0 0 0 3 3 h 7 v 18 H ${NOTCH_X + 14} ${BOTTOM_NOTCH_PATH} H 0 Z`;
  g.appendChild(createPath(pathData, "#59c059", "#389e38", block));
  const chevronSVG = `<svg viewBox="0 0 9 6" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 9px; height: 6px; min-width: 9px; margin-left: 6px; flex-shrink: 0; display: block;"><path d="M4.39 5.112a.74.74 0 0 1-.528-.234L.186 1.118a.7.7 0 0 1-.142-.21A.7.7 0 0 1 0 .66Q0 .48.088.327a.66.66 0 0 1 .234-.24A.65.65 0 0 1 .654 0q.274 0 .479.2l3.259 3.346L7.642.2a.664.664 0 0 1 1.045.127.65.65 0 0 1 .087.332.6.6 0 0 1-.19.454L4.917 4.878a.8.8 0 0 1-.249.176.8.8 0 0 1-.278.058" fill="#fff"/></svg>`;

  const accessClick = isInsideInterface
    ? ""
    : `onclick="openModifierMenu(this, '${block.id}', 'interface-method-access', '#48AA48')"`;
  const accessChevronHTML = isInsideInterface ? "" : chevronSVG;
  const accessCursor = isInsideInterface
    ? "cursor: default; opacity: 0.9;"
    : "cursor: pointer;";

  // 1. Access Modifier Dropdown
  g.appendChild(
    createForeignObject(
      block.x + 10,
      block.y + 10,
      dropW,
      30,
      `<button class="custom-dropdown-btn" onmousedown="event.stopPropagation()" style="width: ${dropW}px; background: #48AA48; border-color: #389e38; ${accessCursor}" ${accessClick}><span style="white-space: nowrap;">${accessText}</span>${accessChevronHTML}</button>`,
    ),
  );

  // 2. Return Type Dropdown
  g.appendChild(
    createForeignObject(
      block.x + 10 + dropW + 10,
      block.y + 10,
      typeW,
      30,
      `<button class="custom-dropdown-btn" onmousedown="event.stopPropagation()" style="width: ${typeW}px; background: #48AA48; border-color: #389e38;" onclick="openModifierMenu(this, '${block.id}', 'returnType', '#48AA48')"><span style="white-space: nowrap;">${typeText}</span>${chevronSVG}</button>`,
    ),
  );

  // 3. Method Name Input
  g.appendChild(
    createForeignObject(
      block.x + 10 + dropW + 10 + typeW + 10,
      block.y + 10,
      nameW,
      30,
      `<input type="text" data-block-id="${block.id}" data-prop="name" value="${escapeHtml(nameText)}" oninput="handlePillInput(this, '${block.id}', 'name')" placeholder="${t("ph_method")}" style="width: ${nameW}px; height: 100%; box-sizing: border-box; border: 2px solid #389e38; border-radius: 15px; padding: 0 10px; font-size: 14px; outline: none; color: #333; background: white; font-family: 'SN Pro', sans-serif;">`,
    ),
  );

  svgContainer.appendChild(g);
  renderChildBlocks(block, svgContainer);
}

export function renderMethodCallBlock(block, svgContainer) {
  const methodW =
    block.methodW ||
    Math.max(
      90,
      window.measureTextWidth(block.data.methodName || "", "14px 'SN Pro'") +
        24,
    );
  const g = createBlockGroup(block);
  const w = block.width;

  let pathData = `M 0 0 H ${w} v 18 c -10 0 -10 14 0 14 v 18 H 0 v -18 c 10 0 10 -14 0 -14 v -18 Z`;
  g.appendChild(createPath(pathData, "#59c059", "#389e38", block)); // Green method

  g.appendChild(
    createForeignObject(
      block.x + 15,
      block.y + 10,
      methodW,
      30,
      `<input style="width: 100%; height: 100%; box-sizing: border-box; border: 2px solid #389e38; border-radius: 15px; padding: 0 10px; font-size: 14px; outline: none; color: #333; text-align:left; cursor:text;" data-block-id="${block.id}" data-prop="methodName" value="${escapeHtml(block.data.methodName) || ""}" oninput="handlePillInput(this, '${block.id}', 'methodName')" placeholder="${t("ph_method_short")}">`,
    ),
  );
  svgContainer.appendChild(g);

  if (block.children) {
    let currentX = block.width;
    block.children.forEach((child) => {
      if (child.type === "argument") {
        child.x = block.x + currentX;
        child.y = block.y;
        renderArgumentBlock(child, svgContainer);
        currentX += child.width || 120;
      }
    });
  }
}

export function renderPrintBlock(block, svgContainer) {
  const valW =
    block.valW ||
    Math.max(
      120,
      window.measureTextWidth(block.data.value || "", "14px 'SN Pro'") + 24,
    );
  const g = createBlockGroup(block);
  const w = block.width;
  let pathData = `M 0 0 h ${NOTCH_X} ${DENT_PATH} H ${w} v 18 c -10 0 -10 14 0 14 v 18 H ${NOTCH_X + 14} ${BOTTOM_NOTCH_PATH} H 0 Z`;
  g.appendChild(createPath(pathData, "#59c059", "#389e38", block));
  g.appendChild(createText("println", block.x + 15, block.y + 30));
  g.appendChild(
    createForeignObject(
      block.x + 70,
      block.y + 10,
      valW,
      30,
      `<input style="width: 100%; height: 100%; box-sizing: border-box; border: 2px solid #389e38; border-radius: 15px; padding: 0 10px; font-size: 14px; outline: none; color: #333; text-align:left; cursor:text;" data-block-id="${block.id}" data-prop="value" value="${escapeHtml(block.data.value) || ""}" oninput="handlePillInput(this, '${block.id}', 'value')" placeholder="${t("ph_print")}">`,
    ),
  );
  svgContainer.appendChild(g);
  if (block.children) {
    let currentX = block.width;
    block.children.forEach((child) => {
      if (child.type === "argument") {
        child.x = block.x + currentX;
        child.y = block.y;
        renderArgumentBlock(child, svgContainer);
        currentX += child.width || 120;
      }
    });
  }
}

export function renderParameterBlock(block, svgContainer) {
  const g = createBlockGroup(block);
  const typeText = block.data.type || "int";
  const nameText = block.data.name || "";
  const typeW = Math.max(
    60,
    window.measureTextWidth(typeText, "bold 13px 'SN Pro'") + 38,
  );
  const nameW = Math.max(
    100,
    window.measureTextWidth(nameText, "14px 'SN Pro'") + 24,
  );
  block.width = 15 + typeW + 10 + nameW + 15;
  block.height = 50;
  let pathData = `M 0 0 H ${block.width} v 18 h -7 a 3 3 0 0 0 -3 3 v 8 a 3 3 0 0 0 3 3 h 7 v 18 H 0 v -18 h -7 a 3 3 0 0 1 -3 -3 v -8 a 3 3 0 0 1 3 -3 h 7 v -18 Z`;
  g.appendChild(createPath(pathData, "#cf63cf", "#a849a8", block));
  const chevronSVG = `<svg viewBox="0 0 9 6" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 9px; height: 6px; min-width: 9px; margin-left: 6px; flex-shrink: 0; display: block;"><path d="M4.39 5.112a.74.74 0 0 1-.528-.234L.186 1.118a.7.7 0 0 1-.142-.21A.7.7 0 0 1 0 .66Q0 .48.088.327a.66.66 0 0 1 .234-.24A.65.65 0 0 1 .654 0q.274 0 .479.2l3.259 3.346L7.642.2a.664.664 0 0 1 1.045.127.65.65 0 0 1 .087.332.6.6 0 0 1-.19.454L4.917 4.878a.8.8 0 0 1-.249.176.8.8 0 0 1-.278.058" fill="#fff"/></svg>`;
  g.appendChild(
    createForeignObject(
      block.x + 10,
      block.y + 10,
      typeW,
      30,
      `<button class="custom-dropdown-btn" onmousedown="event.stopPropagation()" style="width: ${typeW}px; background: #BD42BD; border-color: #A539A5;" onclick="openModifierMenu(this, '${block.id}', 'dataType', '#BD42BD')"><span style="white-space: nowrap;">${typeText}</span>${chevronSVG}</button>`,
    ),
  );
  g.appendChild(
    createForeignObject(
      block.x + 10 + typeW + 10,
      block.y + 10,
      nameW,
      30,
      `<input type="text" data-block-id="${block.id}" data-prop="name" value="${escapeHtml(nameText)}" oninput="handlePillInput(this, '${block.id}', 'name')" placeholder="${t("ph_param")}" style="width: ${nameW}px; height: 100%; box-sizing: border-box; border: 2px solid #A539A5; border-radius: 15px; padding: 0 10px; font-size: 14px; outline: none; color: #333; background: white; font-family: 'SN Pro', sans-serif;">`,
    ),
  );
  svgContainer.appendChild(g);
  if (block.children) {
    block.children.forEach((child) => {
      if (child.type === "parameter") {
        child.x = block.x + block.width;
        child.y = block.y;
        renderParameterBlock(child, svgContainer);
      }
    });
  }
}

export function renderArgumentBlock(block, svgContainer) {
  const g = createBlockGroup(block);
  const pathData = `M 0 0 H ${block.width} v 18 c -10 0 -10 14 0 14 v 18 H 0 v -18 c -10 0 -10 -14 0 -14 v -18 Z`;
  g.appendChild(createPath(pathData, "#cf63cf", "#a849a8", block));
  const inlineChild = block.children
    ? block.children.find((c) => c.type.startsWith("op-"))
    : null;
  if (inlineChild) {
    inlineChild.x = block.x + 15;
    inlineChild.y = block.y + 7;
  } else {
    g.appendChild(
      createRect(
        block.x + 15,
        block.y + 10,
        60,
        30,
        15,
        15,
        "#a849a8",
        "#cf63cf",
      ),
    );
  }
  svgContainer.appendChild(g);
  if (block.children) {
    block.children.forEach((child) => {
      if (child.type.startsWith("op-")) {
        renderOperatorBlock(child, svgContainer);
      } else if (child.type === "argument") {
        child.x = block.x + block.width;
        child.y = block.y;
        renderArgumentBlock(child, svgContainer);
      }
    });
  }
}

export function renderNewObjectBlock(block, svgContainer) {
  const g = createBlockGroup(block);
  let refText = block.id.startsWith("thumb-")
    ? "Main"
    : block.data.classRef || "Object";
  let objText = block.id.startsWith("thumb-")
    ? "Main"
    : block.data.classObj || "Object";
  const nameText = block.data.objName || "";
  const refW = Math.max(
    80,
    window.measureTextWidth(refText, "bold 13px 'SN Pro'") + 38,
  );
  const objW = Math.max(
    80,
    window.measureTextWidth(objText, "bold 13px 'SN Pro'") + 38,
  );
  const nameW = Math.max(
    80,
    window.measureTextWidth(nameText, "14px 'SN Pro'") + 24,
  );
  const asNewW = window.measureTextWidth("as new", "bold 14px 'SN Pro'") + 10;
  block.width = 15 + 45 + 10 + refW + 10 + nameW + 10 + asNewW + 10 + objW + 12;
  let pathData = `M 0 0 h ${NOTCH_X} ${DENT_PATH} H ${block.width} v 18 c -10 0 -10 14 0 14 v 18 H ${NOTCH_X + 14} ${BOTTOM_NOTCH_PATH} H 0 Z`;
  g.appendChild(createPath(pathData, "#cf63cf", "#a849a8", block));
  g.appendChild(createText("Create", block.x + 15, block.y + 30));
  const chevronSVG = `<svg viewBox="0 0 9 6" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 9px; height: 6px; min-width: 9px; margin-left: 6px; flex-shrink: 0; display: block;"><path d="M4.39 5.112a.74.74 0 0 1-.528-.234L.186 1.118a.7.7 0 0 1-.142-.21A.7.7 0 0 1 0 .66Q0 .48.088.327a.66.66 0 0 1 .234-.24A.65.65 0 0 1 .654 0q.274 0 .479.2l3.259 3.346L7.642.2a.664.664 0 0 1 1.045.127.65.65 0 0 1 .087.332.6.6 0 0 1-.19.454L4.917 4.878a.8.8 0 0 1-.249.176.8.8 0 0 1-.278.058" fill="#fff"/></svg>`;
  let curX = 15 + 45 + 10;
  g.appendChild(
    createForeignObject(
      block.x + curX,
      block.y + 10,
      refW,
      30,
      `<button class="custom-dropdown-btn" onmousedown="event.stopPropagation()" style="width: ${refW}px; background: #BD42BD; border-color: #A539A5;" onclick="openModifierMenu(this, '${block.id}', 'classRef', '#BD42BD')"><span style="white-space: nowrap;">${escapeHtml(refText)}</span>${chevronSVG}</button>`,
    ),
  );
  curX += refW + 10;
  g.appendChild(
    createForeignObject(
      block.x + curX,
      block.y + 10,
      nameW,
      30,
      `<input type="text" data-block-id="${block.id}" data-prop="objName" value="${escapeHtml(nameText)}" oninput="handlePillInput(this, '${block.id}', 'objName')" placeholder="${t("ph_object")}" style="width: ${nameW}px; height: 100%; box-sizing: border-box; border: 2px solid #A539A5; border-radius: 15px; padding: 0 10px; font-size: 14px; outline: none; color: #333; background: white; font-family: 'SN Pro', sans-serif;">`,
    ),
  );
  curX += nameW + 10;
  g.appendChild(createText("as new", block.x + curX, block.y + 30));
  curX += asNewW + 2;
  g.appendChild(
    createForeignObject(
      block.x + curX,
      block.y + 10,
      objW,
      30,
      `<button class="custom-dropdown-btn" onmousedown="event.stopPropagation()" style="width: ${objW}px; background: #BD42BD; border-color: #A539A5;" onclick="openModifierMenu(this, '${block.id}', 'classObj', '#BD42BD')"><span style="white-space: nowrap;">${escapeHtml(objText)}</span>${chevronSVG}</button>`,
    ),
  );
  svgContainer.appendChild(g);
  if (block.children) {
    let currentX = block.width;
    block.children.forEach((child) => {
      if (child.type === "argument") {
        child.x = block.x + currentX;
        child.y = block.y;
        renderArgumentBlock(child, svgContainer);
        currentX += child.width || 120;
      }
    });
  }
}

export function renderObjectCallerBlock(block, svgContainer) {
  const objW =
    block.objW ||
    Math.max(
      90,
      window.measureTextWidth(block.data.objectName || "", "14px 'SN Pro'") +
        24,
    );
  const g = createBlockGroup(block);
  const w = block.width;

  let pathData = `M 0 0 h ${NOTCH_X} ${DENT_PATH} H ${w} v 18 c 10 0 10 14 0 14 v 18 H ${NOTCH_X + 14} ${BOTTOM_NOTCH_PATH} H 0 Z`;
  g.appendChild(createPath(pathData, "#cf63cf", "#a849a8", block));

  g.appendChild(
    createForeignObject(
      block.x + 12,
      block.y + 10,
      objW,
      30,
      `<input style="width: 100%; height: 100%; box-sizing: border-box; border: 2px solid #a849a8; border-radius: 15px; padding: 0 10px; font-size: 14px; outline: none; color: #333; text-align:left; cursor:text;" data-block-id="${block.id}" data-prop="objectName" value="${escapeHtml(block.data.objectName) || ""}" oninput="handlePillInput(this, '${block.id}', 'objectName')" placeholder="${t("ph_object")}">`,
    ),
  );
  svgContainer.appendChild(g);

  if (block.children) {
    let currentX = block.width;
    block.children.forEach((child) => {
      if (child.type === "method-call") {
        child.x = block.x + currentX;
        child.y = block.y;
        renderMethodCallBlock(child, svgContainer);
      }
    });
  }
}

export function renderThisBlock(block, svgContainer) {
  const g = createBlockGroup(block);
  const w = block.width || 130;
  const h = block.height || 50;
  let pathData = `M 0 0 h ${NOTCH_X} ${DENT_PATH} H ${w} v 50 H ${NOTCH_X + 14} ${BOTTOM_NOTCH_PATH} H 0 Z`;
  g.appendChild(createPath(pathData, "#cf63cf", "#a849a8", block));
  g.appendChild(createText("this", block.x + 15, block.y + 30));
  const inlineChild = block.children
    ? block.children.find((c) => c.type.startsWith("op-"))
    : null;
  if (inlineChild) {
    inlineChild.x = block.x + 55;
    inlineChild.y = block.y + 7;
  } else {
    g.appendChild(
      createRect(
        block.x + 55,
        block.y + 10,
        60,
        30,
        15,
        15,
        "#a849a8",
        "#cf63cf",
      ),
    );
  }
  svgContainer.appendChild(g);
  renderChildBlocks(block, svgContainer);
}

export function renderSuperBlock(block, svgContainer) {
  const g = createBlockGroup(block);
  const w = block.width || 140;
  const h = block.height || 50;
  let pathData = `M 0 0 h ${NOTCH_X} ${DENT_PATH} H ${w} v 50 H ${NOTCH_X + 14} ${BOTTOM_NOTCH_PATH} H 0 Z`;
  g.appendChild(createPath(pathData, "#cf63cf", "#a849a8", block));
  g.appendChild(createText("super", block.x + 15, block.y + 30));
  const inlineChild = block.children
    ? block.children.find((c) => c.type.startsWith("op-"))
    : null;
  if (inlineChild) {
    inlineChild.x = block.x + 65;
    inlineChild.y = block.y + 7;
  } else {
    g.appendChild(
      createRect(
        block.x + 65,
        block.y + 10,
        60,
        30,
        15,
        15,
        "#a849a8",
        "#cf63cf",
      ),
    );
  }
  svgContainer.appendChild(g);
  renderChildBlocks(block, svgContainer);
}

export function renderOperatorBlock(block, svgContainer) {
  const g = createBlockGroup(block);
  const w = block.width || 160;
  const h = block.height || 36;

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
  ].includes(block.type);

  if (isBooleanOp) {
    const pw = h * (15 / 36);
    const hexPath = `M 0 ${h / 2} L ${pw} 0 L ${w - pw} 0 L ${w} ${h / 2} L ${w - pw} ${h} L ${pw} ${h} Z`;
    g.appendChild(createPath(hexPath, "#5cb1d6", "#4891b0", block));
  } else {
    const rect = createRect(0, 0, w, h, h / 2, h / 2, "#5cb1d6", "#4891b0");
    rect.setAttribute("transform", `translate(${block.x}, ${block.y})`);
    g.appendChild(rect);
  }

  const inputStyle = `width: 100%; height: 100%; border-radius: 20px; border: 2px solid #4891b0; box-sizing: border-box; text-align: center; font-size: 14px; outline: none; padding: 0 10px; margin: 0; display: block;`;
  const isUnary = ["op-value", "op-inc", "op-dec", "op-not"].includes(
    block.type,
  );

  const isHoleOnlyOp = block.type === "op-and" || block.type === "op-or";
  const edgePadding = isHoleOnlyOp ? 8 : isBooleanOp ? 14 : 8;

  if (isUnary) {
    let prefix = block.type === "op-not" ? "!" : "";
    let suffix =
      block.type === "op-inc" ? "++" : block.type === "op-dec" ? "--" : "";

    if (prefix)
      g.appendChild(
        createText(prefix, block.x + 16, block.y + h / 2 + 5, {
          "font-size": "16px",
        }),
      );

    let leftSpace = prefix ? 28 : edgePadding;
    let rightSpace = suffix ? 35 : edgePadding;

    g.appendChild(
      createForeignObject(
        block.x + leftSpace,
        block.y + (h - 24) / 2,
        w - leftSpace - rightSpace,
        24,
        `<input style="${inputStyle}" data-block-id="${block.id}" data-prop="value" value="${escapeHtml(block.data.value) || ""}" placeholder="..." oninput="window.handlePillInput(this, '${block.id}', 'value')">`,
      ),
    );

    if (suffix)
      g.appendChild(
        createText(suffix, block.x + w - 30, block.y + h / 2 + 5, {
          "font-size": "16px",
        }),
      );
  } else {
    const symbolMap = {
      "op-add": "+",
      "op-sub": "-",
      "op-multi": "*",
      "op-div": "/",
      "op-mod": "%",
      "op-assign": "=",
      "op-less": "<",
      "op-greater": ">",
      "op-less-eq": "<=",
      "op-greater-eq": ">=",
      "op-equals": "==",
      "op-not-equals": "!=",
      "op-and": "&&",
      "op-or": "||",
    };
    const symbol = symbolMap[block.type] || "==";
    const gap = w - block.leftWidth - block.rightWidth;

    let leftChild = block.children
      ? block.children.find((c) => c.slot === "left")
      : null;
    let rightChild = block.children
      ? block.children.find((c) => c.slot === "right")
      : null;

    const isHoleOnlyOp = block.type === "op-and" || block.type === "op-or";

    g.appendChild(
      createText(
        symbol,
        block.x + block.leftWidth + gap / 2,
        block.y + h / 2 + 5,
        { "font-size": "16px", "text-anchor": "middle" },
      ),
    );

    // Helper to draw a hexagonal hole path with concentric diagonal angles
    const getHexHolePath = (relX, relY, hw, hh, blockH) => {
      const pw = 15 * (hh / blockH);
      return `M ${relX} ${relY + hh / 2} L ${relX + pw} ${relY} L ${relX + hw - pw} ${relY} L ${relX + hw} ${relY + hh / 2} L ${relX + hw - pw} ${relY + hh} L ${relX + pw} ${relY + hh} Z`;
    };

    // --- LEFT SLOT ---
    if (leftChild) {
      leftChild.x = block.x + edgePadding;
      leftChild.y = block.y + (h - leftChild.height) / 2;
    } else {
      if (isHoleOnlyOp) {
        // Draw the recessed dark hole at 24px height
        const leftHolePath = getHexHolePath(
          edgePadding,
          (h - 26) / 2,
          block.leftWidth,
          26,
          h,
        );
        g.appendChild(createPath(leftHolePath, "#4891b0", "#5cb1d6", block));
      } else {
        g.appendChild(
          createForeignObject(
            block.x + edgePadding,
            block.y + (h - 26) / 2,
            block.leftWidth,
            26,
            `<input style="${inputStyle}" data-block-id="${block.id}" data-prop="left" placeholder="..." value="${escapeHtml(block.data.left) || ""}" oninput="window.handlePillInput(this, '${block.id}', 'left')">`,
          ),
        );
      }
    }

    // --- RIGHT SLOT ---
    if (rightChild) {
      rightChild.x = block.x + block.leftWidth + gap - edgePadding;
      rightChild.y = block.y + (h - rightChild.height) / 2;
    } else {
      if (isHoleOnlyOp) {
        // Draw the recessed dark hole at 24px height
        const rightHolePath = getHexHolePath(
          block.leftWidth + gap - edgePadding,
          (h - 26) / 2,
          block.rightWidth,
          26,
          h,
        );
        g.appendChild(createPath(rightHolePath, "#4891b0", "#5cb1d6", block));
      } else {
        g.appendChild(
          createForeignObject(
            block.x + block.leftWidth + gap - edgePadding,
            block.y + (h - 26) / 2,
            block.rightWidth,
            26,
            `<input style="${inputStyle}" data-block-id="${block.id}" data-prop="right" placeholder="..." value="${escapeHtml(block.data.right) || ""}" oninput="window.handlePillInput(this, '${block.id}', 'right')">`,
          ),
        );
      }
    }
  }
  svgContainer.appendChild(g);
  renderChildBlocks(block, svgContainer);
}

export function renderReturnBlock(block, svgContainer) {
  const g = createBlockGroup(block);
  const w = block.width || 145;
  const h = block.height || 50;
  let pathData = `M 0 0 h ${NOTCH_X} ${DENT_PATH} H ${w} v 50 H ${NOTCH_X + 14} ${BOTTOM_NOTCH_PATH} H 0 Z`;
  g.appendChild(createPath(pathData, "#FFAB19", "#CF8B17", block));
  g.appendChild(createText("return", block.x + 15, block.y + 30));
  const inlineChild = block.children
    ? block.children.find((c) => c.type.startsWith("op-"))
    : null;
  if (inlineChild) {
    inlineChild.x = block.x + 70;
    inlineChild.y = block.y + 7;
  } else {
    g.appendChild(
      createRect(
        block.x + 70,
        block.y + 10,
        60,
        30,
        15,
        15,
        "#DE9518",
        "#CF8B17",
      ),
    );
  }
  svgContainer.appendChild(g);
  renderChildBlocks(block, svgContainer);
}

export function renderJumpBlock(block, svgContainer) {
  const g = createBlockGroup(block);
  const w = block.width || 90;
  let pathData = `M 0 0 h ${NOTCH_X} ${DENT_PATH} H ${w} v 50 H ${NOTCH_X + 14} ${BOTTOM_NOTCH_PATH} H 0 Z`;
  g.appendChild(createPath(pathData, "#FFAB19", "#CF8B17", block));
  g.appendChild(createText(block.type, block.x + 15, block.y + 30));
  svgContainer.appendChild(g);
}

export function renderControlBlock(block, svgContainer) {
  const inlineChild = block.children
    ? block.children.find((c) => c.type.startsWith("op-"))
    : null;
  const headerH = block.headerHeight || 50;

  let currentY = headerH;
  block.children.forEach((child) => {
    if (!child.type.startsWith("op-")) {
      child.x = block.x + STEM_WIDTH;
      child.y = block.y + currentY;
      currentY += child.totalHeight || child.height || 50;
    }
  });

  if (inlineChild) {
    inlineChild.x = block.x + 85;
    inlineChild.y = block.y + (headerH - inlineChild.height) / 2;
  }

  let innerHeight =
    block.children.filter((c) => !c.type.startsWith("op-")).length > 0
      ? currentY - headerH
      : 30;

  const g = createBlockGroup(block);
  const pathData = `M 0 0 h ${NOTCH_X} ${DENT_PATH} H ${block.width || 320} v ${headerH} H ${TAB_OFFSET + 1} ${NOTCH_PATH} H ${STEM_WIDTH} v ${innerHeight} H ${DENT_START_X} ${FOOTER_DENT_PATH} H ${block.width || 320} v ${FOOTER_HEIGHT} H ${NOTCH_X + 14} ${BOTTOM_NOTCH_PATH} H 0 Z`;
  g.appendChild(createPath(pathData, "#FFAB19", "#CF8B17", block));

  g.appendChild(
    createText(
      block.type.replace("-", " "),
      block.x + 15,
      block.y + headerH / 2 + 5,
    ),
  );

  if (block.type !== "else" && !inlineChild) {
    const isBooleanHole = ["if", "else-if", "while", "do-while"].includes(
      block.type,
    );
    const holeY = block.y + (headerH - 30) / 2;

    if (isBooleanHole) {
      const holePath = `M ${block.x + 85} ${holeY + 15} L ${block.x + 97} ${holeY} L ${block.x + 133} ${holeY} L ${block.x + 145} ${holeY + 15} L ${block.x + 133} ${holeY + 30} L ${block.x + 97} ${holeY + 30} Z`;
      const pathEl = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      pathEl.setAttribute("d", holePath);
      pathEl.setAttribute("fill", "#DE9518");
      pathEl.setAttribute("stroke", "#CF8B17");
      pathEl.setAttribute("stroke-width", "2");
      g.appendChild(pathEl);
    } else {
      g.appendChild(
        createRect(block.x + 85, holeY, 60, 30, 15, 15, "#DE9518", "#CF8B17"),
      );
    }
  }
  svgContainer.appendChild(g);
  renderChildBlocks(block, svgContainer);
}

export function renderForBlock(block, svgContainer) {
  let currentY = HEADER_HEIGHT;
  block.children.forEach((child) => {
    child.x = block.x + STEM_WIDTH;
    child.y = block.y + currentY;
    currentY += child.totalHeight || child.height || 50;
  });
  let innerHeight = block.children.length > 0 ? currentY - HEADER_HEIGHT : 30;
  const g = createBlockGroup(block);
  const w = block.width || 440;
  let pathData = `M 0 0 h ${NOTCH_X} ${DENT_PATH} H ${w} v 50 H ${TAB_OFFSET + 1} ${NOTCH_PATH} H ${STEM_WIDTH} v ${innerHeight} H ${DENT_START_X} ${FOOTER_DENT_PATH} H ${w} v ${FOOTER_HEIGHT} H ${NOTCH_X + 14} ${BOTTOM_NOTCH_PATH} H 0 Z`;
  g.appendChild(createPath(pathData, "#FFAB19", "#CF8B17", block));
  g.appendChild(createText("for", block.x + 15, block.y + 30));
  let currX = block.x + 50;
  g.appendChild(
    createForeignObject(
      currX,
      block.y + 10,
      block.initW || 60,
      30,
      `<input style="width: 100%; height: 100%; box-sizing: border-box; border: 2px solid #CF8B17; border-radius: 15px; padding: 0 10px; font-size: 13px; outline: none; color: #333;" data-block-id="${block.id}" data-prop="Inisialisasi" value="${escapeHtml(block.data.Inisialisasi) || ""}" oninput="handlePillInput(this, '${block.id}', 'Inisialisasi')" placeholder="${t("ph_init")}">`,
    ),
  );
  currX += (block.initW || 60) + 5;
  g.appendChild(
    createForeignObject(
      currX,
      block.y + 10,
      block.condW || 60,
      30,
      `<input style="width: 100%; height: 100%; box-sizing: border-box; border: 2px solid #CF8B17; border-radius: 15px; padding: 0 10px; font-size: 13px; outline: none; color: #333;" data-block-id="${block.id}" data-prop="Kondisi" value="${escapeHtml(block.data.Kondisi) || ""}" oninput="handlePillInput(this, '${block.id}', 'Kondisi')" placeholder="${t("ph_cond")}">`,
    ),
  );
  currX += (block.condW || 60) + 5;
  g.appendChild(
    createForeignObject(
      currX,
      block.y + 10,
      block.updW || 60,
      30,
      `<input style="width: 100%; height: 100%; box-sizing: border-box; border: 2px solid #CF8B17; border-radius: 15px; padding: 0 10px; font-size: 13px; outline: none; color: #333;" data-block-id="${block.id}" data-prop="Update" value="${escapeHtml(block.data.Update) || ""}" oninput="handlePillInput(this, '${block.id}', 'Update')" placeholder="${t("ph_update")}">`,
    ),
  );
  svgContainer.appendChild(g);
  renderChildBlocks(block, svgContainer);
}

export function render() {
  const viewport = document.getElementById("viewport");
  const bgLayer = document.getElementById("bg-pan-layer");
  const ws = getActiveWorkspace();
  if (!ws) return;
  const { blocks, camera } = ws;
  blocks.forEach(computeLayout);
  viewport.innerHTML = `<defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="2" dy="2" stdDeviation="2" flood-opacity="0.3"/></filter></defs>`;
  blocks.forEach((block) => {
    if (block.type === "class") renderClassBlock(block, viewport);
    else if (block.type === "construct")
      renderConstructorBlock(block, viewport);
    else if (block.type === "main-method")
      renderMainMethodBlock(block, viewport);
    else if (block.type === "method") renderMethodBlock(block, viewport);
    else if (block.type === "object-caller")
      renderObjectCallerBlock(block, viewport);
    else if (block.type === "method-call")
      renderMethodCallBlock(block, viewport);
    else if (block.type === "variable") renderVariableBlock(block, viewport);
    else if (block.type === "variable-value")
      renderVariableValueBlock(block, viewport);
    else if (block.type === "parameter") renderParameterBlock(block, viewport);
    else if (block.type === "argument") renderArgumentBlock(block, viewport);
    else if (block.type === "print") renderPrintBlock(block, viewport);
    else if (block.type === "this") renderThisBlock(block, viewport);
    else if (block.type === "super") renderSuperBlock(block, viewport);
    else if (block.type === "prop-assign")
      renderPropAssignBlock(block, viewport);
    else if (block.type === "op-input") renderInputPill(block, viewport);
    else if (block.type === "new-object") renderNewObjectBlock(block, viewport);
    else if (block.type === "extends") renderExtendsBlock(block, viewport);
    else if (block.type === "return") renderReturnBlock(block, viewport);
    else if (block.type === "break" || block.type === "continue")
      renderJumpBlock(block, viewport);
    else if (block.type === "for") renderForBlock(block, viewport);
    else if (block.type.startsWith("op-")) renderOperatorBlock(block, viewport);
    else if (
      ["if", "else-if", "else", "while", "do-while", "switch", "case"].includes(
        block.type,
      )
    ) {
      renderControlBlock(block, viewport);
    } else if (block.type === "interface")
      renderInterfaceBlock(block, viewport);
    else if (block.type === "implements")
      renderImplementsBlock(block, viewport);
    else if (block.type === "interface-method")
      renderInterfaceMethodBlock(block, viewport);
  });
  viewport.setAttribute(
    "transform",
    `translate(${camera.x}, ${camera.y}) scale(${camera.zoom})`,
  );

  if (bgLayer) {
    const isGridHidden = localStorage.getItem("oopify-grid-hidden") === "true";
    bgLayer.setAttribute("fill", isGridHidden ? "none" : "url(#smallGrid)");
  }

  if (window.activeFocus) {
    const input = document.querySelector(
      `input[data-block-id="${window.activeFocus.id}"][data-prop="${window.activeFocus.prop}"]`,
    );
    if (input) {
      input.focus();
      input.setSelectionRange(window.activeFocus.pos, window.activeFocus.pos);
    }
    window.activeFocus = null;
  }
}
