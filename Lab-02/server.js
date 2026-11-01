const express = require("express");
const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

// Parse incoming JSON request bodies.
app.use(express.json());

// Handle malformed JSON body errors cleanly
app.use((err, request, response, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return response.status(400).json({ error: "Malformed JSON in request body." });
  }
  next(err);
});

// ── Database ──────────────────────────────────────────────────────────────────

// db will hold the open database connection after startup.
let db;

async function startServer() {
  // Open (or create) books.db. If this fails we log the real error and exit.
  try {
    db = await sqlite.open({
      filename: "./books.db",
      driver: sqlite3.Database
    });
    console.log("Connected to books.db");
  } catch (error) {
    console.error("Failed to open the database:", error.message);
    process.exit(1);
  }

  // Start listening only after the database is ready.
  app.listen(PORT, () => {
    console.log(`Express server running at http://localhost:${PORT}`);
  });
}

// ── Helper ────────────────────────────────────────────────────────────────────

// Returns true if the value is a whole positive number (e.g. 1, 2, 42).
// Rejects strings like "abc", floats like "1.5", zero, and negatives.
function isPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
}

// Returns true if the body has all four required book fields with valid types.
function isValidBookBody(body) {
  const { title, author, price, pages } = body;
  return (
    typeof title === "string" && title.trim() !== "" &&
    typeof author === "string" && author.trim() !== "" &&
    Number.isInteger(price) && price >= 0 &&
    Number.isInteger(pages) && pages >= 0
  );
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /books/ — Return all books
app.get(["/books", "/books/"], async (request, response) => {
  try {
    const books = await db.all("SELECT * FROM book");
    response.status(200).json(books);
  } catch (error) {
    console.error("GET /books/ error:", error.message);
    response.status(500).json({ error: "Internal server error. Could not fetch books." });
  }
});

// GET /books/:bookId/ — Return a single book by id
app.get(["/books/:bookId", "/books/:bookId/"], async (request, response) => {
  const { bookId } = request.params;

  // Validate that bookId is a positive whole number.
  if (!isPositiveInteger(bookId)) {
    return response.status(400).json({ error: "bookId must be a positive whole number." });
  }

  try {
    const book = await db.get("SELECT * FROM book WHERE id = ?", [Number(bookId)]);

    if (!book) {
      return response.status(404).json({ error: `No book found with id ${bookId}.` });
    }

    response.status(200).json(book);
  } catch (error) {
    console.error(`GET /books/${bookId}/ error:`, error.message);
    response.status(500).json({ error: "Internal server error. Could not fetch the book." });
  }
});

// POST /books/ — Add a new book
app.post(["/books", "/books/"], async (request, response) => {
  const body = request.body;

  // Validate all required fields are present and have correct types.
  if (!body || !isValidBookBody(body)) {
    return response.status(400).json({
      error: "Request body must include: title (string), author (string), price (integer), pages (integer)."
    });
  }

  const { title, author, price, pages } = body;

  try {
    const result = await db.run(
      "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)",
      [title.trim(), author.trim(), price, pages]
    );

    response.status(201).json({
      message: "Book added",
      bookId: result.lastID,
      id: result.lastID
    });
  } catch (error) {
    console.error("POST /books/ error:", error.message);
    response.status(500).json({ error: "Internal server error. Could not add the book." });
  }
});

// PUT /books/:bookId/ — Update all fields of an existing book
app.put(["/books/:bookId", "/books/:bookId/"], async (request, response) => {
  const { bookId } = request.params;
  const body = request.body;

  // Validate bookId.
  if (!isPositiveInteger(bookId)) {
    return response.status(400).json({ error: "bookId must be a positive whole number." });
  }

  // Validate all four body fields.
  if (!body || !isValidBookBody(body)) {
    return response.status(400).json({
      error: "Request body must include: title (string), author (string), price (integer), pages (integer)."
    });
  }

  const { title, author, price, pages } = body;

  try {
    const result = await db.run(
      "UPDATE book SET title = ?, author = ?, price = ?, pages = ? WHERE id = ?",
      [title.trim(), author.trim(), price, pages, Number(bookId)]
    );

    // result.changes is 0 when no row matched the given id.
    if (result.changes === 0) {
      return response.status(404).json({ error: `No book found with id ${bookId}.` });
    }

    response.status(200).json({ message: "Book updated" });
  } catch (error) {
    console.error(`PUT /books/${bookId}/ error:`, error.message);
    response.status(500).json({ error: "Internal server error. Could not update the book." });
  }
});

// DELETE /books/:bookId/ — Delete a book
app.delete(["/books/:bookId", "/books/:bookId/"], async (request, response) => {
  const { bookId } = request.params;

  // Validate bookId.
  if (!isPositiveInteger(bookId)) {
    return response.status(400).json({ error: "bookId must be a positive whole number." });
  }

  try {
    const result = await db.run(
      "DELETE FROM book WHERE id = ?",
      [Number(bookId)]
    );

    // result.changes is 0 when no row matched the given id.
    if (result.changes === 0) {
      return response.status(404).json({ error: `No book found with id ${bookId}.` });
    }

    response.status(200).json({ message: "Book deleted" });
  } catch (error) {
    console.error(`DELETE /books/${bookId}/ error:`, error.message);
    response.status(500).json({ error: "Internal server error. Could not delete the book." });
  }
});

// Unknown routes — must be defined after all other routes
app.use((request, response) => {
  response.status(404).json({ error: "404 - Route not found." });
});

// ── Start ─────────────────────────────────────────────────────────────────────

startServer();

