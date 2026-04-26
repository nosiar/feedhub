// tests/_mongo.ts
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, type Db } from "mongodb";

let server: MongoMemoryServer | null = null;
let client: MongoClient | null = null;

export async function startTestMongo(): Promise<{ uri: string; db: Db }> {
  server = await MongoMemoryServer.create();
  const uri = server.getUri();
  client = new MongoClient(uri);
  await client.connect();
  const db = client.db("feedhub-test");
  process.env.MONGODB_URI = uri;
  return { uri, db };
}

export async function stopTestMongo(): Promise<void> {
  await client?.close();
  await server?.stop();
  client = null;
  server = null;
}

export async function clearCollections(db: Db, names: string[]): Promise<void> {
  await Promise.all(
    names.map((n) =>
      db.collection(n).deleteMany({}).catch(() => undefined),
    ),
  );
}
