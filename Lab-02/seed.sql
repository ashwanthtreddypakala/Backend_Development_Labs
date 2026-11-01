-- seed.sql
-- Creates the book table and inserts the 10 course books.
-- Run with: sqlite3 books.db < seed.sql

DROP TABLE IF EXISTS book;

CREATE TABLE book (
  id      INTEGER PRIMARY KEY,
  title   TEXT    NOT NULL,
  author  TEXT    NOT NULL,
  price   INTEGER NOT NULL,
  pages   INTEGER NOT NULL
);

INSERT INTO book (title, author, price, pages) VALUES
  ('The Alchemist',           'Paulo Coelho',         299, 208),
  ('Wings of Fire',           'A. P. J. Abdul Kalam', 350, 196),
  ('Atomic Habits',           'James Clear',          499, 320),
  ('The Guide',               'R. K. Narayan',        275, 220),
  ('Godan',                   'Munshi Premchand',     199, 344),
  ('The White Tiger',         'Aravind Adiga',        399, 321),
  ('Train to Pakistan',       'Khushwant Singh',      250, 181),
  ('The God of Small Things', 'Arundhati Roy',        450, 340),
  ('Malgudi Days',            'R. K. Narayan',        225, 256),
  ('Clean Code',              'Robert C. Martin',     499, 431);
