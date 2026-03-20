const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const clearBtn = document.getElementById('clearBtn');
const checkBtn = document.getElementById('checkBtn');

const TOOL = {
  SELECT: 'select',
  RESISTOR: 'resistor',
  BATTERY: 'battery',
  NODE: 'node',
  WIRE: 'wire',
  DELETE: 'delete',
};

const COMPONENT = {
  RESISTOR: 'Resistor',
  BATTERY: 'Battery',
  NODE: 'Node',
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
  terminalOffset: 30,
  terminalRadius: 6,
  nodeRadius: 10,
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
    const radius = comp.type === COMPONENT.NODE ? settings.nodeRadius : settings.componentRadius;
    return Math.hypot(dx, dy) < radius;
  });
}

function getComponentTerminalPos(comp, terminalIndex) {
  if (comp.type === COMPONENT.NODE) {
    return { x: comp.x, y: comp.y };
  }
  const offset = settings.terminalOffset;
  const dx = terminalIndex === 0 ? -offset : offset;
  return { x: comp.x + dx, y: comp.y };
}

function getNearestTerminal(comp, point) {
  if (!comp) return null;
  if (comp.type === COMPONENT.NODE) return { compId: comp.id, terminal: 0 };

  const t0 = getComponentTerminalPos(comp, 0);
  const t1 = getComponentTerminalPos(comp, 1);
  const d0 = Math.hypot(t0.x - point.x, t0.y - point.y);
  const d1 = Math.hypot(t1.x - point.x, t1.y - point.y);
  return { compId: comp.id, terminal: d0 <= d1 ? 0 : 1 };
}

function findTerminalAt(point) {
  let best = null;
  let bestDist = Infinity;
  const threshold = settings.terminalRadius + 6;

  for (const comp of state.components) {
    const terminals = comp.type === COMPONENT.NODE ? [0] : [0, 1];
    for (const t of terminals) {
      const pos = getComponentTerminalPos(comp, t);
      const dist = Math.hypot(pos.x - point.x, pos.y - point.y);
      if (dist < threshold && dist < bestDist) {
        bestDist = dist;
        best = { compId: comp.id, terminal: t };
      }
    }
  }

  return best;
}

function endpointKey(endpoint) {
  return `${endpoint.compId}:${endpoint.terminal}`;
}

function getEndpointPos(endpoint) {
  const comp = state.components.find((c) => c.id === endpoint.compId);
  if (!comp) return null;
  return getComponentTerminalPos(comp, endpoint.terminal);
}

function findWireAt(point) {
  // Basic approximation: check distance to each segment
  for (const wire of state.wires) {
    const a = getEndpointPos(wire.from);
    const b = getEndpointPos(wire.to);
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

function addComponent(type, x, y, value) {
  const id = Date.now() + Math.random();
  const defaultValue =
    type === COMPONENT.RESISTOR ? 100 :
    type === COMPONENT.BATTERY ? 5 :
    undefined;
  const component = { id, type, x, y, value: value ?? defaultValue };
  state.components.push(component);
  draw();
  return component;
}

function parseValueInput(input, defaultValue) {
  if (input == null) return defaultValue;
  const cleaned = String(input)
    .trim()
    .replace(/,/g, '.')
    .replace(/Ω|ohm|ohms|v/gi, '')
    .trim();

  const match = cleaned.match(/^([+-]?\d*\.?\d+)([kKmMuUnNpP]?)/);
  if (!match) return defaultValue;

  let value = parseFloat(match[1]);
  if (Number.isNaN(value)) return defaultValue;

  const suffix = match[2];
  const multipliers = {
    k: 1e3,
    K: 1e3,
    m: 1e-3,
    M: 1e6,
    u: 1e-6,
    µ: 1e-6,
    n: 1e-9,
    N: 1e-9,
    p: 1e-12,
    P: 1e-12,
  };

  if (suffix && multipliers[suffix] !== undefined) {
    value *= multipliers[suffix];
  }

  return value;
}

function promptEditComponentValue(comp) {
  if (!comp || comp.type === COMPONENT.NODE) return;
  const label = comp.type === COMPONENT.RESISTOR ? 'Resistance (Ω)' : 'Voltage (V)';
  const current = comp.value ?? (comp.type === COMPONENT.RESISTOR ? 100 : 5);
  const input = prompt(`Set ${label}:`, current);
  if (input === null) return;
  const parsed = parseValueInput(input, current);
  if (Number.isNaN(parsed) || parsed < 0) return;
  comp.value = parsed;
  draw();
}

function addWire(from, to) {
  if (!from || !to) return;
  const fromKey = endpointKey(from);
  const toKey = endpointKey(to);
  if (fromKey === toKey) return;
  if (
    state.wires.some(
      (w) =>
        (endpointKey(w.from) === fromKey && endpointKey(w.to) === toKey) ||
        (endpointKey(w.from) === toKey && endpointKey(w.to) === fromKey)
    )
  )
    return;
  state.wires.push({ from, to });
  draw();
}

function removeComponent(id) {
  state.components = state.components.filter((c) => c.id !== id);
  state.wires = state.wires.filter(
    (w) => w.from.compId !== id && w.to.compId !== id
  );
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
    const fromPos = getEndpointPos(wire.from);
    const toPos = getEndpointPos(wire.to);
    if (!fromPos || !toPos) continue;
    ctx.beginPath();
    ctx.moveTo(fromPos.x, fromPos.y);
    ctx.lineTo(toPos.x, toPos.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawComponents() {
  for (const comp of state.components) {
    const isHover = state.hoverId === comp.id;

    ctx.save();
    ctx.translate(comp.x, comp.y);

    if (comp.type === COMPONENT.NODE) {
      ctx.fillStyle = isHover ? settings.highlightColor : settings.wireColor;
      ctx.beginPath();
      ctx.arc(0, 0, settings.nodeRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }

    // Draw component body
    ctx.fillStyle = isHover ? settings.highlightColor : settings.componentColor;
    ctx.strokeStyle = isHover ? settings.highlightColor : '#ffffff';
    ctx.lineWidth = isHover ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(-30, -15, 60, 30, 8);
    ctx.fill();
    ctx.stroke();

    // Draw terminals
    for (const t of [0, 1]) {
      const termPos = getComponentTerminalPos(comp, t);
      ctx.beginPath();
      ctx.fillStyle = '#111';
      ctx.arc(termPos.x - comp.x, termPos.y - comp.y, settings.terminalRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw label
    ctx.fillStyle = '#111';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let label = '';
    if (comp.type === COMPONENT.RESISTOR) label = `R ${comp.value}Ω`;
    else if (comp.type === COMPONENT.BATTERY) label = `V ${comp.value}V`;
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
    const fromPos = getEndpointPos(state.wireStart);
    if (fromPos) {
      ctx.save();
      ctx.strokeStyle = settings.wireColor;
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(fromPos.x, fromPos.y);
      ctx.lineTo(state.drag?.x ?? fromPos.x, state.drag?.y ?? fromPos.y);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function updateHover(pos) {
  state.hoverId = null;

  if (state.tool === TOOL.SELECT || state.tool === TOOL.DELETE) {
    const comp = findComponentAt(pos);
    if (comp) state.hoverId = comp.id;
  }

  if (state.tool === TOOL.WIRE) {
    const term = findTerminalAt(pos);
    if (term) state.hoverId = term.compId;
  }

  draw();
}

function onPointerMove(evt) {
  const pos = getPointerPos(evt);
  if (state.drag && state.tool === TOOL.SELECT) {
    const comp = state.components.find((c) => c.id === state.drag.compId);
    if (comp) {
      comp.x = Math.max(0, Math.min(canvas.width, pos.x + state.drag.offsetX));
      comp.y = Math.max(0, Math.min(canvas.height, pos.y + state.drag.offsetY));
      draw();
    }
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
          compId: clicked.id,
          offsetX: clicked.x - pos.x,
          offsetY: clicked.y - pos.y,
        };
      }
      break;

    case TOOL.RESISTOR: {
      const valueInput = prompt('Enter resistance (e.g. 10k):', '100');
      const value = parseValueInput(valueInput, 100);
      addComponent(
        COMPONENT.RESISTOR,
        snapToGrid(pos.x),
        snapToGrid(pos.y),
        Number.isFinite(value) && value >= 0 ? value : undefined
      );
      break;
    }

    case TOOL.BATTERY: {
      const valueInput = prompt('Enter voltage (e.g. 9V):', '5');
      const value = parseValueInput(valueInput, 5);
      addComponent(
        COMPONENT.BATTERY,
        snapToGrid(pos.x),
        snapToGrid(pos.y),
        Number.isFinite(value) && value >= 0 ? value : undefined
      );
      break;
    }

    case TOOL.NODE:
      addComponent(COMPONENT.NODE, snapToGrid(pos.x), snapToGrid(pos.y));
      break;

    case TOOL.DELETE:
      if (clicked) {
        removeComponent(clicked.id);
      } else {
        const wire = findWireAt(pos);
        if (wire) removeWire(wire);
      }
      break;

    case TOOL.WIRE: {
      let endpoint = findTerminalAt(pos);
      if (!endpoint) {
        // If the user clicked on a component, snap to its nearest terminal.
        if (clicked) {
          endpoint = getNearestTerminal(clicked, pos);
        }
      }

      if (!endpoint) {
        // Create a node at the spot so we can wire there
        const node = addComponent(COMPONENT.NODE, snapToGrid(pos.x), snapToGrid(pos.y));
        endpoint = { compId: node.id, terminal: 0 };
      }

      if (!state.wireStart) {
        state.wireStart = endpoint;
        draw();
        return;
      }

      if (state.wireStart && endpoint) {
        addWire(state.wireStart, endpoint);
        state.wireStart = null;
        draw();
      }
      break;
    }
  }
}

function onPointerUp() {
  state.drag = null;
}

function onDoubleClick(evt) {
  const pos = getPointerPos(evt);
  const comp = findComponentAt(pos);
  if (comp) promptEditComponentValue(comp);
}

function simulateCircuit() {
  const componentCount = state.components.length;
  if (componentCount === 0) {
    statusEl.textContent = `Tool: ${state.tool} — Add components to simulate.`;
    return;
  }

  // Build component adjacency based on wires (for grouping)
  const compAdj = new Map();
  state.components.forEach((c) => compAdj.set(c.id, new Set()));
  state.wires.forEach((w) => {
    const a = w.from.compId;
    const b = w.to.compId;
    if (compAdj.has(a) && compAdj.has(b)) {
      compAdj.get(a).add(b);
      compAdj.get(b).add(a);
    }
  });

  const visited = new Set();
  const groups = [];

  for (const id of compAdj.keys()) {
    if (visited.has(id)) continue;
    const stack = [id];
    const group = [];
    visited.add(id);

    while (stack.length) {
      const cur = stack.pop();
      group.push(cur);
      for (const nbr of compAdj.get(cur) || []) {
        if (!visited.has(nbr)) {
          visited.add(nbr);
          stack.push(nbr);
        }
      }
    }

    groups.push(group);
  }

  function solveLinearSystem(A, b) {
    const n = A.length;
    if (n === 0) return [];
    const M = A.map((row) => row.slice());
    const x = b.slice();

    for (let i = 0; i < n; i++) {
      // Pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
      }
      if (Math.abs(M[maxRow][i]) < 1e-12) return null;

      [M[i], M[maxRow]] = [M[maxRow], M[i]];
      [x[i], x[maxRow]] = [x[maxRow], x[i]];

      const pivot = M[i][i];
      for (let j = i; j < n; j++) M[i][j] /= pivot;
      x[i] /= pivot;

      for (let k = 0; k < n; k++) {
        if (k === i) continue;
        const factor = M[k][i];
        for (let j = i; j < n; j++) {
          M[k][j] -= factor * M[i][j];
        }
        x[k] -= factor * x[i];
      }
    }

    return x;
  }

  function computeEquivalentResistance(resistors, netA, netB) {
    if (netA === netB) {
      return { error: 'Short circuit (battery terminals shorted).' };
    }

    // Find nets reachable from the positive battery terminal via resistors.
    const adjacency = new Map();
    for (const { n0, n1 } of resistors) {
      if (n0 === undefined || n1 === undefined) continue;
      if (!adjacency.has(n0)) adjacency.set(n0, new Set());
      if (!adjacency.has(n1)) adjacency.set(n1, new Set());
      adjacency.get(n0).add(n1);
      adjacency.get(n1).add(n0);
    }

    const reachable = new Set([netA]);
    const stack = [netA];
    while (stack.length) {
      const cur = stack.pop();
      for (const nbr of adjacency.get(cur) || []) {
        if (!reachable.has(nbr)) {
          reachable.add(nbr);
          stack.push(nbr);
        }
      }
    }

    if (!reachable.has(netB)) {
      return { error: 'Open circuit (battery not connected through resistors).' };
    }

    const filteredResistors = resistors.filter(
      (r) => reachable.has(r.n0) && reachable.has(r.n1)
    );

    const nets = new Set(reachable);
    nets.add(netB);

    const isFixed = (n) => n === netA || n === netB;

    const unknownNodes = Array.from(nets).filter((n) => !isFixed(n));

    // If there are no intermediate nodes, all resistors are directly between netA and netB.
    if (unknownNodes.length === 0) {
      let conductance = 0;
      for (const r of resistors) {
        if ((r.n0 === netA && r.n1 === netB) || (r.n0 === netB && r.n1 === netA)) {
          if (r.r <= 0) return { error: 'Short circuit (zero resistance).' };
          conductance += 1 / r.r;
        }
      }
      if (conductance === 0) return { error: 'Open circuit (no path between battery terminals).' };
      return { R: 1 / conductance };
    }

    const nodeIndex = {};
    unknownNodes.forEach((n, idx) => (nodeIndex[n] = idx));

    const N = unknownNodes.length;
    const G = Array.from({ length: N }, () => Array(N).fill(0));
    const I = Array(N).fill(0);
    let directCurrent = 0;

    for (const { n0, n1, r } of filteredResistors) {
      if (r <= 0) return { error: 'Short circuit (zero resistance).' };
      const g = 1 / r;
      const fixed0 = isFixed(n0);
      const fixed1 = isFixed(n1);
      const V0 = n0 === netA ? 1 : n0 === netB ? 0 : null;
      const V1 = n1 === netA ? 1 : n1 === netB ? 0 : null;

      if (fixed0 && fixed1) {
        directCurrent += g * (V0 - V1);
        continue;
      }

      if (!fixed0 && !fixed1) {
        const i = nodeIndex[n0];
        const j = nodeIndex[n1];
        G[i][i] += g;
        G[j][j] += g;
        G[i][j] -= g;
        G[j][i] -= g;
        continue;
      }

      if (!fixed0) {
        const i = nodeIndex[n0];
        G[i][i] += g;
        I[i] += g * V1;
      } else {
        const j = nodeIndex[n1];
        G[j][j] += g;
        I[j] += g * V0;
      }
    }

    const V = solveLinearSystem(G, I);
    if (!V) return { error: 'Circuit solver failed (singular matrix).' };

    let totalCurrent = directCurrent;
    for (const { n0, n1, r } of filteredResistors) {
      const g = 1 / r;
      if (n0 === netA && n1 !== netB) {
        const Vother = n1 === netA ? 1 : n1 === netB ? 0 : V[nodeIndex[n1]];
        totalCurrent += g * (1 - Vother);
      } else if (n1 === netA && n0 !== netB) {
        const Vother = n0 === netA ? 1 : n0 === netB ? 0 : V[nodeIndex[n0]];
        totalCurrent += g * (1 - Vother);
      }
    }

    if (Math.abs(totalCurrent) < 1e-12) {
      return { error: 'Open circuit (no current).' };
    }

    return { R: 1 / totalCurrent };
  }

  const infoParts = groups.map((group, index) => {
    const comps = group
      .map((id) => state.components.find((c) => c.id === id))
      .filter(Boolean);

    const batteries = comps.filter((c) => c.type === COMPONENT.BATTERY);
    if (batteries.length === 0) {
      return `Group ${index + 1}: No battery (add a battery to simulate).`;
    }
    if (batteries.length > 1) {
      return `Group ${index + 1}: Multiple batteries (only one supported per group).`;
    }

    const battery = batteries[0];
    const batteryVoltage = Number(battery.value || 0);

    const groupWires = state.wires.filter(
      (w) => group.includes(w.from.compId) && group.includes(w.to.compId)
    );

    const endpoints = [];
    comps.forEach((c) => {
      if (c.type === COMPONENT.NODE) {
        endpoints.push({ compId: c.id, terminal: 0 });
      } else {
        endpoints.push({ compId: c.id, terminal: 0 }, { compId: c.id, terminal: 1 });
      }
    });

    const keys = endpoints.map(endpointKey);
    const parent = {};
    const find = (k) => {
      if (parent[k] === undefined) parent[k] = k;
      if (parent[k] !== k) parent[k] = find(parent[k]);
      return parent[k];
    };
    const union = (a, b) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[rb] = ra;
    };

    keys.forEach((k) => {
      if (parent[k] === undefined) parent[k] = k;
    });

    for (const wire of groupWires) {
      const k1 = endpointKey(wire.from);
      const k2 = endpointKey(wire.to);
      if (parent[k1] !== undefined && parent[k2] !== undefined) {
        union(k1, k2);
      }
    }

    const netIndex = {};
    let nextNet = 0;
    keys.forEach((k) => {
      const root = find(k);
      if (netIndex[root] === undefined) netIndex[root] = nextNet++;
    });

    const endpointNet = {};
    keys.forEach((k) => {
      endpointNet[k] = netIndex[find(k)];
    });

    const battA = endpointNet[endpointKey({ compId: battery.id, terminal: 0 })];
    const battB = endpointNet[endpointKey({ compId: battery.id, terminal: 1 })];

    if (battA === undefined || battB === undefined) {
      return `Group ${index + 1}: Battery terminals are not connected.`;
    }

    const resistors = comps
      .filter((c) => c.type === COMPONENT.RESISTOR)
      .map((r) => {
        const n0 = endpointNet[endpointKey({ compId: r.id, terminal: 0 })];
        const n1 = endpointNet[endpointKey({ compId: r.id, terminal: 1 })];
        return { n0, n1, r: Number(r.value || 0) };
      });

    if (resistors.length === 0) {
      return `Group ${index + 1}: No resistors (add resistors to get a meaningful current).`;
    }

    const eq = computeEquivalentResistance(resistors, battA, battB);
    if (eq.error) {
      return `Group ${index + 1}: ${eq.error}`;
    }

    const current = batteryVoltage / eq.R;

    const formatValue = (value) => {
      if (value === null || value === undefined || Number.isNaN(value)) return '—';
      const abs = Math.abs(value);
      if (abs >= 1) return `${value.toFixed(2)}`;
      if (abs >= 1e-3) return `${(value * 1e3).toFixed(2)} m`;
      if (abs >= 1e-6) return `${(value * 1e6).toFixed(2)} µ`;
      return `${(value * 1e9).toFixed(2)} n`;
    };

    const formatCurrent = (i) => `${formatValue(i)}A`;
    const formatVoltage = (v) => `${formatValue(v)}V`;
    const formatResistance = (r) => `${formatValue(r)}Ω`;

    return `Group ${index + 1}: I ≈ ${formatCurrent(current)} (V=${formatVoltage(
      batteryVoltage
    )}, R=${formatResistance(eq.R)})`;
  });

  statusEl.textContent = `Tool: ${state.tool} — ${infoParts.join(' | ')}`;
}

function bindEvents() {
  window.addEventListener('resize', resizeCanvas);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('dblclick', onDoubleClick);
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
