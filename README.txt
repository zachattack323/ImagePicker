IMAGESHARE
Change++ Fall 2026 Coding Challenge

Full name: Zachary Hixon
Vanderbilt email: zachary.j.hixon@vanderbilt.edu

OVERVIEW
ImageShare is a website for organizing images into boards and finding saved
images with natural-language search. It uses a React + TypeScript frontend,
shadcn/ui, a separate Python Flask REST API, and SQLite. A Chrome extension
lets users save web images directly to a board.

FEATURES
- Create and view boards; delete a board and its images.
- Save image URLs or drag and drop image files into a board.
- Edit image titles and notes; remove individual images.
- Search saved images by their visual content using local CLIP embeddings.
- Store images, board metadata, and search vectors persistently.
- Track background indexing progress and retry failed images.
- Save images from Chrome, choose a board, or create a new board.

DOWNLOAD AND REQUIREMENTS
Repository: https://github.com/zachattack323/ImagePicker
Choose Code > Download ZIP and extract it, or clone it:
  git clone https://github.com/zachattack323/ImagePicker.git
  cd ImagePicker
Open a terminal in the extracted/cloned folder containing this README.txt.

Required:
- Python 3.12 with SQLite extension loading enabled.
- Node.js 22.12+ and pnpm 11.19.0.
- Internet for package installation, the first CLIP model download, and
  images hosted on other websites. No API key or paid service is required.

The commands below are for macOS/Linux. The app was tested on Apple Silicon
macOS. On macOS, use Homebrew's Python 3.12 rather than Apple's system Python:
  brew install python@3.12

If pnpm is not installed, after installing Node.js:
  npm install --global pnpm@11.19.0

SETUP
Run these commands from the project root:
  python3.12 -m venv backend/.venv-search
  backend/.venv-search/bin/python -m pip install -r backend/requirements.txt
  cd frontend
  pnpm install --frozen-lockfile
  cd ..

Verify SQLite extension support:
  backend/.venv-search/bin/python -c "import sqlite3; assert hasattr(sqlite3.connect(':memory:'), 'enable_load_extension')"

Download and warm the search model once (approximately 600 MB of weights):
  cd backend
  .venv-search/bin/python -c "from semantic import embed; embed('a landscape')"
  cd ..

This may take a few minutes. The model is cached locally; it is not included
in the repository. If this step is skipped, the first indexing/search task
loads it automatically.

RUN
Terminal 1, from the project root:
  ./scripts/backend.sh

Terminal 2, from the project root:
  cd frontend
  pnpm dev

Open http://127.0.0.1:5173 in a browser. The frontend runs on port 5173 and
forwards /api requests to the separate Flask server on port 5001.
Stop either server with Ctrl+C in its terminal.

Windows: use Python 3.12, replace backend/.venv-search/bin/python with
backend\.venv-search\Scripts\python.exe, and start Flask directly:
  backend\.venv-search\Scripts\python.exe -m flask --app backend/app.py run --port 5001
Use that Python executable for the model warmup and tests too. The frontend
commands are the same. Windows has not been tested.

QUICK DEMO
1. Create a board, then open it.
2. Drop a few different images into the upload area, or click Choose files.
   You can also click Save an image and paste a direct image URL.
3. Wait until each image is marked Searchable.
4. Search a description such as "a cat on a sofa" or "sunset by the water."
   Results search across all boards and are ordered by visual similarity.
5. Click a result to open its board. Edit its title/notes or remove it.
6. Restart the servers and reopen the board to check persistence.

CHROME EXTENSION (OPTIONAL)
1. Keep the backend running.
2. Open chrome://extensions in Chrome 123+ and enable Developer mode.
3. Click Load unpacked and select the extension/ folder, not the project root.
4. Pin ImageShare, or right-click an image > Save image to ImageShare.
5. Choose a board, edit the title/notes, and save. The same backend indexes it.

The toolbar also offers a picker for images on the current page. No extension
build is required. See extension/README.md for permissions and limitations.

HOW SEARCH AND STORAGE WORK
CLIP (openai/clip-vit-base-patch32) converts image pixels and search text into
normalized 512-dimensional vectors. sqlite-vec calculates cosine distance
inside SQLite and returns the closest 50 images. This is exact vector search
for a personal library, not a separate cloud database or approximate index.
Filenames and notes are not used for semantic ranking. Results are approximate
in meaning and may include weak matches when the library is small.

Uploads are saved immediately. One background worker processes pending images;
SQLite stores each job's status so unfinished jobs resume after a restart.
Model inference runs locally. Remote image URLs still contact their host site.

Metadata and vectors: backend/imageshare.sqlite3
Uploaded image files: backend/uploads/
Both are created automatically and excluded from Git. Back up both together.
Deleting an image or board removes its vectors and owned upload files.

PROJECT STRUCTURE
  backend/app.py           Flask configuration and database migration
  backend/routes.py        REST endpoints and validation
  backend/db.py            Request-scoped SQLite connections
  backend/schema.sql       Tables and foreign-key relationships
  backend/semantic.py      CLIP text/image embeddings
  backend/indexer.py       Background indexing queue
  backend/media.py         Image validation and safe URL downloading
  backend/test_*.py        API and search integration tests
  frontend/src/App.tsx     Board interface and forms
  frontend/src/api.ts      Typed API client
  frontend/src/components/ Upload/search UI and shadcn/ui components
  extension/              Chrome extension source and installation guide
  scripts/                Local server launch helpers

REST API
  GET    /api/boards                       List boards
  POST   /api/boards                       Create {title, description?}
  GET    /api/boards/:id                   Get board and saved images
  DELETE /api/boards/:id                   Delete board and its images
  POST   /api/boards/:id/images            Save {url, title, notes?}
  POST   /api/boards/:id/uploads           Upload a multipart "file"
  PATCH  /api/boards/:id/images/:imageId   Update {title?, notes?}
  DELETE /api/boards/:id/images/:imageId   Remove image
  GET    /api/uploads/:name                Serve uploaded JPEG
  GET    /api/search?q=phrase              Search; optional board_id filter
  GET    /api/search/status                Ready/pending/failed counts
  POST   /api/images/:id/reindex           Retry indexing
Errors return an HTTP error status and a JSON "error" message.

VALIDATION
From the project root:
  backend/.venv-search/bin/python -m unittest discover -s backend -v
  cd frontend
  pnpm build

The automated tests cover persistence, validation, uploads, cleanup, vector
ranking, filtering, and retries. Ranking tests use fixed embeddings; they do
not evaluate model quality. Real CLIP ranking and browser/extension save flows
were also checked manually during development.

CURRENT LIMITATIONS
- Collection sharing, collaboration, accounts, and a share endpoint are not
  implemented. Sharing is a remaining challenge requirement.
- This is a local, single-user website. It is not publicly hosted and has no
  authentication or per-user permissions.
- Search covers saved/uploaded images; it does not discover images online.
- Supported uploads: JPEG, PNG, WebP, GIF; up to 15 MB and 25 million pixels.
  Images are re-encoded as JPEG, resized to a 2048px maximum edge, and stripped
  of metadata. Transparency, animation, and original resolution are not kept.
- Some sites block image downloading. If a URL cannot be indexed, upload the
  file instead. The extension saves links, not authenticated image copies.

REFLECTION
I chose Flask and SQLite because I was more comfortable working in Python.
The main challenge was connecting image storage, the website, and semantic
search without making uploads feel slow. Background indexing lets an image
save before its search vector is ready, and the UI shows failures so they can
be retried. I also added a Chrome extension to make collecting images easier.
The next improvement would be collection sharing and collaboration, which
are not implemented in this version.

FEEDBACK
The flexible project format made it possible to use Python and explore image
search. The scoring table could be clearer: the Core Features heading says
"up to 3 points" but includes a 5-point tier, and Data Handling says "up to
5 points" while its highest listed tier is 3 points.

CHALLENGE SUBMISSION
The original challenge instructions are preserved in README.md.
Submit the forked GitHub repository using the required completion form:
https://forms.gle/JfR4cwAEwn4HhBuX8
The brief lists the deadline as September 18, 2026 at 11:59 PM Central.
