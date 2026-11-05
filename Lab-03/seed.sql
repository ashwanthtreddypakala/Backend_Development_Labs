DROP TABLE IF EXISTS book;

CREATE TABLE book (
  id INTEGER PRIMARY KEY,
  title TEXT,
  author TEXT,
  price INTEGER,
  pages INTEGER
);

INSERT INTO book (title, author, price, pages) VALUES
  ('Eloquent JavaScript', 'Marijn Haverbeke', 599, 472),
  ('You Don''t Know JS Yet', 'Kyle Simpson', 449, 143),
  ('The Pragmatic Programmer', 'Andrew Hunt', 799, 352),
  ('Designing Data-Intensive Applications', 'Martin Kleppmann', 1299, 616),
  ('Node.js Design Patterns', 'Mario Casciaro', 899, 660),
  ('Clean Architecture', 'Robert C. Martin', 749, 432),
  ('Learning SQL', 'Alan Beaulieu', 525, 380),
  ('The Art of Computer Programming', 'Donald Knuth', 1999, 672),
  ('Head First Design Patterns', 'Eric Freeman', 650, 694),
  ('Refactoring', 'Martin Fowler', 850, 448);
