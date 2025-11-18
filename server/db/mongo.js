import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB = process.env.MONGODB_DB || "eventsdb";

let _client = null;
let _db = null;

export async function getMongoClient() {
    if (!_client) {
        if (!MONGODB_URI) {
            throw new Error("[mongo] MONGODB_URI is not set");
        }
        _client = new MongoClient(MONGODB_URI, {
            maxPoolSize: 10,
            minPoolSize: 0,
            connectTimeoutMS: 8000,
            serverSelectionTimeoutMS: 8000,
            socketTimeoutMS: 20000,
        });
        await _client.connect();
    }
    return _client;
}

export async function getDb() {
    if (_db) return _db;
    const client = await getMongoClient();
    _db = client.db(MONGODB_DB);
    return _db;
}

export async function getCollection(name, ensureIndexesFn) {
    const db = await getDb();
    const coll = db.collection(name);
    if (typeof ensureIndexesFn === "function") {
        await ensureIndexesFn(coll);
    }
    return coll;
}

export async function ping() {
    const client = await getMongoClient();
    return client.db("admin").command({ ping: 1 });
}

export async function closeMongo() {
    if (_client) {
        await _client.close();
        _client = null;
        _db = null;
    }
}
