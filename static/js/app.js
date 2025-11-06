const componentLibrary = window.APP_DATA.componentLibrary;
const opticalRail = document.getElementById("optical-rail");
const componentTemplate = document.getElementById("component-template");
const rayTemplate = document.getElementById("ray-control-template");
const rayControls = document.getElementById("ray-controls");
const matrixOutput = document.getElementById("matrix-output");
const raysOutput = document.getElementById("rays-output");
const contextMenu = document.getElementById("context-menu");
const modalBackdrop = document.getElementById("modal-backdrop");
const modalForm = document.getElementById("modal-form");
const modalTitle = document.getElementById("modal-title");
const modalClose = document.getElementById("modal-close");
const modalCancel = document.getElementById("modal-cancel");

let componentSequence = [];
let activeContextTarget = null;
let activeModalComponentId = null;

const defaultRays = [
  { label: "Ray A", height: 0, angle: 0 },
  { label: "Ray B", height: 5, angle: -5 },
  { label: "Ray C", height: -5, angle: 5 },
];

const rayState = defaultRays.map((ray) => ({ ...ray }));

function init() {
  bindLibraryDrag();
  setupRailDropTarget();
  buildRayControls();
  updateOutputs();
  window.addEventListener("click", () => hideContextMenu());
  window.addEventListener("keydown", (evt) => {
    if (evt.key === "Escape") {
      hideContextMenu();
      hideModal();
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
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.remove("hidden");
}

function hideContextMenu() {
  contextMenu.classList.add("hidden");
  activeContextTarget = null;
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

function buildRayControls() {
  rayControls.innerHTML = "";
  rayState.forEach((ray, index) => {
    const fragment = rayTemplate.content.cloneNode(true);
    const control = fragment.querySelector(".ray-control");
    control.dataset.rayIndex = index;
    control.querySelector("h3").textContent = ray.label;
    const heightInput = control.querySelector('input[name="height"]');
    const angleInput = control.querySelector('input[name="angle"]');

    heightInput.value = ray.height;
    angleInput.value = ray.angle;

    heightInput.addEventListener("input", () => {
      rayState[index].height = Number(heightInput.value);
      updateOutputs();
    });

    angleInput.addEventListener("input", () => {
      rayState[index].angle = Number(angleInput.value);
      updateOutputs();
    });

    rayControls.appendChild(fragment);
  });
}

function openComponentModal(component) {
  activeModalComponentId = component.id;
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

modalForm.addEventListener("submit", (evt) => {
  evt.preventDefault();
  if (!activeModalComponentId) return;
  const formData = new FormData(modalForm);
  const component = componentSequence.find((c) => c.id === activeModalComponentId);
  if (!component) return;
  formData.forEach((value, key) => {
    component.params[key] = Number(value);
  });
  updateOutputs();
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
}

function updateOutputs() {
  fetch("/api/trace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ components: componentSequence, rays: rayState }),
  })
    .then((res) => res.json())
    .then((data) => {
      renderMatrixOutput(data);
      renderRayOutput(data);
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

  data.matrices.forEach((matrix, index) => {
    const component = componentSequence[index];
    const definition = componentLibrary[component.type];
    const block = document.createElement("div");
    block.className = "matrix-block";

    const title = document.createElement("h3");
    title.textContent = `${definition.label} (Component ${index + 1})`;
    block.appendChild(title);

    block.appendChild(createMatrixElement(matrix));

    const params = document.createElement("p");
    params.className = "component-params";
    params.textContent = `Parameters: ${Object.entries(component.params)
      .map(([key, value]) => `${key} = ${value}`)
      .join(", ")}`;
    block.appendChild(params);

    if (data.offsets[index][1] !== 0 || data.offsets[index][0] !== 0) {
      const offset = document.createElement("p");
      offset.textContent = `Offsets: Δx = ${data.offsets[index][0].toFixed(3)}, Δθ = ${data.offsets[index][1].toFixed(3)}`;
      block.appendChild(offset);
    }

    matrixOutput.appendChild(block);
  });

  const totalBlock = document.createElement("div");
  totalBlock.className = "matrix-block";
  const totalTitle = document.createElement("h3");
  totalTitle.textContent = "Total System";
  totalBlock.appendChild(totalTitle);
  totalBlock.appendChild(createMatrixElement(data.total_matrix));
  const offset = document.createElement("p");
  offset.textContent = `Offsets: Δx = ${data.total_offset[0].toFixed(3)}, Δθ = ${data.total_offset[1].toFixed(3)}`;
  totalBlock.appendChild(offset);
  matrixOutput.appendChild(totalBlock);
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

init();
