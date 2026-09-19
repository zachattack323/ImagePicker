CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS images_board_id ON images(board_id);

-- Vectors share the metadata transaction and disappear with their parent image.
-- Exact cosine search is appropriate for a personal collection; no separate server.
CREATE TABLE IF NOT EXISTS image_vectors (
    image_id INTEGER PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
    embedding BLOB NOT NULL CHECK (length(embedding) = 2048),
    model TEXT NOT NULL
);
