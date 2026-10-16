const Database = require("better-sqlite3");

const db = new Database("database.db");

db.prepare(`
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT NOT NULL
    )
`).run();

const columns = db.prepare("PRAGMA table_info(transactions)").all();

const hasDate = columns.some((column) => column.name === "date");

if (!hasDate) {
    db.prepare("ALTER TABLE transactions ADD COLUMN date TEXT").run();
}

const updatedColumns = db.prepare("PRAGMA table_info(transactions)").all();

const hasCategory = updatedColumns.some(
    (column) => column.name === "category"
);

if (!hasCategory) {
    db.prepare(
        "ALTER TABLE transactions ADD COLUMN category TEXT"
    ).run();
}

module.exports = db;