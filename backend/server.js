const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "super_gizli_finans_anahtari_2026";

app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// Veritabanı Bağlantısı
const dbPath = path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Veritabanına bağlanılamadı:", err.message);
  } else {
    console.log("SQLite veritabanına bağlandı.");
  }
});

// Tabloları Oluştur ve Kolonları Güncelle
db.serialize(() => {
  // 1. Kullanıcılar Tablosu
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);

  // 2. İşlemler Tablosu
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL
    )
  `);

  // 3. Borçlar Tablosu
  db.run(`
    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      person TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      dueDate TEXT,
      description TEXT,
      status TEXT DEFAULT 'pending'
    )
  `);

  // 4. Hedefler Tablosu
  db.run(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      title TEXT NOT NULL,
      targetAmount REAL NOT NULL,
      currentAmount REAL DEFAULT 0,
      targetDate TEXT,
      icon TEXT DEFAULT '🎯'
    )
  `);

  // Eski tablolar varsa ve userId kolonu yoksa otomatik ekleme garantisi
  const tablolar = ["transactions", "debts", "goals"];
  tablolar.forEach((tablo) => {
    db.run(`ALTER TABLE ${tablo} ADD COLUMN userId INTEGER`, () => {
      // Kolon zaten varsa hata verir, yok sayılır
    });
  });
});

// ==========================================
// AUTH MIDDLEWARE (GÜVENLİK KAPISI)
// ==========================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Yetkisiz erişim. Lütfen giriş yapın." });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Oturum süresi dolmuş veya geçersiz token." });
    }
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  });
}

// ==========================================
// AUTH API (KAYIT & GİRİŞ)
// ==========================================
app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Kullanıcı adı ve şifre zorunludur." });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: "Şifre en az 4 karakter olmalıdır." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const createdAt = new Date().toISOString();

    const query = `INSERT INTO users (username, password, createdAt) VALUES (?, ?, ?)`;
    db.run(query, [username.trim().toLowerCase(), hashedPassword, createdAt], function (err) {
      if (err) {
        if (err.message.includes("UNIQUE")) {
          return res.status(409).json({ error: "Bu kullanıcı adı zaten alınmış." });
        }
        return res.status(500).json({ error: err.message });
      }

      const token = jwt.sign(
        { userId: this.lastID, username: username.trim().toLowerCase() },
        JWT_SECRET,
        { expiresIn: "30d" }
      );

      res.status(201).json({
        message: "Hesap oluşturuldu.",
        token,
        user: { id: this.lastID, username: username.trim().toLowerCase() }
      });
    });
  } catch (err) {
    res.status(500).json({ error: "Kayıt işlemi başarısız." });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Kullanıcı adı ve şifre girin." });
  }

  const query = `SELECT * FROM users WHERE username = ?`;
  db.get(query, [username.trim().toLowerCase()], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) {
      return res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı." });
    }

    const sifreDogruMu = await bcrypt.compare(password, user.password);
    if (!sifreDogruMu) {
      return res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı." });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      message: "Giriş başarılı.",
      token,
      user: { id: user.id, username: user.username }
    });
  });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ id: req.userId, username: req.username });
});

// ==========================================
// TRANSACTIONS API (KULLANICIYA ÖZEL)
// ==========================================
app.get("/api/transactions", authMiddleware, (req, res) => {
  db.all(
    "SELECT * FROM transactions WHERE userId = ? ORDER BY date DESC, id DESC",
    [req.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post("/api/transactions", authMiddleware, (req, res) => {
  const { type, amount, date, category, description } = req.body;
  if (!type || !amount || !date) {
    return res.status(400).json({ error: "Eksik bilgi girdiniz." });
  }
  const query = `INSERT INTO transactions (userId, type, amount, date, category, description) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(
    query,
    [req.userId, type, amount, date, category || "Diğer", description || category || "İşlem"],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, userId: req.userId, type, amount, date, category, description });
    }
  );
});

app.put("/api/transactions/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  const { type, amount, date, category, description } = req.body;
  const query = `UPDATE transactions SET type = ?, amount = ?, date = ?, category = ?, description = ? WHERE id = ? AND userId = ?`;
  db.run(
    query,
    [type, amount, date, category || "Diğer", description || category || "İşlem", id, req.userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "İşlem güncellendi." });
    }
  );
});

// DÜZELTİLEN SİLME ROTASI
app.delete("/api/transactions/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  const query = "DELETE FROM transactions WHERE id = ? AND userId = ?";
  db.run(query, [id, req.userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) {
      return res.status(404).json({ error: "İşlem bulunamadı veya silme yetkiniz yok." });
    }
    res.json({ message: "İşlem silindi." });
  });
});

// ==========================================
// BORÇ / ALACAK API (KULLANICIYA ÖZEL)
// ==========================================
app.get("/api/debts", authMiddleware, (req, res) => {
  db.all(
    "SELECT * FROM debts WHERE userId = ? ORDER BY status ASC, dueDate ASC, id DESC",
    [req.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post("/api/debts", authMiddleware, (req, res) => {
  const { person, type, amount, dueDate, description } = req.body;
  if (!person || !type || !amount) {
    return res.status(400).json({ error: "Lütfen kişi adı, tür ve miktar girin." });
  }
  const query = `INSERT INTO debts (userId, person, type, amount, dueDate, description, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`;
  db.run(query, [req.userId, person, type, amount, dueDate || "", description || ""], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, userId: req.userId, person, type, amount, dueDate, description, status: "pending" });
  });
});

app.patch("/api/debts/:id/toggle", authMiddleware, (req, res) => {
  const { id } = req.params;
  db.get("SELECT status FROM debts WHERE id = ? AND userId = ?", [id, req.userId], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Kayıt bulunamadı." });
    const yeniDurum = row.status === "completed" ? "pending" : "completed";
    db.run("UPDATE debts SET status = ? WHERE id = ? AND userId = ?", [yeniDurum, id, req.userId], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ status: yeniDurum });
    });
  });
});

app.delete("/api/debts/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM debts WHERE id = ? AND userId = ?", [id, req.userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Kayıt silindi." });
  });
});

// ==========================================
// BİRİKİM & HEDEFLER API (KULLANICIYA ÖZEL)
// ==========================================
app.get("/api/goals", authMiddleware, (req, res) => {
  db.all("SELECT * FROM goals WHERE userId = ? ORDER BY id DESC", [req.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/goals", authMiddleware, (req, res) => {
  const { title, targetAmount, currentAmount, targetDate, icon } = req.body;
  if (!title || !targetAmount) {
    return res.status(400).json({ error: "Hedef adı ve tutarı zorunludur." });
  }
  const query = `INSERT INTO goals (userId, title, targetAmount, currentAmount, targetDate, icon) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(query, [req.userId, title, targetAmount, currentAmount || 0, targetDate || "", icon || "🎯"], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, userId: req.userId, title, targetAmount, currentAmount: currentAmount || 0, targetDate, icon });
  });
});

app.patch("/api/goals/:id/add-funds", authMiddleware, (req, res) => {
  const { id } = req.params;
  const { amountToAdd } = req.body;
  if (!amountToAdd || isNaN(amountToAdd)) {
    return res.status(400).json({ error: "Geçerli bir tutar girin." });
  }
  const query = `UPDATE goals SET currentAmount = currentAmount + ? WHERE id = ? AND userId = ?`;
  db.run(query, [amountToAdd, id, req.userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Tutar kumbaraya eklendi." });
  });
});

app.delete("/api/goals/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM goals WHERE id = ? AND userId = ?", [id, req.userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Hedef silindi." });
  });
});

app.listen(PORT, () => {
  console.log(`Backend http://localhost:${PORT} adresinde çalışıyor.`);
});