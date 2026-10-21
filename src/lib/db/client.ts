import { createClient, type Client } from "@libsql/client";
import path from "node:path";

let client: Client | null = null;

function resolveUrl(): string {
  if (process.env.TURSO_DATABASE_URL) {
    return process.env.TURSO_DATABASE_URL;
  }
  const filePath = path.resolve(process.cwd(), "data", "strifemap.db");
  return `file:${filePath}`;
}

export function getDb(): Client {
  if (client) return client;

  const url = resolveUrl();
  const authToken = process.env.TURSO_AUTH_TOKEN;

  client = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });

  return client;
}

export function isRemoteTurso(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL?.startsWith("libsql://"));
}
