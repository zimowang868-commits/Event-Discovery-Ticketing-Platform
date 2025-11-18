import { Router } from "express";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { getCollection } from "../db/mongo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data");
const FAV_FILE = path.join(DATA_DIR, "favorites.json");

const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_COLL = process.env.MONGODB_COLL || "favorites";

async function ensureFile() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.access(FAV_FILE);
    } catch {
        await fs.writeFile(FAV_FILE, JSON.stringify({ items: [] }, null, 2));
    }
}
async function readFavsFromFile() {
    await ensureFile();
    const raw = await fs.readFile(FAV_FILE, "utf-8");
    return JSON.parse(raw || "{\"items\":[]}");
}
async function writeFavsToFile(obj) {
    await fs.writeFile(FAV_FILE, JSON.stringify(obj, null, 2));
}

function normalizeFav(id, payload) {
    return {
        id,
        name: payload.name || "",
        venue: payload.venue || "",
        date: payload.date || "",
        time: payload.time || "",
        segment: payload.segment || "",
        image: payload.image || "",
        buyUrl: payload.buyUrl || "",
    };
}

async function ensureFavoritesIndexes(coll) {
    await coll.createIndex({ createdAt: -1 });
}

export default function registerFavoritesRoute(app) {
    const router = Router();

    router.get("/", async (_req, res) => {
        try {
            if (MONGODB_URI) {
                const coll = await getCollection(MONGODB_COLL, ensureFavoritesIndexes);
                const docs = await coll
                    .find({}, { sort: { createdAt: -1 }, projection: { _id: 0 } })
                    .toArray();
                return res.json({ items: docs });
            }

            const db = await readFavsFromFile();
            const items = (db.items || []).slice().sort((a, b) => {
                const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return tb - ta;
            });
            return res.json({ items });
        } catch (e) {
            console.error("[favorites:get] error:", e);
            return res.status(500).json({ error: "internal_error" });
        }
    });

    router.put("/:id", express.json({ limit: "200kb" }), async (req, res) => {
        const id = req.params.id;
        const payload = req.body || {};
        if (!id) return res.status(400).json({ error: "missing id" });

        try {
            const base = normalizeFav(id, payload);

            if (MONGODB_URI) {
                const coll = await getCollection(MONGODB_COLL, ensureFavoritesIndexes);
                const now = new Date();
                await coll.updateOne(
                    { _id: id },
                    {
                        $set: { ...base, _id: id },
                        $setOnInsert: { createdAt: now }
                    },
                    { upsert: true }
                );
                const saved = await coll.findOne({ _id: id }, { projection: { _id: 0 } });
                return res.json({ ok: true, item: saved || base });
            }

            const db = await readFavsFromFile();
            const idx = db.items.findIndex((x) => x.id === id);
            const nowISO = new Date().toISOString();
            if (idx >= 0) {
                const prev = db.items[idx];
                db.items[idx] = { ...prev, ...base, createdAt: prev.createdAt || nowISO };
            } else {
                db.items.unshift({ ...base, createdAt: nowISO });
            }
            await writeFavsToFile(db);
            return res.json({ ok: true, item: base });
        } catch (e) {
            console.error("[favorites:put] error:", e);
            return res.status(500).json({ error: "internal_error" });
        }
    });

    router.delete("/:id", async (req, res) => {
        const id = req.params.id;
        if (!id) return res.status(400).json({ error: "missing id" });

        try {
            if (MONGODB_URI) {
                const coll = await getCollection(MONGODB_COLL, ensureFavoritesIndexes);
                await coll.deleteOne({ _id: id });
                return res.json({ ok: true });
            }

            const db = await readFavsFromFile();
            db.items = (db.items || []).filter((x) => x.id !== id);
            await writeFavsToFile(db);
            return res.json({ ok: true });
        } catch (e) {
            console.error("[favorites:delete] error:", e);
            return res.status(500).json({ error: "internal_error" });
        }
    });

    app.use("/api/favorites", router);
}
