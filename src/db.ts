import path from "path";
import sqlite3 from "sqlite3";

export type ContactRow = {
  id: number;
  phoneNumber: string | null;
  email: string | null;
  linkedId: number | null;
  linkPrecedence: "primary" | "secondary";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

const dbPath = path.join(process.cwd(), "identity.db");
const sqlite = sqlite3.verbose();
const db = new sqlite.Database(dbPath);

export function run(query: string, params: Array<string | number | null> = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(query, params, function onRun(error) {
      if (error) return reject(error);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function all<T>(query: string, params: Array<string | number | null> = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(query, params, (error, rows) => {
      if (error) return reject(error);
      resolve(rows as T[]);
    });
  });
}

export async function initDatabase(): Promise<void> {
  await run(`
    CREATE TABLE IF NOT EXISTS Contact (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phoneNumber TEXT,
      email TEXT,
      linkedId INTEGER,
      linkPrecedence TEXT CHECK (linkPrecedence IN ('primary', 'secondary')) NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      deletedAt TEXT
    )
  `);

  await run("CREATE INDEX IF NOT EXISTS idx_contact_email ON Contact(email)");
  await run("CREATE INDEX IF NOT EXISTS idx_contact_phone ON Contact(phoneNumber)");
  await run("CREATE INDEX IF NOT EXISTS idx_contact_linked ON Contact(linkedId)");
}

export async function getAllContacts(): Promise<ContactRow[]> {
  return all<ContactRow>(
    "SELECT id, phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt, deletedAt FROM Contact ORDER BY id ASC"
  );
}
