import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql/web";
import * as schema from "./schema";

// Get Turso environment variables (defaults to Web HTTP client - pure JS, 100% ARM64 & Windows compatible)
const rawUrl = (import.meta.env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL)?.trim();
const rawToken = (import.meta.env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN)?.trim();

export const isTursoConfigured = Boolean(
  rawUrl && rawUrl.length > 0 && !rawUrl.includes("dummy-db-sitedotmoss")
);

let url = rawUrl || "https://dummy-db-sitedotmoss.turso.io";
if (url.startsWith("libsql://")) {
  url = url.replace("libsql://", "https://");
}
const authToken = isTursoConfigured ? rawToken! : "dummy-token";

export const libsqlClient = createClient({
  url,
  authToken,
});

export const db = drizzle(libsqlClient, { schema });

// Auto-initialize remote database tables if configured
let initialized = false;
export async function ensureDbInitialized() {
  if (initialized) return;
  // Skip execution if Turso isn't configured with a real database URL
  if (!rawUrl || rawUrl.includes("dummy-db-sitedotmoss")) return;

  try {
    await libsqlClient.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin' NOT NULL,
        avatar TEXT,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL
      );
    `);
    await libsqlClient.execute(`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        caption TEXT NOT NULL,
        cover_image TEXT NOT NULL,
        images TEXT,
        location TEXT,
        tags TEXT,
        likes_count INTEGER DEFAULT 0 NOT NULL,
        views_count INTEGER DEFAULT 0 NOT NULL,
        published INTEGER DEFAULT 1 NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
      );
    `);
    await libsqlClient.execute(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        post_slug TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_avatar TEXT,
        content TEXT NOT NULL,
        parent_id TEXT,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL
      );
    `);
    await libsqlClient.execute(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        user_hash TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL
      );
    `);
    await libsqlClient.execute(`
      CREATE TABLE IF NOT EXISTS authors (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        bio TEXT,
        website TEXT
      );
    `);
    initialized = true;
  } catch (err) {
    console.warn("Turso DB init warning:", err);
  }
}
