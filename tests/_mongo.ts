// tests/_mongo.ts
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, type Db } from "mongodb";
import { config } from "../src/config.js";
import { closeDb } from "../src/db/client.js";

let server: MongoMemoryServer | null = null;
let client: MongoClient | null = null;

export async function startTestMongo(): Promise<{ uri: string; db: Db }> {
  if (server || client) {
    throw new Error(
      "startTestMongo: previous instance still running — call stopTestMongo() first",
    );
  }
  server = await MongoMemoryServer.create();
  const uri = server.getUri("feedhub-test");
  config.mongoUri = uri;
  await closeDb();
  client = new MongoClient(uri);
  await client.connect();
  const db = client.db("feedhub-test");
  return { uri, db };
}

export async function stopTestMongo(): Promise<void> {
  try {
    await closeDb();
    if (client) await client.close();
  } finally {
    if (server) await server.stop();
    client = null;
    server = null;
  }
}

export async function clearCollections(db: Db, names: string[]): Promise<void> {
  await Promise.all(
    names.map((n) => db.collection(n).deleteMany({}).catch(() => undefined)),
  );
}
