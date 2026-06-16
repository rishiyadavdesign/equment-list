import cors from "cors";
import express from "express";
import { MongoClient } from "mongodb";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = process.env.PORT || 3000;
const preferredDataDir = process.env.DATA_DIR || path.join(__dirname, "data");
let activeDataFile;
const frontendOrigin = process.env.FRONTEND_ORIGIN || "*";
const mongoUri = process.env.MONGODB_URI;
const mongoDbName = process.env.MONGODB_DB || "equipment_list";
const mongoCollectionName = process.env.MONGODB_COLLECTION || "assignments";
let mongoClient;
let mongoCollection;

const app = express();

app.use(cors({ origin: frontendOrigin === "*" ? true : frontendOrigin }));
app.use(express.json({ limit: "1mb" }));

async function getCollection() {
  if (!mongoUri) return null;
  if (mongoCollection) return mongoCollection;

  mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  mongoCollection = mongoClient.db(mongoDbName).collection(mongoCollectionName);
  await mongoCollection.createIndex({ id: 1 }, { unique: true });
  await mongoCollection.createIndex({ assignDate: 1 });
  await mongoCollection.createIndex({ assignedTo: 1 });
  console.log(`Using MongoDB collection: ${mongoDbName}.${mongoCollectionName}`);
  return mongoCollection;
}

async function writableDataFile() {
  if (activeDataFile) return activeDataFile;

  const candidates = [
    preferredDataDir,
    path.join(__dirname, "data"),
    "/tmp/equipment-list"
  ];

  for (const dir of candidates) {
    const equipmentFile = path.join(dir, "equipment.json");
    try {
      await mkdir(dir, { recursive: true });
      try {
        const raw = await readFile(equipmentFile, "utf8");
        JSON.parse(raw || "[]");
      } catch (error) {
        if (error.code !== "ENOENT" && error.name !== "SyntaxError") {
          throw error;
        }
        await writeFile(equipmentFile, "[]\n", "utf8");
      }
      const testFile = path.join(dir, `.write-test-${Date.now()}`);
      await writeFile(testFile, "ok", "utf8");
      await unlink(testFile).catch(() => {});
      activeDataFile = equipmentFile;
      console.log(`Using equipment data file: ${activeDataFile}`);
      return activeDataFile;
    } catch (error) {
      console.warn(`Cannot write equipment data in ${dir}: ${error.message}`);
    }
  }

  throw new Error("No writable data directory available.");
}

async function ensureDataFile() {
  const dataFile = await writableDataFile();
  try {
    await readFile(dataFile, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeFile(dataFile, "[]\n", "utf8");
  }
}

async function readItems() {
  const collection = await getCollection();
  if (collection) {
    return collection
      .find({}, { projection: { _id: 0 } })
      .sort({ assignDate: -1, createdAt: -1 })
      .toArray();
  }

  await ensureDataFile();
  const dataFile = await writableDataFile();
  const raw = await readFile(dataFile, "utf8");
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    await writeFile(dataFile, "[]\n", "utf8");
    return [];
  }
}

async function writeItems(items) {
  const collection = await getCollection();
  if (collection) {
    await collection.deleteMany({});
    if (items.length) {
      await collection.insertMany(items.map((item) => ({
        ...item,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })));
    }
    return;
  }

  await ensureDataFile();
  const dataFile = await writableDataFile();
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
    assignedTo: String(input.assignedTo || "").trim(),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
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

app.get("/health", async (_req, res) => {
  try {
    const collection = await getCollection();
    if (collection) {
      await collection.db.command({ ping: 1 });
    }

    res.json({
      ok: true,
      version: "mongodb-v1",
      storage: collection ? "mongodb" : "file"
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "mongodb-v1",
      storage: "mongodb",
      error: "MongoDB connection failed."
    });
  }
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
    const collection = await getCollection();
    if (collection) {
      await collection.insertOne(item);
    } else {
      await writeItems(items);
    }
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

    const collection = await getCollection();
    if (collection) {
      await collection.replaceOne({ id: req.params.id }, item);
    } else {
      items[index] = item;
      await writeItems(items);
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/equipment/:id", async (req, res, next) => {
  try {
    const items = await readItems();
    const collection = await getCollection();
    if (collection) {
      await collection.deleteOne({ id: req.params.id });
    } else {
      const nextItems = items.filter((item) => item.id !== req.params.id);
      await writeItems(nextItems);
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: "Server error.",
    message: process.env.NODE_ENV === "production" ? undefined : error.message
  });
});

app.listen(port, () => {
  console.log(`Equipment API running on port ${port}`);
});

async function shutdown() {
  if (mongoClient) await mongoClient.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
