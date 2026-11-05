const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());

const DB_FILE = path.join(__dirname, "books.db");
const PORT = process.env.PORT || 3000;

let db = null;

// ---------- constants ----------

const SORTABLE_COLUMNS = ["id", "title", "author", "price", "pages"];
const MAX_INT = 2147483647;
const MAX_PAGE_SIZE = 100;

// ---------- helpers ----------

// An error that carries an HTTP status code, so one handler at the
// bottom of the file can turn it into a JSON response.
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Reads one query parameter. Missing or empty -> default value.
// ?limit=1&limit=2 gives an array, which we do not accept.
const readParam = (query, name, defaultValue) => {
  const raw = query[name];
  if (raw === undefined || raw === "") return defaultValue;
  if (Array.isArray(raw)) {
    throw new ApiError(400, `${name} can be given only once`);
  }
  return raw;
};

// Reads a query parameter that must be a whole number in [min, max].
const readInteger = (query, name, defaultValue, min, max) => {
  const raw = readParam(query, name, null);
  if (raw === null) return defaultValue;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ApiError(400, `${name} must be a whole number from ${min} to ${max}`);
  }
  return value;
};

// Turns the :bookId path parameter into a number or rejects it.
const readBookId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(400, "bookId must be a positive whole number");
  }
  return id;
};

// LIKE treats % and _ as wildcards. Escape them so the search text
// is matched literally.
const escapeLike = (text) => text.replace(/[\\%_]/g, "\\$&");

// Validates the JSON body used by POST and PUT.
const validateBookBody = (body) => {
  const data = body || {};
  const isFilled = (v) => typeof v === "string" && v.trim() !== "";
  const isCount = (v) => Number.isInteger(v) && v >= 0;

  if (!isFilled(data.title)) {
    throw new ApiError(400, "title is required and must be non-empty text");
  }
  if (!isFilled(data.author)) {
    throw new ApiError(400, "author is required and must be non-empty text");
  }
  if (!isCount(data.price)) {
    throw new ApiError(400, "price is required and must be a whole number, 0 or more");
  }
  if (!isCount(data.pages)) {
    throw new ApiError(400, "pages is required and must be a whole number, 0 or more");
  }
  return {
    title: data.title.trim(),
    author: data.author.trim(),
    price: data.price,
    pages: data.pages,
  };
};

// ---------- routes ----------

// GET /books/ : list with search, sort, pagination and price range
app.get("/books/", async (req, res) => {
  const searchText = String(readParam(req.query, "search_q", ""));
  const orderBy = String(readParam(req.query, "order_by", "id")).toLowerCase();
  const direction = String(readParam(req.query, "order", "ASC")).toUpperCase();
  const limit = readInteger(req.query, "limit", 10, 1, MAX_PAGE_SIZE);
  const offset = readInteger(req.query, "offset", 0, 0, MAX_INT);
  const minPrice = readInteger(req.query, "min_price", 0, 0, MAX_INT);
  const maxPrice = readInteger(req.query, "max_price", MAX_INT, 0, MAX_INT);

  if (!SORTABLE_COLUMNS.includes(orderBy)) {
    throw new ApiError(400, `order_by must be one of: ${SORTABLE_COLUMNS.join(", ")}`);
  }
  if (direction !== "ASC" && direction !== "DESC") {
    throw new ApiError(400, "order must be ASC or DESC");
  }
  if (minPrice > maxPrice) {
    throw new ApiError(400, "min_price cannot be greater than max_price");
  }

  // Column names and ASC/DESC cannot be bound with "?", but both have
  // just been checked against fixed lists, so they are safe to insert.
  const sql = `
    SELECT * FROM book
    WHERE title LIKE ? ESCAPE '\\'
      AND price BETWEEN ? AND ?
    ORDER BY ${orderBy} ${direction}
    LIMIT ? OFFSET ?;`;
  const rows = await db.all(sql, [
    `%${escapeLike(searchText)}%`,
    minPrice,
    maxPrice,
    limit,
    offset,
  ]);
  res.status(200).json(rows);
});

// GET /books/:bookId/ : one book
app.get("/books/:bookId/", async (req, res) => {
  const id = readBookId(req.params.bookId);
  const book = await db.get("SELECT * FROM book WHERE id = ?;", [id]);
  if (!book) {
    throw new ApiError(404, "Book not found");
  }
  res.status(200).json(book);
});

// POST /books/ : create
app.post("/books/", async (req, res) => {
  const { title, author, price, pages } = validateBookBody(req.body);
  const result = await db.run(
    "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?);",
    [title, author, price, pages]
  );
  res.status(201).json({ message: "Book added", bookId: result.lastID });
});

// PUT /books/:bookId/ : replace every field of an existing book
app.put("/books/:bookId/", async (req, res) => {
  const id = readBookId(req.params.bookId);
  const { title, author, price, pages } = validateBookBody(req.body);
  const result = await db.run(
    "UPDATE book SET title = ?, author = ?, price = ?, pages = ? WHERE id = ?;",
    [title, author, price, pages, id]
  );
  if (result.changes === 0) {
    throw new ApiError(404, "Book not found");
  }
  res.status(200).json({ message: "Book updated" });
});

// DELETE /books/:bookId/ : remove
app.delete("/books/:bookId/", async (req, res) => {
  const id = readBookId(req.params.bookId);
  const result = await db.run("DELETE FROM book WHERE id = ?;", [id]);
  if (result.changes === 0) {
    throw new ApiError(404, "Book not found");
  }
  res.status(200).json({ message: "Book deleted" });
});

// ---------- fallbacks ----------

// No route matched
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Every error ends up here (Express 5 forwards errors from async routes)
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body is not valid JSON" });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

// ---------- start ----------

const startServer = async () => {
  try {
    db = await open({ filename: DB_FILE, driver: sqlite3.Database });
  } catch (err) {
    console.error(`Could not open the database: ${err.message}`);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // EADDRINUSE (port already taken) arrives here
  server.on("error", (err) => {
    console.error(`Server error: ${err.message}`);
    process.exit(1);
  });
};

startServer();
