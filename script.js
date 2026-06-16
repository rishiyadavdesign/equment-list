const storageKey = "equipment-assignment-list";
const apiBaseUrl = (window.EQUIPMENT_API_URL || "").replace(/\/$/, "");

const sampleItems = [
  {
    id: crypto.randomUUID(),
    equipmentName: "Match Camera",
    equipmentNumber: "CAM-001",
    quantity: 6,
    missing: 1,
    assignDate: "2026-06-15",
    assignedTo: "Rishi Yadav"
  },
  {
    id: crypto.randomUUID(),
    equipmentName: "Tripod Stand",
    equipmentNumber: "TRI-012",
    quantity: 12,
    missing: 0,
    assignDate: "2026-06-15",
    assignedTo: "Vivek Kumar"
  },
  {
    id: crypto.randomUUID(),
    equipmentName: "Player Bib Set",
    equipmentNumber: "BIB-050",
    quantity: 50,
    missing: 3,
    assignDate: "2026-06-16",
    assignedTo: "Ankit Yadav"
  }
];

let items = [];
let selectedIds = new Set();

const equipmentTable = document.querySelector("#equipmentTable");
const emptyState = document.querySelector("#emptyState");
const topSearch = document.querySelector("#topSearch");
const topSearchButton = document.querySelector("#topSearchButton");
const dateFilter = document.querySelector("#dateFilter");
const personFilter = document.querySelector("#personFilter");
const equipmentForm = document.querySelector("#equipmentForm");
const formTitle = document.querySelector("#formTitle");
const submitButton = document.querySelector("#submitButton");
const sampleButton = document.querySelector("#sampleButton");
const printButton = document.querySelector("#printButton");
const pdfButton = document.querySelector("#pdfButton");
const printMeta = document.querySelector("#printMeta");
const equipmentModal = document.querySelector("#equipmentModal");
const addEquipmentButton = document.querySelector("#addEquipmentButton");
const closeModalButton = document.querySelector("#closeModalButton");
const deleteSelectedButton = document.querySelector("#deleteSelectedButton");
const selectedCount = document.querySelector("#selectedCount");
const selectedCountChip = document.querySelector("#selectedCountChip");
const selectAllRows = document.querySelector("#selectAllRows");

function readItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved)) return saved;
  } catch {
    return [];
  }
  return [];
}

async function loadItems() {
  if (!apiBaseUrl) {
    items = readItems();
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/equipment`);
    if (!response.ok) throw new Error("Could not load equipment.");
    items = await response.json();
    localStorage.setItem(storageKey, JSON.stringify(items));
  } catch (error) {
    console.warn(error);
    items = readItems();
  }
}

async function saveItems() {
  localStorage.setItem(storageKey, JSON.stringify(items));

  if (!apiBaseUrl) return;

  const response = await fetch(`${apiBaseUrl}/api/equipment`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items)
  });

  if (!response.ok) {
    throw new Error("Could not save equipment.");
  }

  items = await response.json();
  localStorage.setItem(storageKey, JSON.stringify(items));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatDate(value) {
  if (!value) return "Not assigned";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function todayValue() {
  const now = new Date();
  const offsetDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function getQuery() {
  return normalize(topSearch.value);
}

function filteredItems() {
  const query = getQuery();
  const selectedDate = dateFilter.value;
  const selectedPerson = personFilter.value;

  return items.filter((item) => {
    const matchesDate = selectedDate === "all" || item.assignDate === selectedDate;
    const matchesPerson = selectedPerson === "all" || item.assignedTo === selectedPerson;
    const searchText = [
      item.equipmentName,
      item.equipmentNumber,
      item.quantity,
      item.missing,
      item.assignDate,
      formatDate(item.assignDate),
      item.assignedTo
    ].join(" ").toLowerCase();

    return matchesDate && matchesPerson && searchText.includes(query);
  });
}

function updateDateFilter() {
  const currentValue = dateFilter.value;
  const dates = [...new Set(items.map((item) => item.assignDate).filter(Boolean))].sort().reverse();

  dateFilter.innerHTML = '<option value="all">All Assign Dates</option>';
  dates.forEach((date) => {
    const option = document.createElement("option");
    option.value = date;
    option.textContent = formatDate(date);
    dateFilter.append(option);
  });

  dateFilter.value = dates.includes(currentValue) ? currentValue : "all";
}

function updatePersonFilter() {
  const currentValue = personFilter.value;
  const selectedDate = dateFilter.value;
  const people = [...new Set(
    items
      .filter((item) => selectedDate === "all" || item.assignDate === selectedDate)
      .map((item) => item.assignedTo)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  personFilter.innerHTML = '<option value="all">All Persons</option>';
  people.forEach((person) => {
    const option = document.createElement("option");
    option.value = person;
    option.textContent = person;
    personFilter.append(option);
  });

  personFilter.value = people.includes(currentValue) ? currentValue : "all";
}

function updateSummary() {
  const totalMissing = items.reduce((sum, item) => sum + Number(item.missing || 0), 0);
  const selectedDate = dateFilter.value === "all" ? "All" : formatDate(dateFilter.value);
  const visiblePeople = new Set(filteredItems().map((item) => item.assignedTo).filter(Boolean));
  const selectedPerson = personFilter.value === "all" ? "All persons" : personFilter.value;
  document.querySelector("#totalCount").textContent = items.length;
  document.querySelector("#missingCount").textContent = totalMissing;
  document.querySelector("#personCount").textContent = visiblePeople.size;
  document.querySelector("#selectedDateLabel").textContent = selectedDate;
  printMeta.textContent = `${dateFilter.value === "all" ? "All assign dates" : `Assign date: ${selectedDate}`} · ${selectedPerson}`;
}

function updateSelectionControls() {
  const visibleItems = filteredItems();
  const visibleIds = visibleItems.map((item) => item.id);
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length;
  selectedIds = new Set([...selectedIds].filter((id) => items.some((item) => item.id === id)));

  selectedCount.textContent = selectedIds.size;
  selectedCountChip.classList.toggle("hidden", selectedIds.size === 0);
  deleteSelectedButton.classList.toggle("hidden", selectedIds.size === 0);
  selectAllRows.checked = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  selectAllRows.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
}

function renderTable() {
  const visibleItems = filteredItems();
  equipmentTable.innerHTML = "";

  visibleItems.forEach((item) => {
    const equipmentNumber = item.equipmentNumber || "Not set";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td data-label="Select" class="select-column no-print">
        <input class="row-checkbox" type="checkbox" data-action="select" data-id="${item.id}" aria-label="Select ${escapeHtml(item.equipmentName)}" ${selectedIds.has(item.id) ? "checked" : ""}>
      </td>
      <td data-label="Equipment Name" class="equipment-name">${escapeHtml(item.equipmentName)}</td>
      <td data-label="Equipment No." class="muted-text">${escapeHtml(equipmentNumber)}</td>
      <td data-label="Quantity"><span class="count">${Number(item.quantity) || 0}</span></td>
      <td data-label="Missing"><span class="count count--missing">${Number(item.missing) || 0}</span></td>
      <td data-label="Assign Date" class="date-text">${formatDate(item.assignDate)}</td>
      <td data-label="Assign To" class="muted-text">${escapeHtml(item.assignedTo)}</td>
      <td data-label="Action">
        <div class="row-actions">
          <button class="text-action" type="button" data-action="edit" data-id="${item.id}">Edit</button>
          <button class="text-action" type="button" data-action="assign" data-id="${item.id}">Assign Again</button>
          <button class="text-action delete" type="button" data-action="delete" data-id="${item.id}">Delete</button>
        </div>
      </td>
    `;
    equipmentTable.append(row);
  });

  emptyState.classList.toggle("visible", visibleItems.length === 0);
  updateSelectionControls();
}

function render() {
  updateDateFilter();
  updatePersonFilter();
  updateSummary();
  renderTable();
}

function getFormData() {
  const quantity = Math.max(0, Number(document.querySelector("#quantity").value) || 0);
  const missing = Math.min(quantity, Math.max(0, Number(document.querySelector("#missing").value) || 0));

  return {
    id: document.querySelector("#itemId").value || crypto.randomUUID(),
    equipmentName: document.querySelector("#equipmentName").value.trim(),
    equipmentNumber: document.querySelector("#equipmentNumber").value.trim(),
    quantity,
    missing,
    assignDate: document.querySelector("#assignDate").value,
    assignedTo: document.querySelector("#assignedTo").value.trim()
  };
}

function resetForm() {
  equipmentForm.reset();
  document.querySelector("#itemId").value = "";
  document.querySelector("#quantity").value = 1;
  document.querySelector("#missing").value = 0;
  document.querySelector("#assignDate").value = todayValue();
  formTitle.textContent = "Add Equipment";
  submitButton.textContent = "Save Equipment";
}

function openModal() {
  equipmentModal.classList.remove("hidden");
  document.querySelector("#equipmentName").focus();
}

function closeModal() {
  equipmentModal.classList.add("hidden");
}

function fillForm(item) {
  document.querySelector("#itemId").value = item.id;
  document.querySelector("#equipmentName").value = item.equipmentName;
  document.querySelector("#equipmentNumber").value = item.equipmentNumber || "";
  document.querySelector("#quantity").value = item.quantity;
  document.querySelector("#missing").value = item.missing;
  document.querySelector("#assignDate").value = item.assignDate;
  document.querySelector("#assignedTo").value = item.assignedTo;
  formTitle.textContent = "Edit Equipment";
  submitButton.textContent = "Update Equipment";
  openModal();
}

function assignAgain(item) {
  document.querySelector("#itemId").value = "";
  document.querySelector("#equipmentName").value = item.equipmentName;
  document.querySelector("#equipmentNumber").value = item.equipmentNumber || "";
  document.querySelector("#quantity").value = item.quantity;
  document.querySelector("#missing").value = 0;
  document.querySelector("#assignDate").value = todayValue();
  document.querySelector("#assignedTo").value = "";
  formTitle.textContent = "Assign Equipment";
  submitButton.textContent = "Save Assignment";
  openModal();
}

equipmentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formItem = getFormData();
  const itemIndex = items.findIndex((item) => item.id === formItem.id);

  if (itemIndex >= 0) {
    items[itemIndex] = formItem;
  } else {
    items.unshift(formItem);
  }

  try {
    await saveItems();
    resetForm();
    closeModal();
    render();
  } catch (error) {
    alert(error.message);
  }
});

equipmentForm.addEventListener("reset", () => {
  setTimeout(resetForm, 0);
});

equipmentTable.addEventListener("click", (event) => {
  const checkbox = event.target.closest('input[data-action="select"]');
  if (checkbox) {
    if (checkbox.checked) {
      selectedIds.add(checkbox.dataset.id);
    } else {
      selectedIds.delete(checkbox.dataset.id);
    }
    updateSelectionControls();
    return;
  }

  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const selectedItem = items.find((item) => item.id === button.dataset.id);
  if (!selectedItem) return;

  if (button.dataset.action === "edit") {
    fillForm(selectedItem);
  }

  if (button.dataset.action === "assign") {
    assignAgain(selectedItem);
  }

  if (button.dataset.action === "delete") {
    items = items.filter((item) => item.id !== selectedItem.id);
    selectedIds.delete(selectedItem.id);
    saveItems()
      .then(render)
      .catch((error) => alert(error.message));
  }
});

topSearchButton.addEventListener("click", () => {
  updateSummary();
  renderTable();
});

topSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    updateSummary();
    renderTable();
  }
});

topSearch.addEventListener("input", () => {
  updateSummary();
  renderTable();
});

dateFilter.addEventListener("change", () => {
  updatePersonFilter();
  updateSummary();
  renderTable();
});

personFilter.addEventListener("change", () => {
  updateSummary();
  renderTable();
});

selectAllRows.addEventListener("change", () => {
  const visibleIds = filteredItems().map((item) => item.id);
  if (selectAllRows.checked) {
    visibleIds.forEach((id) => selectedIds.add(id));
  } else {
    visibleIds.forEach((id) => selectedIds.delete(id));
  }
  renderTable();
});

deleteSelectedButton.addEventListener("click", async () => {
  if (selectedIds.size === 0) return;
  const count = selectedIds.size;
  const shouldDelete = confirm(`Delete ${count} selected item${count === 1 ? "" : "s"}?`);
  if (!shouldDelete) return;

  items = items.filter((item) => !selectedIds.has(item.id));
  selectedIds.clear();

  try {
    await saveItems();
    render();
  } catch (error) {
    alert(error.message);
  }
});

addEquipmentButton.addEventListener("click", () => {
  resetForm();
  openModal();
});

closeModalButton.addEventListener("click", closeModal);
equipmentModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-modal]")) {
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
  }
});

sampleButton.addEventListener("click", async () => {
  items = sampleItems.map((item) => ({ ...item, id: crypto.randomUUID() }));
  try {
    await saveItems();
    render();
  } catch (error) {
    alert(error.message);
  }
});

function printList() {
  updateSummary();
  renderTable();
  window.print();
}

printButton.addEventListener("click", printList);
pdfButton.addEventListener("click", printList);

resetForm();
loadItems().then(render);
