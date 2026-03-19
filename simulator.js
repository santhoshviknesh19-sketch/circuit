const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const clearBtn = document.getElementById('clearBtn');
const checkBtn = document.getElementById('checkBtn');

const TOOL = {
  SELECT: 'select',
  RESISTOR: 'resistor',
  BATTERY: 'battery',
  WIRE: 'wire',
  DELETE: 'delete',
};

const COMPONENT = {
  RESISTOR: 'Resistor',
  BATTERY: 'Battery',
};

const state = {
  tool: TOOL.SELECT,
  components: [],
  wires: [],
  drag: null,
  wireStart: null,
  hoverId: null,
};

const settings = {
  gridSize: 30,
  componentRadius: 28,
  wireColor: '#ffd966',
  componentColor: '#ffffff',
  highlightColor: '#ff6b6b',
  gridColor: 'rgba(255,255,255,0.08)',
};

function resizeCanvas() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  draw();
}

function snapToGrid(value) {
  const { gridSize } = settings;
  return Math.round(value / gridSize) * gridSize;
}

function setTool(tool) {
  state.tool = tool;
  state.wireStart = null;
  document.querySelectorAll('.simulator-toolbar button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
  statusEl.textContent = `Tool: ${tool.charAt(0).toUpperCase() + tool.slice(1)}`;
}

function getPointerPos(evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top,
  };
}

function findComponentAt(point) {
  return state.components.find((comp) => {
    const dx = comp.x - point.x;
    const dy = comp.y - point.y;
    return Math.hypot(dx, dy) < settings.componentRadius;
  });
}

function findWireAt(point) {
  // Basic approximation: check distance to each segment
  for (const wire of state.wires) {
    const a = state.components.find((c) => c.id === wire.from);
    const b = state.components.find((c) => c.id === wire.to);
    if (!a || !b) continue;
    const dist = pointToSegmentDistance(point, a, b);
    if (dist < 8) return wire;
  }
  return null;
}

function pointToSegmentDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

function addComponent(type, x, y) {
  const id = Date.now() + Math.random();
  const value = type === COMPONENT.RESISTOR ? 100 : 5;
  state.components.push({ id, type, x, y, value });
  draw();
}

function addWire(fromId, toId) {
  if (fromId === toId) return;
  if (state.wires.some((w) => (w.from === fromId && w.to === toId) || (w.from === toId && w.to === fromId))) return;
  state.wires.push({ from: fromId, to: toId });
  draw();
}

function removeComponent(id) {
  state.components = state.components.filter((c) => c.id !== id);
  state.wires = state.wires.filter((w) => w.from !== id && w.to !== id);
  draw();
}

function removeWire(id) {
  state.wires = state.wires.filter((w) => w !== id);
  draw();
}

function clearAll() {
  state.components = [];
  state.wires = [];
  state.wireStart = null;
  draw();
}

function drawGrid() {
  const { width, height } = canvas;
  const { gridSize, gridColor } = settings;
  ctx.save();
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWires() {
  ctx.save();
  ctx.strokeStyle = settings.wireColor;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const wire of state.wires) {
    const from = state.components.find((c) => c.id === wire.from);
    const to = state.components.find((c) => c.id === wire.to);
    if (!from || !to) continue;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawComponents() {
  for (const comp of state.components) {
    const isHover = state.hoverId === comp.id;
    ctx.save();
    ctx.translate(comp.x, comp.y);
    ctx.fillStyle = isHover ? settings.highlightColor : settings.componentColor;
    ctx.strokeStyle = isHover ? settings.highlightColor : '#ffffff';
    ctx.lineWidth = isHover ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(-30, -15, 60, 30, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#111';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = comp.type === COMPONENT.RESISTOR ? `R ${comp.value}Ω` : `V ${comp.value}V`;
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawWires();
  drawComponents();
  if (state.wireStart) {
    const from = state.components.find((c) => c.id === state.wireStart);
    if (from) {
      ctx.save();
      ctx.strokeStyle = settings.wireColor;
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(state.drag?.x ?? from.x, state.drag?.y ?? from.y);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function updateHover(pos) {
  state.hoverId = null;
  if (state.tool === TOOL.SELECT || state.tool === TOOL.DELETE || state.tool === TOOL.WIRE) {
    const comp = findComponentAt(pos);
    if (comp) state.hoverId = comp.id;
  }
  draw();
}

function onPointerMove(evt) {
  const pos = getPointerPos(evt);
  if (state.drag && state.tool === TOOL.SELECT) {
    state.drag.x = Math.max(0, Math.min(canvas.width, pos.x + state.drag.offsetX));
    state.drag.y = Math.max(0, Math.min(canvas.height, pos.y + state.drag.offsetY));
    draw();
    return;
  }

  if (state.tool === TOOL.WIRE && state.wireStart) {
    state.drag = { x: pos.x, y: pos.y };
    draw();
    return;
  }

  updateHover(pos);
}

function onPointerDown(evt) {
  evt.preventDefault();
  const pos = getPointerPos(evt);
  const clicked = findComponentAt(pos);

  switch (state.tool) {
    case TOOL.SELECT:
      if (clicked) {
        state.drag = {
          ...clicked,
          offsetX: clicked.x - pos.x,
          offsetY: clicked.y - pos.y,
        };
      }
      break;

    case TOOL.RESISTOR:
      addComponent(COMPONENT.RESISTOR, snapToGrid(pos.x), snapToGrid(pos.y));
      break;

    case TOOL.BATTERY:
      addComponent(COMPONENT.BATTERY, snapToGrid(pos.x), snapToGrid(pos.y));
      break;

    case TOOL.DELETE:
      if (clicked) {
        removeComponent(clicked.id);
      } else {
        const wire = findWireAt(pos);
        if (wire) removeWire(wire);
      }
      break;

    case TOOL.WIRE:
      if (!clicked) return;
      if (!state.wireStart) {
        state.wireStart = clicked.id;
        draw();
        return;
      }
      if (state.wireStart && clicked.id) {
        addWire(state.wireStart, clicked.id);
        state.wireStart = null;
        draw();
      }
      break;
  }
}

function onPointerUp() {
  state.drag = null;
}

function simulateCircuit() {
  const componentCount = state.components.length;
  if (componentCount === 0) {
    statusEl.textContent = `Tool: ${state.tool} — Add components to simulate.`;
    return;
  }

  const adj = new Map();
  state.components.forEach((c) => adj.set(c.id, new Set()));
  state.wires.forEach((w) => {
    if (adj.has(w.from) && adj.has(w.to)) {
      adj.get(w.from).add(w.to);
      adj.get(w.to).add(w.from);
    }
  });

  const visited = new Set();
  const groups = [];

  for (const id of adj.keys()) {
    if (visited.has(id)) continue;
    const stack = [id];
    const group = [];
    visited.add(id);

    while (stack.length) {
      const cur = stack.pop();
      group.push(cur);
      for (const nbr of adj.get(cur) || []) {
        if (!visited.has(nbr)) {
          visited.add(nbr);
          stack.push(nbr);
        }
      }
    }

    groups.push(group);
  }

  const infoParts = groups.map((group, index) => {
    const comps = group
      .map((id) => state.components.find((c) => c.id === id))
      .filter(Boolean);

    const batteries = comps.filter((c) => c.type === COMPONENT.BATTERY);
    const resistors = comps.filter((c) => c.type === COMPONENT.RESISTOR);
    const degrees = group.map((id) => (adj.get(id) ? adj.get(id).size : 0));
    const maxDegree = Math.max(...degrees, 0);

    const totalResistance = resistors.reduce((sum, r) => sum + Number(r.value || 0), 0);
    const totalVoltage = batteries.reduce((sum, b) => sum + Number(b.value || 0), 0);

    const isSeries = maxDegree <= 2;
    const hasBattery = batteries.length === 1;
    const hasResistor = resistors.length >= 1;

    if (!hasBattery) {
      return `Group ${index + 1}: No battery (add a battery to simulate).`;
    }
    if (batteries.length > 1) {
      return `Group ${index + 1}: Multiple batteries (simulation supports one battery).`;
    }
    if (!isSeries) {
      return `Group ${index + 1}: Branching detected (only simple series supported).`;
    }
    if (!hasResistor) {
      return `Group ${index + 1}: No resistors (add resistors to get a meaningful current).`;
    }
    if (totalResistance === 0) {
      return `Group ${index + 1}: Short circuit (zero resistance).`;
    }

    const current = (totalVoltage / totalResistance).toFixed(2);
    return `Group ${index + 1}: I ≈ ${current} A (V=${totalVoltage}V, R=${totalResistance}Ω)`;
  });

  statusEl.textContent = `Tool: ${state.tool} — ${infoParts.join(' | ')}`;
}

function bindEvents() {
  window.addEventListener('resize', resizeCanvas);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);

  document.querySelectorAll('.simulator-toolbar button[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  clearBtn.addEventListener('click', () => {
    clearAll();
    statusEl.textContent = `Tool: ${state.tool}`;
  });

  checkBtn.addEventListener('click', () => simulateCircuit());
}

function init() {
  bindEvents();
  resizeCanvas();
  draw();
}

window.addEventListener('DOMContentLoaded', init);
