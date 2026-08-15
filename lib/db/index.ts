import postgres from "postgres";

type Database = ReturnType<typeof postgres>;
type DbGlobal = typeof globalThis & { __greenlightDatabase?: Database };

/** Lazily create one bounded serverless-safe connection client per process. */
export function getDatabase(): Database {
  const globalDb = globalThis as DbGlobal;
  if (globalDb.__greenlightDatabase) return globalDb.__greenlightDatabase;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for database access");

  const database = postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  globalDb.__greenlightDatabase = database;
  return database;
}

export async function closeDatabase(): Promise<void> {
  const globalDb = globalThis as DbGlobal;
  if (globalDb.__greenlightDatabase) {
    await globalDb.__greenlightDatabase.end({ timeout: 5 });
    delete globalDb.__greenlightDatabase;
  }
}

export type { Database };
