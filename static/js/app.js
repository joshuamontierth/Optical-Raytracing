const componentLibrary = window.APP_DATA.componentLibrary;
const opticalRail = document.getElementById("optical-rail");
const componentTemplate = document.getElementById("component-template");
const matrixOutput = document.getElementById("matrix-output");
const raysOutput = document.getElementById("rays-output");
const contextMenu = document.getElementById("context-menu");
const rayContextMenu = document.getElementById("ray-context-menu");
const modalBackdrop = document.getElementById("modal-backdrop");
const modalForm = document.getElementById("modal-form");
const modalTitle = document.getElementById("modal-title");
const modalClose = document.getElementById("modal-close");
const modalCancel = document.getElementById("modal-cancel");
const visualizationCanvas = document.getElementById("ray-visualization");
const rayLegend = document.getElementById("ray-legend");

let componentSequence = [];
let activeContextTarget = null;
let activeModalComponentId = null;
let activeRayIndex = null;
let modalMode = null;
let lastTraceResult = null;

const defaultRays = [
  { label: "Ray A", height: 0, angle: 0 },
  { label: "Ray B", height: 5, angle: -5 },
  { label: "Ray C", height: -5, angle: 5 },
];

const rayState = defaultRays.map((ray) => ({ ...ray }));

function init() {
  bindLibraryDrag();
  setupRailDropTarget();
  renderRayLegend();
  updateOutputs();
  window.addEventListener("click", () => {
    hideContextMenu();
    hideRayContextMenu();
  });
  window.addEventListener("keydown", (evt) => {
    if (evt.key === "Escape") {
      hideContextMenu();
      hideRayContextMenu();
      hideModal();
    }
  });

  window.addEventListener("resize", () => {
    if (lastTraceResult) {
      renderVisualization(lastTraceResult);
    }
  });
}

function bindLibraryDrag() {
  document.querySelectorAll(".component-card").forEach((card) => {
    card.addEventListener("dragstart", (evt) => {
      evt.dataTransfer.setData("application/x-component", card.dataset.type);
      evt.dataTransfer.effectAllowed = "copy";
    });
  });
}

function setupRailDropTarget() {
  opticalRail.addEventListener("dragover", (evt) => {
    evt.preventDefault();
    evt.dataTransfer.dropEffect = "copy";
    opticalRail.classList.add("drag-over");
  });

  opticalRail.addEventListener("dragleave", () => {
    opticalRail.classList.remove("drag-over");
  });

  opticalRail.addEventListener("drop", (evt) => {
    evt.preventDefault();
    opticalRail.classList.remove("drag-over");
    const type = evt.dataTransfer.getData("application/x-component");
    if (!type) return;
    addComponentToRail(type);
  });

  opticalRail.addEventListener("contextmenu", (evt) => {
    evt.preventDefault();
    const componentEl = evt.target.closest(".rail-component");
    if (!componentEl) return;
    activeContextTarget = componentEl;
    showContextMenu(evt.clientX, evt.clientY);
  });
}

function showContextMenu(x, y) {
  hideRayContextMenu();
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.remove("hidden");
}

function hideContextMenu() {
  contextMenu.classList.add("hidden");
  activeContextTarget = null;
}

function showRayContextMenu(x, y, index) {
  hideContextMenu();
  activeRayIndex = index;
  rayContextMenu.style.left = `${x}px`;
  rayContextMenu.style.top = `${y}px`;
  rayContextMenu.classList.remove("hidden");
}

function hideRayContextMenu() {
  rayContextMenu.classList.add("hidden");
  if (modalMode !== "ray") {
    activeRayIndex = null;
  }
}

contextMenu.addEventListener("click", (evt) => {
  const action = evt.target.dataset.action;
  if (!action || !activeContextTarget) return;
  const componentId = activeContextTarget.dataset.id;
  const componentIndex = componentSequence.findIndex((c) => c.id === componentId);
  if (componentIndex === -1) return;

  if (action === "configure") {
    openComponentModal(componentSequence[componentIndex]);
  } else if (action === "remove") {
    componentSequence.splice(componentIndex, 1);
    activeContextTarget.remove();
    refreshRailPlaceholder();
    updateOutputs();
  }

  hideContextMenu();
});

rayContextMenu.addEventListener("click", (evt) => {
  const action = evt.target.dataset.action;
  if (!action || activeRayIndex === null) return;
  if (action === "configure-ray") {
    openRayModal(activeRayIndex);
  }
  hideRayContextMenu();
});

function addComponentToRail(type) {
  const definition = componentLibrary[type];
  if (!definition) return;

  const id = crypto.randomUUID();
  const params = {};
  Object.entries(definition.parameters).forEach(([name, config]) => {
    params[name] = config.default ?? 0;
  });

  const component = { id, type, params };
  componentSequence.push(component);

  const fragment = componentTemplate.content.cloneNode(true);
  const element = fragment.querySelector(".rail-component");
  element.dataset.id = id;
  element.dataset.type = type;
  element.querySelector(".rail-component__label").textContent = definition.label;

  element.setAttribute("draggable", "true");
  enableComponentReorder(element);

  opticalRail.appendChild(fragment);
  refreshRailPlaceholder();
  updateOutputs();
}

function enableComponentReorder(element) {
  element.addEventListener("dragstart", (evt) => {
    evt.dataTransfer.setData("text/plain", element.dataset.id);
    evt.dataTransfer.effectAllowed = "move";
    element.classList.add("dragging");
  });

  element.addEventListener("dragend", () => {
    element.classList.remove("dragging");
  });
}

opticalRail.addEventListener("dragover", (evt) => {
  const dragging = opticalRail.querySelector(".rail-component.dragging");
  if (!dragging) return;
  evt.preventDefault();
  const afterElement = getDragAfterElement(opticalRail, evt.clientX);
  if (afterElement == null) {
    opticalRail.appendChild(dragging);
  } else {
    opticalRail.insertBefore(dragging, afterElement);
  }
  reorderSequenceFromDOM();
  updateOutputs();
});

function getDragAfterElement(container, x) {
  const draggableElements = [...container.querySelectorAll(".rail-component:not(.dragging)")];
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };

  draggableElements.forEach((child) => {
    const box = child.getBoundingClientRect();
    const offset = x - box.left - box.width / 2;
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: child };
    }
  });

  return closest.element;
}

function reorderSequenceFromDOM() {
  const newOrder = [];
  opticalRail.querySelectorAll(".rail-component").forEach((element) => {
    const found = componentSequence.find((comp) => comp.id === element.dataset.id);
    if (found) newOrder.push(found);
  });
  componentSequence = newOrder;
}

function refreshRailPlaceholder() {
  const hasChildren = opticalRail.querySelector(".rail-component") !== null;
  opticalRail.querySelector(".rail-placeholder")?.remove();
  if (!hasChildren) {
    const placeholder = document.createElement("p");
    placeholder.className = "rail-placeholder";
    placeholder.textContent = "Drag components here";
    opticalRail.appendChild(placeholder);
  }
}

function openComponentModal(component) {
  hideRayContextMenu();
  activeModalComponentId = component.id;
  modalMode = "component";
  modalTitle.textContent = `Configure ${componentLibrary[component.type].label}`;
  modalForm.innerHTML = "";

  Object.entries(componentLibrary[component.type].parameters).forEach(([name, config]) => {
    const label = document.createElement("label");
    label.textContent = `${name.replace(/_/g, " ")} (${config.step || 0.1})`;

    const input = document.createElement("input");
    input.type = "number";
    input.name = name;
    if (config.min !== undefined) input.min = config.min;
    if (config.max !== undefined) input.max = config.max;
    if (config.step !== undefined) input.step = config.step;
    input.value = component.params[name];

    label.appendChild(input);
    modalForm.appendChild(label);
  });

  showModal();
}

function openRayModal(index) {
  hideContextMenu();
  modalMode = "ray";
  activeRayIndex = index;
  const ray = rayState[index];
  modalTitle.textContent = `Configure ${ray.label}`;
  modalForm.innerHTML = "";

  const heightLabel = document.createElement("label");
  heightLabel.textContent = "Height (mm)";
  const heightInput = document.createElement("input");
  heightInput.type = "number";
  heightInput.step = "0.1";
  heightInput.name = "height";
  heightInput.value = ray.height;
  heightLabel.appendChild(heightInput);
  modalForm.appendChild(heightLabel);

  const angleLabel = document.createElement("label");
  angleLabel.textContent = "Angle (mrad)";
  const angleInput = document.createElement("input");
  angleInput.type = "number";
  angleInput.step = "0.1";
  angleInput.name = "angle";
  angleInput.value = ray.angle;
  angleLabel.appendChild(angleInput);
  modalForm.appendChild(angleLabel);

  showModal();
}

modalForm.addEventListener("submit", (evt) => {
  evt.preventDefault();
  const formData = new FormData(modalForm);

  if (modalMode === "component" && activeModalComponentId) {
    const component = componentSequence.find((c) => c.id === activeModalComponentId);
    if (!component) return;
    formData.forEach((value, key) => {
      component.params[key] = Number(value);
    });
    updateOutputs();
  } else if (modalMode === "ray" && activeRayIndex !== null) {
    const height = Number(formData.get("height"));
    const angle = Number(formData.get("angle"));
    if (!Number.isFinite(height) || !Number.isFinite(angle)) return;
    rayState[activeRayIndex].height = height;
    rayState[activeRayIndex].angle = angle;
    renderRayLegend();
    updateOutputs();
  }
  hideModal();
});

modalClose.addEventListener("click", hideModal);
modalCancel.addEventListener("click", hideModal);

function showModal() {
  modalBackdrop.classList.remove("hidden");
}

function hideModal() {
  modalBackdrop.classList.add("hidden");
  activeModalComponentId = null;
  activeRayIndex = null;
  modalMode = null;
}

function updateOutputs() {
  renderRayLegend();
  fetch("/api/trace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ components: componentSequence, rays: rayState }),
  })
    .then((res) => res.json())
    .then((data) => {
      lastTraceResult = data;
      renderMatrixOutput(data);
      renderRayOutput(data);
      renderVisualization(data);
      renderRayLegend(data);
    })
    .catch((err) => console.error("Trace error", err));
}

function renderMatrixOutput(data) {
  matrixOutput.innerHTML = "";

  if (!componentSequence.length) {
    const empty = document.createElement("p");
    empty.textContent = "Add components to view matrices.";
    matrixOutput.appendChild(empty);
    return;
  }

  const totalRow = document.createElement("div");
  totalRow.className = "matrix-row";

  const label = document.createElement("span");
  label.className = "matrix-label";
  label.textContent = "M_total =";
  totalRow.appendChild(label);
  totalRow.appendChild(createMatrixElement(data.total_matrix));

  const totalOffset = document.createElement("span");
  totalOffset.className = "matrix-offset";
  totalOffset.textContent = `Δx = ${data.total_offset[0].toFixed(3)}, Δθ = ${data.total_offset[1].toFixed(3)}`;
  totalRow.appendChild(totalOffset);

  matrixOutput.appendChild(totalRow);

  const productRow = document.createElement("div");
  productRow.className = "matrix-product-line";

  const equals = document.createElement("span");
  equals.className = "matrix-operator";
  equals.textContent = "=";
  productRow.appendChild(equals);

  data.matrices.forEach((matrix, index) => {
    const component = componentSequence[index];
    const definition = componentLibrary[component.type];

    const term = document.createElement("div");
    term.className = "matrix-term";

    const title = document.createElement("p");
    title.className = "matrix-term__title";
    title.textContent = `${definition.label}`;
    term.appendChild(title);

    term.appendChild(createMatrixElement(matrix));

    const paramsText = formatComponentParams(component.params);
    const offset = data.offsets[index];
    const hasOffset = Math.abs(offset[0]) > 1e-6 || Math.abs(offset[1]) > 1e-6;
    const detailParts = [];
    if (paramsText) detailParts.push(paramsText);
    if (hasOffset) detailParts.push(`Δx=${offset[0].toFixed(3)}, Δθ=${offset[1].toFixed(3)}`);
    if (detailParts.length) {
      const details = document.createElement("p");
      details.className = "matrix-term__details";
      details.textContent = detailParts.join(" · ");
      term.appendChild(details);
    }

    productRow.appendChild(term);

    if (index < data.matrices.length - 1) {
      const operator = document.createElement("span");
      operator.className = "matrix-operator";
      operator.textContent = "×";
      productRow.appendChild(operator);
    }
  });

  matrixOutput.appendChild(productRow);
}

function createMatrixElement(matrix) {
  const matrixEl = document.createElement("div");
  matrixEl.className = "matrix";
  matrix.flat().forEach((value) => {
    const cell = document.createElement("span");
    cell.textContent = Number(value).toFixed(3);
    matrixEl.appendChild(cell);
  });
  return matrixEl;
}

function renderRayOutput(data) {
  raysOutput.innerHTML = "";
  const table = document.createElement("table");
  const headerRow = document.createElement("tr");
  ["Ray", "Final Height (mm)", "Final Angle (mrad)"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  data.propagated_rays.forEach((ray, index) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    nameCell.textContent = rayState[index].label;
    const heightCell = document.createElement("td");
    heightCell.textContent = Number(ray.height).toFixed(3);
    const angleCell = document.createElement("td");
    angleCell.textContent = Number(ray.angle).toFixed(3);
    row.appendChild(nameCell);
    row.appendChild(heightCell);
    row.appendChild(angleCell);
    table.appendChild(row);
  });

  raysOutput.appendChild(table);
}

const RAY_COLORS = ["#69d2ff", "#ff9f1c", "#ff6f69", "#9b5de5", "#2ec4b6"];

function getRayColor(index) {
  return RAY_COLORS[index % RAY_COLORS.length];
}

function renderRayLegend(traceData = lastTraceResult) {
  if (!rayLegend) return;
  rayLegend.innerHTML = "";

  rayState.forEach((ray, index) => {
    const item = document.createElement("div");
    item.className = "ray-legend__item";
    item.tabIndex = 0;

    const swatch = document.createElement("span");
    swatch.className = "ray-legend__swatch";
    swatch.style.background = getRayColor(index);
    item.appendChild(swatch);

    const name = document.createElement("span");
    name.textContent = ray.label;
    item.appendChild(name);

    const details = document.createElement("span");
    details.className = "ray-legend__details";
    const detailParts = [
      `h₀=${Number(ray.height).toFixed(2)} mm`,
      `θ₀=${Number(ray.angle).toFixed(2)} mrad`,
    ];
    const traced = traceData?.propagated_rays?.[index];
    if (traced) {
      detailParts.push(`→ h=${Number(traced.height).toFixed(2)} mm`);
      detailParts.push(`θ=${Number(traced.angle).toFixed(2)} mrad`);
    }
    details.textContent = detailParts.join(" | ");
    item.appendChild(details);

    item.addEventListener("contextmenu", (evt) => {
      evt.preventDefault();
      showRayContextMenu(evt.clientX, evt.clientY, index);
    });

    item.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        openRayModal(index);
      }
    });

    rayLegend.appendChild(item);
  });
}

function renderVisualization(data) {
  if (!visualizationCanvas) return;
  const ctx = visualizationCanvas.getContext("2d");
  if (!ctx) return;

  const rect = visualizationCanvas.getBoundingClientRect();
  const width = rect.width || visualizationCanvas.width || 640;
  const height = rect.height || visualizationCanvas.height || 260;
  const dpr = window.devicePixelRatio || 1;
  visualizationCanvas.width = width * dpr;
  visualizationCanvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, width, height);

  const margin = Math.min(Math.max(width * 0.08, 36), 80);
  const axisY = height / 2;
  const layout = computeComponentLayout(width, margin);

  const axisStart = Math.max(10, layout.startX - margin * 0.4);
  const axisEnd = Math.min(width - 10, layout.endX + margin * 0.4);

  ctx.save();
  ctx.strokeStyle = "rgba(240, 246, 255, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(axisStart, axisY);
  ctx.lineTo(axisEnd, axisY);
  ctx.stroke();
  ctx.restore();

  const labelFont = "12px 'Segoe UI', sans-serif";
  const labelEntries = layout.positions.filter(
    (entry) => entry.component.type !== "free_space",
  );

  ctx.save();
  ctx.font = labelFont;
  const measuredLabels = labelEntries
    .map((entry) => {
      const text = componentLibrary[entry.component.type]?.label ?? "Component";
      const width = ctx.measureText(text).width;
      entry.labelText = text;
      entry.labelWidth = width;
      return entry;
    })
    .sort((a, b) => a.x - b.x);

  const spacingBuffer = 6;
  let currentCluster = [];
  const flushCluster = () => {
    if (!currentCluster.length) return;
    const size = currentCluster.length;
    currentCluster.forEach((clusterEntry, index) => {
      clusterEntry.labelGroupSize = size;
      clusterEntry.labelGroupIndex = index;
    });
    currentCluster = [];
  };

  measuredLabels.forEach((entry) => {
    if (!currentCluster.length) {
      currentCluster.push(entry);
      return;
    }
    const previous = currentCluster[currentCluster.length - 1];
    const overlapThreshold =
      (previous.labelWidth + entry.labelWidth) / 2 + spacingBuffer;
    if (entry.x - previous.x < overlapThreshold) {
      currentCluster.push(entry);
    } else {
      flushCluster();
      currentCluster.push(entry);
    }
  });
  flushCluster();
  ctx.restore();

  layout.positions.forEach((entry) => {
    if (entry.component.type !== "free_space") {
      ctx.save();
      const gradient = ctx.createLinearGradient(entry.x, 20, entry.x, height - 20);
      gradient.addColorStop(0, "rgba(105, 210, 255, 0)");
      gradient.addColorStop(0.5, "rgba(105, 210, 255, 0.7)");
      gradient.addColorStop(1, "rgba(105, 210, 255, 0)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(entry.x, 20);
      ctx.lineTo(entry.x, height - 20);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = "rgba(240, 246, 255, 0.65)";
      ctx.font = labelFont;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const stackSize = entry.stackSize ?? 1;
      const stackIndex = entry.stackIndex ?? 0;
      const stackSpacing = 16;
      const stackOffset =
        stackSize > 1 ? (stackIndex - (stackSize - 1) / 2) * stackSpacing : 0;
      const labelGroupSize = entry.labelGroupSize ?? 1;
      const labelGroupIndex = entry.labelGroupIndex ?? 0;
      const labelGroupSpacing = 14;
      const labelGroupOffset =
        labelGroupSize > 1
          ? (labelGroupIndex - (labelGroupSize - 1) / 2) * labelGroupSpacing
          : 0;
      const labelBaseline = height - 28;
      const labelY = clamp(
        labelBaseline + stackOffset + labelGroupOffset,
        32,
        height - 10,
      );
      ctx.fillText(entry.labelText ?? "Component", entry.x, labelY);
      ctx.restore();
    }
  });

  const paths = computeRayPaths(data);
  let maxHeight = 0.5;
  paths.forEach((path) => {
    path.states.forEach((state) => {
      maxHeight = Math.max(maxHeight, Math.abs(state.height));
    });
  });
  const scale = maxHeight === 0 ? 1 : Math.min((height * 0.42) / maxHeight, 90);

  const xPoints = [layout.startX];
  layout.positions.forEach((entry) => xPoints.push(entry.x));
  const trailingX = Math.min(width - margin * 0.4, layout.endX + margin * 0.6);
  xPoints.push(trailingX);

  const mapHeight = (value) => clamp(axisY - value * scale, 16, height - 16);

  paths.forEach((path, index) => {
    const color = getRayColor(index);
    const states = path.states;
    const lastHeight = states[states.length - 1] ? states[states.length - 1].height : states[0]?.height ?? 0;
    const heights = [...states.map((state) => state.height), lastHeight];

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.strokeStyle = `${color}33`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(xPoints[0], mapHeight(heights[0]));
    for (let i = 1; i < xPoints.length; i += 1) {
      ctx.lineTo(xPoints[i], mapHeight(heights[i] ?? heights[heights.length - 1]));
    }
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(xPoints[0], mapHeight(heights[0]));
    for (let i = 1; i < xPoints.length; i += 1) {
      ctx.lineTo(xPoints[i], mapHeight(heights[i] ?? heights[heights.length - 1]));
    }
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(xPoints[0], mapHeight(heights[0]), 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(xPoints[xPoints.length - 1], mapHeight(heights[heights.length - 1]), 3.5, 0, Math.PI * 2);
    ctx.fill();

    layout.positions.forEach((entry, posIndex) => {
      const state = states[posIndex + 1];
      if (!state) return;
      ctx.beginPath();
      ctx.arc(entry.x, mapHeight(state.height), 2.4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  });
}

function computeRayPaths(data) {
  const matrices = data?.matrices ?? [];
  const offsets = data?.offsets ?? [];
  return rayState.map((ray) => {
    const states = [{ height: ray.height, angle: ray.angle }];
    let vec = [ray.height, ray.angle];
    matrices.forEach((matrix, index) => {
      vec = applyComponentTransform(matrix, offsets[index], vec);
      states.push({ height: vec[0], angle: vec[1] });
    });
    return { states };
  });
}

function applyComponentTransform(matrix, offset, vec) {
  return [
    matrix[0][0] * vec[0] + matrix[0][1] * vec[1] + (offset?.[0] ?? 0),
    matrix[1][0] * vec[0] + matrix[1][1] * vec[1] + (offset?.[1] ?? 0),
  ];
}

function computeComponentLayout(width, margin) {
  const startX = Math.max(margin, 24);
  const maxAxisEnd = Math.min(width - margin * 0.5, width - 20);
  const tentativeEnd = Math.max(startX + 40, maxAxisEnd);
  const endX = Math.min(tentativeEnd, width - 20);
  const span = Math.max(endX - startX, 1);

  if (!componentSequence.length) {
    return { startX, endX, positions: [] };
  }

  let cumulativeDistance = 0;
  const basePositions = componentSequence.map((component, index) => {
    const entry = { component, index, distance: cumulativeDistance };
    if (component.type === "free_space") {
      const length = Math.max(Number(component.params.length) || 0, 0);
      cumulativeDistance += length;
      entry.distance = cumulativeDistance;
    }
    return entry;
  });

  const totalDistance = cumulativeDistance;
  const normalizer = totalDistance > 0 ? totalDistance : 1;
  const positions = basePositions.map((entry) => {
    const ratio = totalDistance > 0 ? entry.distance / normalizer : 0;
    const x = startX + ratio * span;
    return { ...entry, x };
  });

  const stackMap = new Map();
  positions.forEach((entry) => {
    const key = entry.distance.toFixed(6);
    const stack = stackMap.get(key);
    if (stack) {
      entry.stackIndex = stack.length;
      stack.push(entry);
    } else {
      entry.stackIndex = 0;
      stackMap.set(key, [entry]);
    }
  });

  stackMap.forEach((stack) => {
    const stackSize = stack.length;
    const adjacencySpacing = stackSize > 1 ? clamp(span * 0.01, 4, 12) : 0;
    stack.forEach((entry, stackIndex) => {
      entry.stackSize = stackSize;
      entry.stackIndex = stackIndex;
      if (stackSize > 1) {
        const offset = (stackIndex - (stackSize - 1) / 2) * adjacencySpacing;
        entry.x = clamp(entry.x + offset, startX, endX);
      }
    });
  });

  const maxPositionX = positions.reduce((maxValue, entry) => Math.max(maxValue, entry.x), startX);
  return { startX, endX: Math.max(endX, maxPositionX), positions };
}

function formatComponentParams(params) {
  return Object.entries(params)
    .map(([key, value]) => `${key.replace(/_/g, " ")}=${Number(value).toFixed(2)}`)
    .join(", ");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

init();
