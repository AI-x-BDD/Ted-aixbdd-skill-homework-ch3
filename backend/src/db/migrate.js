import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { config } from "../config.js";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

const conn = await mysql.createConnection({
  uri: config.DATABASE_URL,
  multipleStatements: true,
  timezone: "Z",
  charset: "utf8mb4",
});
await conn.query("SET time_zone = '+00:00'");
await conn.query(
  "CREATE TABLE IF NOT EXISTS schema_migrations (filename varchar(255) NOT NULL PRIMARY KEY) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
);
const [doneRows] = await conn.query("SELECT filename FROM schema_migrations");
const done = new Set(doneRows.map((row) => row.filename));
const files = (await readdir(migrationsDir))
  .filter((name) => name.endsWith(".sql"))
  .sort();
for (const filename of files) {
  if (done.has(filename)) continue;
  const sql = await readFile(join(migrationsDir, filename), "utf8");
  await conn.query(sql);
  await conn.query("INSERT INTO schema_migrations (filename) VALUES (?)", [
    filename,
  ]);
}
await conn.end();
