export const db = require("better-sqlite3")("data.db");
await db.pragma("journal_mode = WAL");
