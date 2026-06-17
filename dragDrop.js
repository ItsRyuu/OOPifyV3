import {
  dragInfo,
  getActiveWorkspace,
  findBlockAndParent,
  saveState,
} from "./state.js";
import { render, computeLayout } from "./renderer.js";

let isDraggingFrame = false;
let lastDropHash = "";
let renderOffsetX = 0;
let renderOffsetY = 0;

// --- OPTIMIZATION: O(1) Ghost Tracking ---
let activeGhostParent = null;

// --- GHOST HELPERS ---
function clearGhost(blocks) {
  if (activeGhostParent && activeGhostParent.children) {
    const idx = activeGhostParent.children.findIndex(
      (b) => b.id === "ghost-block",
    );
    if (idx !== -1) {
      activeGhostParent.children.splice(idx, 1);
      activeGhostParent = null;
      return true;
    }
  }

  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].id === "ghost-block") {
      blocks.splice(i, 1);
      activeGhostParent = null;
      return true;
    }
    if (blocks[i].children) {
      if (clearGhost(blocks[i].children)) return true;
    }
  }
  return false;
}

function markAsGhost(block) {
  block.isGhost = true;
  if (block.id !== "ghost-block" && !block.id.startsWith("ghost-")) {
    block.id = "ghost-" + block.id;
  }
  if (block.children) block.children.forEach(markAsGhost);
}

function cloneBlockTree(block) {
  const clone = { ...block };
  if (block.data) {
    clone.data = { ...block.data };
  }
  if (block.children) {
    clone.children = block.children.map(cloneBlockTree);
  }
  return clone;
}

// --- CENTRALIZED COLLISION ENGINE ---
function checkHorizontalCollision(subjectBlock, target) {
  const cx = subjectBlock.x + (subjectBlock.width || 120) / 2;
  const cy = subjectBlock.y + 25;

  if (
    subjectBlock.type === "parameter" &&
    (target.type === "construct" ||
      target.type === "method" ||
      target.type === "interface-method")
  ) {
    let chainWidth = target.width || 320;
    target.children.forEach((c) => {
      if (c.type === "parameter" && !c.isGhost) chainWidth += c.width || 220;
    });
    return (
      cy > target.y - 30 &&
      cy < target.y + 80 &&
      cx > target.x &&
      cx < target.x + chainWidth + 150
    );
  }

  if (
    subjectBlock.type === "argument" &&
    (target.type === "print" ||
      target.type === "method-call" ||
      target.type === "new-object")
  ) {
    let chainWidth =
      target.width ||
      (target.type === "this" ? 120 : target.type === "new-object" ? 460 : 350);
    target.children.forEach((c) => {
      let childW = c.width || (c.type === "prop-assign" ? 260 : 120);
      if (!c.isGhost) chainWidth += childW;
    });
    return (
      cy > target.y - 30 &&
      cy < target.y + 80 &&
      cx > target.x &&
      cx < target.x + chainWidth + 150
    );
  }

  if (subjectBlock.type === "method-call" && target.type === "object-caller") {
    let chainWidth = target.width || 140;
    target.children.forEach((c) => {
      let childW = c.width || 140;
      if (!c.isGhost) chainWidth += childW;
    });
    return (
      cy > target.y - 30 &&
      cy < target.y + 80 &&
      cx > target.x &&
      cx < target.x + chainWidth + 150
    );
  }

  if (
    (subjectBlock.type === "extends" &&
      (target.type === "class" || target.type === "interface")) ||
    (subjectBlock.type === "implements" && target.type === "class")
  ) {
    if (subjectBlock.type === "extends") {
      if (target.type === "class") {
        const hasExtends = target.children.some(
          (c) => c.type === "extends" && !c.isGhost && c.id !== subjectBlock.id,
        );
        if (hasExtends) return false;
      }
    }

    let chainWidth = target.width || 320;
    target.children.forEach((c) => {
      if (c.type === "extends" && !c.isGhost) chainWidth += c.width || 180;
      if (c.type === "implements" && !c.isGhost) chainWidth += c.width || 180;
    });
    return (
      cy > target.y - 30 &&
      cy < target.y + 80 &&
      cx > target.x &&
      cx < target.x + chainWidth + 150
    );
  }

  return false;
}

function checkInlineCollision(subjectBlock, target) {
  const cx = subjectBlock.x + (subjectBlock.width || 160) / 2;
  const cy = subjectBlock.y + 20;

  // RULE A: Standard Control/Statement Receptacles (if, while, return, variable assignment)
  const validTargets = [
    "if",
    "else-if",
    "while",
    "do-while",
    "switch",
    "case",
    "return",
    "this",
    "super",
    "argument",
    "prop-assign",
    "variable-value",
  ];

  if (validTargets.includes(target.type)) {
    if (
      (target.type === "this" || target.type === "super") &&
      subjectBlock.type !== "op-value" &&
      subjectBlock.type !== "op-assign"
    ) {
      return false;
    }

    // Prevent boolean operators in Switch and Case ---
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
    ].includes(subjectBlock.type);

    if (isBooleanOp && (target.type === "switch" || target.type === "case")) {
      return false;
    }

    // Prevent arithmetic operators in If Elif ---
    const isTargetMath = [
      "op-add",
      "op-sub",
      "op-multi",
      "op-div",
      "op-mod",
      "op-assign",
    ].includes(subjectBlock.type);

    if (isTargetMath && (target.type === "if" || target.type === "else-if")) {
      return false;
    }

    const headerH = target.headerHeight || 50;
    if (
      cx > target.x &&
      cx < target.x + (target.width || 320) &&
      cy > target.y &&
      cy < target.y + headerH
    ) {
      const hasOp =
        target.children &&
        target.children.some(
          (c) =>
            c.type.startsWith("op-") && !c.isGhost && c.id !== subjectBlock.id,
        );
      if (!hasOp) return { hit: true, slot: "inline" };
    }
  }

  // RULE B: Dropping INTO another binary Operator
  const isUnary = [
    "op-value",
    "op-inc",
    "op-dec",
    "op-not",
    "op-input",
  ].includes(target.type);

  if (target.type.startsWith("op-") && !isUnary) {
    // STRICT SHAPE TYPING LOGIC
    const isSubjectHex = [
      "op-less",
      "op-greater",
      "op-less-eq",
      "op-greater-eq",
      "op-equals",
      "op-not-equals",
      "op-and",
      "op-or",
      "op-not",
    ].includes(subjectBlock.type);
    const isTargetMath = [
      "op-add",
      "op-sub",
      "op-multi",
      "op-div",
      "op-mod",
      "op-assign",
    ].includes(target.type);
    const isTargetLogic = ["op-and", "op-or"].includes(target.type);

    // 1. Prevent Diagonals (Booleans) from going into Math operations
    if (isSubjectHex && isTargetMath) return false;

    // 2. Prevent Pills (Values) from going into Logical operations (&&, ||)
    if (!isSubjectHex && isTargetLogic) return false;

    if (cy > target.y && cy < target.y + (target.height || 40)) {
      // Left Hole Collision Detection
      if (cx > target.x && cx < target.x + (target.leftWidth || 60)) {
        const leftOccupied =
          target.children &&
          target.children.some(
            (c) => c.slot === "left" && !c.isGhost && c.id !== subjectBlock.id,
          );
        if (!leftOccupied) return { hit: true, slot: "left" };
      }

      // Right Hole Collision Detection
      const rightStartX =
        target.x + (target.width || 160) - (target.rightWidth || 60);
      if (cx > rightStartX && cx < target.x + (target.width || 160)) {
        const rightOccupied =
          target.children &&
          target.children.some(
            (c) => c.slot === "right" && !c.isGhost && c.id !== subjectBlock.id,
          );
        if (!rightOccupied) return { hit: true, slot: "right" };
      }
    }
  }

  return false;
}

function checkVerticalCollision(subjectBlock, target) {
  if (subjectBlock.type === "class") return false;

  const sh = subjectBlock.totalHeight || subjectBlock.height || 50;
  const sw = subjectBlock.width || 320;
  const cx = subjectBlock.x + sw / 2;
  const cy = subjectBlock.y + sh / 2;

  let canDrop = false;

  if (
    ["construct", "main-method", "method"].includes(subjectBlock.type) &&
    target.type === "class"
  ) {
    canDrop = true;
  }

  if (
    subjectBlock.type === "interface-method" &&
    target.type === "class" &&
    target.data &&
    target.data.isAbstract === true
  ) {
    canDrop = true;
  }

  const isVariableContainer = [
    "class",
    "construct",
    "main-method",
    "method",
    "if",
    "else-if",
    "else",
    "for",
    "while",
    "do-while",
    "switch",
    "case",
  ].includes(target.type);

  if (
    ["variable", "variable-value"].includes(subjectBlock.type) &&
    isVariableContainer
  ) {
    canDrop = true;
  }

  const isStatement = [
    "argument",
    "print",
    "this",
    "super",
    "object-caller",
    "new-object",
    "return",
    "break",
    "continue",
    "prop-assign",
  ].includes(subjectBlock.type);
  const isControl = [
    "if",
    "else-if",
    "else",
    "switch",
    "case",
    "for",
    "while",
    "do-while",
  ].includes(subjectBlock.type);
  const isContainer = [
    "construct",
    "main-method",
    "method",
    "if",
    "else-if",
    "else",
    "switch",
    "case",
    "for",
    "while",
    "do-while",
  ].includes(target.type);

  if ((isStatement || isControl) && isContainer) {
    canDrop = true;
  }

  if (
    ["variable", "variable-value", "interface-method"].includes(
      subjectBlock.type,
    ) &&
    target.type === "interface"
  ) {
    canDrop = true;
  }

  if (canDrop) {
    const th = target.totalHeight || target.height || 50;
    const tw = Math.max(target.width || 320, sw);

    return (
      cx > target.x - 20 &&
      cx < target.x + tw + 20 &&
      cy > target.y - 10 &&
      cy < target.y + th + 10
    );
  }

  return false;
}

function calculateDropIndex(hitContainer, subjectBlock) {
  if (!hitContainer.children) hitContainer.children = [];
  let insertIndex = hitContainer.children.length;

  const isHorizontalChild =
    ["parameter", "extends", "implements", "method-call"].includes(
      subjectBlock.type,
    ) ||
    (subjectBlock.type === "argument" &&
      [
        "print",
        "this",
        "super",
        "method-call",
        "new-object",
        "return",
      ].includes(hitContainer.type));

  if (isHorizontalChild) {
    if (subjectBlock.type === "extends") {
      let targetIdx = 0;
      for (let i = 0; i < hitContainer.children.length; i++) {
        const c = hitContainer.children[i];
        if (c.isGhost) continue;
        if (c.type === "extends") targetIdx = i + 1;
        else {
          targetIdx = i;
          break;
        }
      }
      return targetIdx;
    }

    if (subjectBlock.type === "implements") {
      let targetIdx = 0;
      for (let i = 0; i < hitContainer.children.length; i++) {
        const c = hitContainer.children[i];
        if (c.isGhost) continue;
        if (c.type === "extends" || c.type === "implements") targetIdx = i + 1;
        else {
          targetIdx = i;
          break;
        }
      }
      return targetIdx;
    }

    const cx = subjectBlock.x + (subjectBlock.width || 120) / 2;
    let foundIndex = -1;
    for (let i = 0; i < hitContainer.children.length; i++) {
      const child = hitContainer.children[i];
      if (
        ["parameter", "argument", "method-call"].includes(child.type) &&
        !child.isGhost
      ) {
        const childCx = child.x + (child.width || 120) / 2;
        if (cx < childCx) {
          foundIndex = i;
          break;
        }
      }
    }

    if (foundIndex !== -1) {
      insertIndex = foundIndex;
    } else {
      let lastParamIdx = -1;
      for (let i = 0; i < hitContainer.children.length; i++) {
        const child = hitContainer.children[i];
        if (
          ["parameter", "argument", "method-call"].includes(child.type) &&
          !child.isGhost
        ) {
          lastParamIdx = i;
        }
      }
      insertIndex = lastParamIdx !== -1 ? lastParamIdx + 1 : 0;
    }
  } else {
    const cy =
      subjectBlock.y +
      (subjectBlock.totalHeight || subjectBlock.height || 50) / 2;
    for (let i = 0; i < hitContainer.children.length; i++) {
      const child = hitContainer.children[i];
      const isHorizontal =
        child.type === "parameter" ||
        child.type === "extends" ||
        child.type === "implements" ||
        (child.type === "argument" &&
          ["print", "this"].includes(hitContainer.type));

      if (!isHorizontal && !child.isGhost) {
        const childCy = child.y + (child.totalHeight || child.height || 50) / 2;
        if (cy < childCy) {
          insertIndex = i;
          break;
        }
      }
    }
  }

  return insertIndex;
}

// 🔴 UPGRADED: Now extracts slot data from inline collisions
export function getDropDetails(blocks, subjectBlock) {
  let hitContainer = null;
  let targetSlot = null;

  const isHorizontal = [
    "parameter",
    "argument",
    "extends",
    "implements",
    "method-call",
  ].includes(subjectBlock.type);
  const isInline = subjectBlock.type.startsWith("op-");

  const traverseAndCheck = (list) => {
    list.forEach((target) => {
      if (target.id === subjectBlock.id || target.id === "ghost-block") return;

      let hasCollision = false;
      if (isHorizontal) {
        hasCollision = checkHorizontalCollision(subjectBlock, target);
      } else if (isInline) {
        let res = checkInlineCollision(subjectBlock, target);
        if (res && res.hit) {
          hasCollision = true;
          targetSlot = res.slot;
        }
      } else {
        hasCollision = checkVerticalCollision(subjectBlock, target);
      }

      if (hasCollision) hitContainer = target;

      if (target.children && target.children.length > 0) {
        traverseAndCheck(target.children);
      }
    });
  };

  traverseAndCheck(blocks);

  if (!hitContainer) return null;

  return {
    container: hitContainer,
    index: calculateDropIndex(hitContainer, subjectBlock),
    slot: targetSlot, // NEW! Passed up for the layout engine
  };
}

// --- STANDARD EXPORTS ---
export function startSpawn(evt, type) {
  if (evt.button !== 0) return;

  evt.preventDefault();
  const svg = document.getElementById("svg-canvas");
  const camera = getActiveWorkspace().camera;

  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
  const spawnX = (svgP.x - camera.x) / camera.zoom;
  const spawnY = (svgP.y - camera.y) / camera.zoom;

  const id = type + "-" + Date.now();
  let newBlock;
  if (type === "class")
    newBlock = {
      id: id,
      type: "class",
      x: spawnX - 100,
      y: spawnY - 25,
      width: 320,
      totalHeight: 100,
      data: { access: "", name: "" },
      children: [],
    };
  else if (type === "construct")
    newBlock = {
      id: id,
      type: "construct",
      x: spawnX - 100,
      y: spawnY - 25,
      width: 320,
      totalHeight: 100,
      data: { access: "public", name: "Main" },
      children: [],
    };
  else if (type === "main-method")
    newBlock = {
      id: id,
      type: "main-method",
      x: spawnX - 100,
      y: spawnY - 25,
      width: 320,
      totalHeight: 100,
      data: {},
      children: [],
    };
  else if (type === "variable-value")
    newBlock = {
      id: id,
      type: "variable-value",
      x: spawnX - 235,
      y: spawnY - 25,
      width: 470,
      height: 50,
      data: { access: "", type: "int", name: "", value: "" },
      children: [],
    };
  else if (type === "parameter")
    newBlock = {
      id: id,
      type: "parameter",
      x: spawnX - 110,
      y: spawnY - 25,
      width: 220,
      height: 50,
      data: { type: "int", name: "" },
      children: [],
    };
  else if (type === "argument")
    newBlock = {
      id: id,
      type: "argument",
      x: spawnX - 60,
      y: spawnY - 25,
      width: 120,
      height: 50,
      data: { name: "" },
      children: [],
    };
  else if (type === "print")
    newBlock = {
      id: id,
      type: "print",
      x: spawnX - 175,
      y: spawnY - 25,
      width: 350,
      height: 50,
      data: { value: "" },
      children: [],
    };
  else if (type === "this" || type === "super")
    newBlock = {
      id: id,
      type: type,
      x: spawnX - 60,
      y: spawnY - 25,
      width: 120,
      height: 50,
      data: {},
      children: [],
    };
  else if (type === "return")
    newBlock = {
      id: id,
      type: "return",
      x: spawnX - 40,
      y: spawnY - 25,
      width: 80,
      height: 50,
      data: {},
      children: [],
    };
  else if (type === "method")
    newBlock = {
      id: id,
      type: "method",
      x: spawnX - 100,
      y: spawnY - 25,
      width: 320,
      totalHeight: 100,
      data: { access: "public", returnType: "void", name: "" },
      children: [],
    };
  else if (type === "method-call")
    newBlock = {
      id: id,
      type: "method-call",
      x: spawnX - 175,
      y: spawnY - 25,
      width: 350,
      height: 50,
      data: { objectName: "", methodName: "" },
      children: [],
    };
  else if (type === "prop-assign")
    newBlock = {
      id: id,
      type: "prop-assign",
      x: spawnX - 115,
      y: spawnY - 25,
      width: 230,
      height: 50,
      data: { name: "", value: "" },
      children: [],
    };
  else if (type === "new-object")
    newBlock = {
      id: id,
      type: "new-object",
      x: spawnX - 230,
      y: spawnY - 25,
      width: 460,
      height: 50,
      data: { classRef: "", objName: "myObj", classObj: "" },
      children: [],
    };
  else if (type === "object-caller")
    newBlock = {
      id: id,
      type: "object-caller",
      x: spawnX - 70,
      y: spawnY - 25,
      width: 140,
      height: 50,
      data: { objectName: "" },
      children: [],
    };
  else if (type === "extends")
    newBlock = {
      id: id,
      type: "extends",
      x: spawnX - 90,
      y: spawnY - 25,
      width: 180,
      height: 50,
      data: { superClass: "" },
      children: [],
    };
  else if (["if", "else-if", "while", "switch", "case"].includes(type))
    newBlock = {
      id: id,
      type: type,
      x: spawnX - 100,
      y: spawnY - 25,
      width: 320,
      totalHeight: 100,
      data: { condition: "" },
      children: [],
    };
  else if (type === "else" || type === "do-while")
    newBlock = {
      id: id,
      type: type,
      x: spawnX - 100,
      y: spawnY - 25,
      width: 320,
      totalHeight: 100,
      data: {},
      children: [],
    };
  else if (type === "for")
    newBlock = {
      id: id,
      type: type,
      x: spawnX - 150,
      y: spawnY - 25,
      width: 440,
      totalHeight: 100,
      data: { init: "int i = 0", condition: "i < 10", update: "i++" },
      children: [],
    };
  else if (type === "break" || type === "continue")
    newBlock = {
      id: id,
      type: type,
      x: spawnX - 40,
      y: spawnY - 25,
      width: 90,
      height: 50,
      data: {},
      children: [],
    };
  else if (type === "op-input")
    newBlock = {
      id: id,
      type: "op-input",
      x: spawnX - 70,
      y: spawnY - 20,
      width: 145,
      height: 40,
      data: { type: "String" },
      children: [],
    };
  else if (type.startsWith("op-")) {
    const isUnary = ["op-value", "op-inc", "op-dec", "op-not"].includes(type);
    let data = isUnary ? { value: "" } : { left: "", right: "" };
    newBlock = {
      id: id,
      type: type,
      x: spawnX - 80,
      y: spawnY - 20,
      width: 160,
      height: 40,
      data: data,
      children: [],
    };
  } else if (type === "interface")
    newBlock = {
      id: id,
      type: "interface",
      x: spawnX - 100,
      y: spawnY - 25,
      width: 320,
      totalHeight: 100,
      data: { name: "" },
      children: [],
    };
  else if (type === "implements")
    newBlock = {
      id: id,
      type: "implements",
      x: spawnX - 90,
      y: spawnY - 25,
      width: 180,
      height: 50,
      data: { interfaces: "" },
      children: [],
    };
  else if (type === "interface-method")
    newBlock = {
      id: id,
      type: "interface-method",
      x: spawnX - 100,
      y: spawnY - 25,
      width: 320,
      height: 50,
      data: { returnType: "void", name: "" },
      children: [],
    };
  else
    newBlock = {
      id: id,
      type: "variable",
      x: spawnX - 175,
      y: spawnY - 25,
      width: 350,
      height: 50,
      data: { access: "", type: "int", name: "" },
    };

  getActiveWorkspace().blocks.push(newBlock);
  dragInfo.isDraggingBlock = true;
  dragInfo.blockId = id;
  dragInfo.parentId = null;
  dragInfo.startX = evt.clientX;
  dragInfo.startY = evt.clientY;
  dragInfo.isNewSpawn = true;
  render();
}

export function startDrag(evt, blockId, parentId) {
  if (evt.button !== 0) return;
  if (evt.target.tagName === "SELECT" || evt.target.tagName === "INPUT") return;
  evt.stopPropagation();

  document.body.classList.add("is-dragging");

  const ws = getActiveWorkspace();
  if (parentId && parentId !== "null") {
    const result = findBlockAndParent(ws.blocks, blockId);
    if (result && result.parent) {
      result.parent.children = result.parent.children.filter(
        (b) => b.id !== blockId,
      );
      ws.blocks.push(result.block);
    }
  }
  dragInfo.isDraggingBlock = true;
  dragInfo.blockId = blockId;
  dragInfo.parentId = null;
  dragInfo.startX = evt.clientX;
  dragInfo.startY = evt.clientY;
  dragInfo.isNewSpawn = false;
  render();
}

export function setupDragListeners() {
  const svg = document.getElementById("svg-canvas");
  const bgLayer = document.getElementById("bg-pan-layer");
  const trashZone = document.getElementById("trash-zone");

  bgLayer.addEventListener("mousedown", (evt) => {
    if (evt.button === 2) return;
    dragInfo.isPanning = true;
    dragInfo.startX = evt.clientX;
    dragInfo.startY = evt.clientY;
    svg.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (evt) => {
    if (isDraggingFrame) return;
    isDraggingFrame = true;

    requestAnimationFrame(() => {
      const dx = evt.clientX - dragInfo.startX;
      const dy = evt.clientY - dragInfo.startY;
      const ws = getActiveWorkspace();

      if (dragInfo.isPanning) {
        ws.camera.x += dx;
        ws.camera.y += dy;
        dragInfo.startX = evt.clientX;
        dragInfo.startY = evt.clientY;
        const viewport = document.getElementById("viewport");
        if (viewport) {
          viewport.setAttribute(
            "transform",
            `translate(${ws.camera.x}, ${ws.camera.y}) scale(${ws.camera.zoom})`,
          );
        }
        isDraggingFrame = false;
        return;
      }

      if (!dragInfo.isDraggingBlock) {
        isDraggingFrame = false;
        return;
      }

      const scaledDx = dx / ws.camera.zoom;
      const scaledDy = dy / ws.camera.zoom;

      const subjectBlock = ws.blocks.find((b) => b.id === dragInfo.blockId);
      if (!subjectBlock) {
        isDraggingFrame = false;
        return;
      }

      subjectBlock.x += scaledDx;
      subjectBlock.y += scaledDy;
      dragInfo.startX = evt.clientX;
      dragInfo.startY = evt.clientY;

      const trashZone = document.getElementById("trash-zone");
      const tRect = trashZone.getBoundingClientRect();
      const isOverTrash =
        evt.clientX >= tRect.left &&
        evt.clientX <= tRect.right &&
        evt.clientY >= tRect.top &&
        evt.clientY <= tRect.bottom;

      if (isOverTrash) trashZone.classList.add("drag-over");
      else trashZone.classList.remove("drag-over");

      const hadGhost = clearGhost(ws.blocks);
      let drop = getDropDetails(ws.blocks, subjectBlock);

      // Unique hash tracking to detect if the mouse moved to a different slot!
      let currentDropHash = drop
        ? `${drop.container.id}-${drop.index}-${drop.slot || "none"}`
        : "none";
      let stateHash =
        currentDropHash + "-" + (isOverTrash ? "trash" : "canvas");

      const insertGhost = () => {
        if (!isOverTrash && drop) {
          const ghostBlock = cloneBlockTree(subjectBlock);
          ghostBlock.id = "ghost-block";
          markAsGhost(ghostBlock);

          // 🔴 UPGRADED: Inherit the math/logic slot property dynamically so it visually snaps to left or right!
          if (drop.slot) ghostBlock.slot = drop.slot;

          drop.container.children.splice(drop.index, 0, ghostBlock);
          activeGhostParent = drop.container;
        }
      };

      if (stateHash !== lastDropHash) {
        insertGhost();
        ws.blocks.forEach(computeLayout);
        render();
        lastDropHash = stateHash;
        renderOffsetX = 0;
        renderOffsetY = 0;
      } else {
        if (hadGhost) insertGhost();
        renderOffsetX += scaledDx;
        renderOffsetY += scaledDy;

        function moveVisualTree(block) {
          const group = document.querySelector(`g[data-id="${block.id}"]`);
          if (group)
            group.setAttribute(
              "transform",
              `translate(${renderOffsetX}, ${renderOffsetY})`,
            );
          if (block.children) block.children.forEach(moveVisualTree);
        }
        moveVisualTree(subjectBlock);
      }
      isDraggingFrame = false;
    });
  });

  window.addEventListener("mouseup", (evt) => {
    lastDropHash = "";
    renderOffsetX = 0;
    renderOffsetY = 0;
    activeGhostParent = null;

    document.body.classList.remove("is-dragging");

    if (dragInfo.isPanning) {
      dragInfo.isPanning = false;
      svg.style.cursor = "default";
      saveState();
      return;
    }
    if (!dragInfo.isDraggingBlock) return;

    const ws = getActiveWorkspace();
    const subjectBlock = ws.blocks.find((b) => b.id === dragInfo.blockId);
    if (!subjectBlock) {
      dragInfo.isDraggingBlock = false;
      return;
    }

    clearGhost(ws.blocks);

    const tRect = trashZone.getBoundingClientRect();
    if (
      evt.clientX >= tRect.left &&
      evt.clientX <= tRect.right &&
      evt.clientY >= tRect.top &&
      evt.clientY <= tRect.bottom
    ) {
      const deletedName = subjectBlock.data.name;
      const isBlueprint =
        subjectBlock.type === "class" || subjectBlock.type === "interface";
      ws.blocks = ws.blocks.filter((b) => b.id !== subjectBlock.id);

      if (isBlueprint && deletedName) {
        if (window.cascadeDeleteBlueprint)
          window.cascadeDeleteBlueprint(deletedName);
      }

      trashZone.classList.remove("drag-over");
      dragInfo.isDraggingBlock = false;
      ws.blocks.forEach(computeLayout);
      render();
      saveState();
      return;
    }

    let drop = getDropDetails(ws.blocks, subjectBlock);
    if (drop) {
      ws.blocks = ws.blocks.filter((b) => b.id !== subjectBlock.id);

      // 🔴 UPGRADED: Bind the real block to the left or right side of the parent equation permanently!
      if (drop.slot) subjectBlock.slot = drop.slot;
      else delete subjectBlock.slot; // Clean up old data if moved to a generic hole

      drop.container.children.splice(drop.index, 0, subjectBlock);

      // --- SMART STATE AUTO-CORRECTION ---
      const parentName = drop.container.data ? drop.container.data.name : null;

      if (subjectBlock.type === "extends") {
        const isParentInterface = drop.container.type === "interface";
        const defaultVal = isParentInterface ? "Interface" : "Object";
        const currentVal = subjectBlock.data.superClass;

        if (
          !currentVal ||
          currentVal === parentName ||
          currentVal === defaultVal ||
          currentVal === "Superclass"
        ) {
          const possibleTargets = ws.blocks.filter(
            (b) =>
              b.type === (isParentInterface ? "interface" : "class") &&
              b.id !== drop.container.id &&
              b.data.name,
          );
          subjectBlock.data.superClass =
            possibleTargets.length > 0
              ? possibleTargets[possibleTargets.length - 1].data.name
              : defaultVal;
        } else {
          const targetRef = ws.blocks.find((b) => b.data.name === currentVal);
          if (
            !targetRef ||
            targetRef.type !== (isParentInterface ? "interface" : "class")
          ) {
            subjectBlock.data.superClass = defaultVal;
          }
        }
      } else if (subjectBlock.type === "implements") {
        const currentVal = subjectBlock.data.interfaces;
        if (
          !currentVal ||
          currentVal === parentName ||
          currentVal === "Interface"
        ) {
          const possibleInterfaces = ws.blocks.filter(
            (b) =>
              b.type === "interface" &&
              b.id !== drop.container.id &&
              b.data.name,
          );
          subjectBlock.data.interfaces =
            possibleInterfaces.length > 0
              ? possibleInterfaces[possibleInterfaces.length - 1].data.name
              : "Interface";
        } else {
          const targetRef = ws.blocks.find((b) => b.data.name === currentVal);
          if (!targetRef || targetRef.type !== "interface")
            subjectBlock.data.interfaces = "Interface";
        }
      } else if (subjectBlock.type === "new-object") {
        const currentRef = subjectBlock.data.classRef;
        const currentObj = subjectBlock.data.classObj;
        const possibleRefs = ws.blocks.filter(
          (b) =>
            (b.type === "class" || b.type === "interface") &&
            b.data.name !== parentName,
        );
        const possibleObjs = ws.blocks.filter(
          (b) => b.type === "class" && b.data.name !== parentName,
        );

        if (!currentRef || currentRef === "Object" || currentRef === "Main") {
          subjectBlock.data.classRef =
            possibleRefs.length > 0
              ? possibleRefs[possibleRefs.length - 1].data.name
              : "Object";
        } else {
          const targetRef = ws.blocks.find((b) => b.data.name === currentRef);
          if (
            !targetRef ||
            (targetRef.type !== "class" && targetRef.type !== "interface")
          )
            subjectBlock.data.classRef = "Object";
        }

        if (!currentObj || currentObj === "Object" || currentObj === "Main") {
          const refTarget = ws.blocks.find(
            (b) => b.data.name === subjectBlock.data.classRef,
          );
          if (refTarget && refTarget.type === "class") {
            subjectBlock.data.classObj = refTarget.data.name;
          } else {
            subjectBlock.data.classObj =
              possibleObjs.length > 0
                ? possibleObjs[possibleObjs.length - 1].data.name
                : "Object";
          }
        } else {
          const targetObj = ws.blocks.find((b) => b.data.name === currentObj);
          if (!targetObj || targetObj.type !== "class")
            subjectBlock.data.classObj = "Object";
        }
      } else if (
        subjectBlock.type === "class" ||
        subjectBlock.type === "interface"
      ) {
        const newName = subjectBlock.data.name;
        if (newName) {
          const scanAndAssignOrphans = (blocks) => {
            blocks.forEach((b) => {
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
                  parentRes.parent.id !== subjectBlock.id
                ) {
                  const isParentInterface =
                    parentRes.parent.type === "interface";
                  if (isParentInterface && subjectBlock.type === "interface")
                    b.data.superClass = newName;
                  else if (!isParentInterface && subjectBlock.type === "class")
                    b.data.superClass = newName;
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
                  parentRes.parent.id !== subjectBlock.id
                ) {
                  if (subjectBlock.type === "interface")
                    b.data.interfaces = newName;
                }
              }
              if (b.type === "new-object") {
                if (
                  !b.data.classRef ||
                  b.data.classRef === "Object" ||
                  b.data.classRef === "Main"
                )
                  b.data.classRef = newName;
                if (
                  !b.data.classObj ||
                  b.data.classObj === "Object" ||
                  b.data.classObj === "Main"
                ) {
                  if (subjectBlock.type === "class") b.data.classObj = newName;
                }
              }
              if (b.children) scanAndAssignOrphans(b.children);
            });
          };
          scanAndAssignOrphans(ws.blocks);
        }
      }
    } else {
      // 🔴 UPGRADED: If you rip an operator out and drop it on the canvas, scrub its slot data so it becomes independent again!
      delete subjectBlock.slot;
    }

    dragInfo.isDraggingBlock = false;
    dragInfo.blockId = null;
    dragInfo.parentId = null;
    dragInfo.isNewSpawn = false;

    ws.blocks.forEach(computeLayout);
    render();
    saveState();
  });

  let zoomTimeout;
  svg.addEventListener("wheel", (evt) => {
    evt.preventDefault();
    const ws = getActiveWorkspace();
    const scaleAmount = -evt.deltaY * 0.001;
    const newZoom = ws.camera.zoom * (1 + scaleAmount);
    if (newZoom < 0.1 || newZoom > 5) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = evt.clientX - rect.left;
    const mouseY = evt.clientY - rect.top;
    const worldMouseX = (mouseX - ws.camera.x) / ws.camera.zoom;
    const worldMouseY = (mouseY - ws.camera.y) / ws.camera.zoom;
    ws.camera.zoom = newZoom;
    ws.camera.x = mouseX - worldMouseX * newZoom;
    ws.camera.y = mouseY - worldMouseY * newZoom;

    const viewport = document.getElementById("viewport");
    if (viewport) {
      viewport.setAttribute(
        "transform",
        `translate(${ws.camera.x}, ${ws.camera.y}) scale(${ws.camera.zoom})`,
      );
    }

    clearTimeout(zoomTimeout);
    zoomTimeout = setTimeout(() => {
      saveState();
    }, 300);
  });
}
