import cors from "cors";
import express from "express";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = process.env.PORT || 3000;
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
const dataFile = path.join(dataDir, "equipment.json");
const frontendOrigin = process.env.FRONTEND_ORIGIN || "*";

const app = express();

app.use(cors({ origin: frontendOrigin === "*" ? true : frontendOrigin }));
app.use(express.json({ limit: "1mb" }));

async function ensureDataFile() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeFile(dataFile, "[]\n", "utf8");
  }
}

async function readItems() {
  await ensureDataFile();
  const raw = await readFile(dataFile, "utf8");
  const parsed = JSON.parse(raw || "[]");
  return Array.isArray(parsed) ? parsed : [];
}

async function writeItems(items) {
  await ensureDataFile();
  await writeFile(dataFile, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

function cleanItem(input) {
  return {
    id: String(input.id || crypto.randomUUID()),
    equipmentName: String(input.equipmentName || "").trim(),
    equipmentNumber: String(input.equipmentNumber || "").trim(),
    quantity: Math.max(0, Number(input.quantity) || 0),
    missing: Math.max(0, Number(input.missing) || 0),
    assignDate: String(input.assignDate || "").trim(),
    assignedTo: String(input.assignedTo || "").trim()
  };
}

function validateItem(item) {
  const errors = [];
  if (!item.equipmentName) errors.push("Equipment name is required.");
  if (!item.equipmentNumber) errors.push("Equipment number is required.");
  if (!item.assignDate) errors.push("Assign date is required.");
  if (!item.assignedTo) errors.push("Assigned person is required.");
  if (item.missing > item.quantity) errors.push("Missing cannot be greater than quantity.");
  return errors;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/equipment", async (_req, res, next) => {
  try {
    res.json(await readItems());
  } catch (error) {
    next(error);
  }
});

app.post("/api/equipment", async (req, res, next) => {
  try {
    const item = cleanItem(req.body);
    const errors = validateItem(item);
    if (errors.length) return res.status(400).json({ errors });

    const items = await readItems();
    items.unshift(item);
    await writeItems(items);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

app.put("/api/equipment", async (req, res, next) => {
  try {
    if (!Array.isArray(req.body)) return res.status(400).json({ error: "Expected an array." });

    const items = req.body.map(cleanItem);
    const errors = items.flatMap(validateItem);
    if (errors.length) return res.status(400).json({ errors });

    await writeItems(items);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

app.put("/api/equipment/:id", async (req, res, next) => {
  try {
    const items = await readItems();
    const index = items.findIndex((item) => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Equipment record not found." });

    const item = cleanItem({ ...req.body, id: req.params.id });
    const errors = validateItem(item);
    if (errors.length) return res.status(400).json({ errors });

    items[index] = item;
    await writeItems(items);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/equipment/:id", async (req, res, next) => {
  try {
    const items = await readItems();
    const nextItems = items.filter((item) => item.id !== req.params.id);
    await writeItems(nextItems);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Server error." });
});

app.listen(port, () => {
  console.log(`Equipment API running on port ${port}`);
});
