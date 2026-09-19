ImageShare
Change++ Fall 2026 Coding Challenge

Full name: Zachary Hixon
Vanderbilt email: zachary.j.hixon@vanderbilt.edu

About the project

ImageShare is a place to save images in boards and find them again by describing
what's in them. You can paste an image URL, drag in a file, or save something
from a webpage with the Chrome extension. Images can have titles and notes,
and you can edit or delete them later.

I used React and TypeScript with shadcn/ui for the website, and Flask and
SQLite for the backend. The image search uses CLIP and runs locally.

Getting it running

You'll need Python 3.12 with SQLite extension support, Node.js 22.12 or newer,
and pnpm 11.19.0. Setup needs an internet connection, but there are no API keys
to configure. These steps were tested on macOS with Apple Silicon.

On macOS, Homebrew's Python 3.12 has the SQLite support this project needs:
  brew install python@3.12

If you already have Node but need pnpm:
  npm install --global pnpm@11.19.0

Clone the repo and open its folder:
  git clone https://github.com/zachattack323/ImagePicker.git
  cd ImagePicker

You can also use Code > Download ZIP on GitHub. Extract it and open a terminal
in the folder containing this README.txt.

Install the backend and frontend dependencies:
  python3.12 -m venv backend/.venv-search
  backend/.venv-search/bin/python -m pip install -r backend/requirements.txt
  cd frontend
  pnpm install --frozen-lockfile
  cd ..

Check that Python can load SQLite extensions:
  backend/.venv-search/bin/python -c "import sqlite3; assert hasattr(sqlite3.connect(':memory:'), 'enable_load_extension')"

The search model downloads about 600 MB of weights the first time it runs.
You can get that out of the way before opening the app:
  cd backend
  .venv-search/bin/python -c "from semantic import embed; embed('a landscape')"
  cd ..

This can take a few minutes. If you skip it, the first search or image indexing
job downloads the model instead. After that, the model stays cached locally.

Start the backend from the project root:
  ./scripts/backend.sh

In a second terminal, start the website:
  cd frontend
  pnpm dev

Open http://127.0.0.1:5173. The website forwards API requests to Flask on port
5001, so both terminals need to stay running. Ctrl+C stops each server.

On Windows, use backend\.venv-search\Scripts\python.exe in place of the
bin/python path. Start Flask with:
  backend\.venv-search\Scripts\python.exe -m flask --app backend/app.py run --port 5001
The frontend commands are the same. Windows hasn't been tested.

Trying it out

Create a board and open it. Drop a few images into the upload area, use Choose
files, or click Save an image to paste a direct image URL.

Once an image says Searchable, try a description like "a cat on a sofa" or
"sunset by the water." Search looks through your saved images across all
boards. Click a result to open its board. You can edit titles and notes there,
or remove an image. If indexing fails, there's an option to retry it.

Boards and images stay saved when you restart the app.

Chrome extension

Keep the backend running, then:
1. Open chrome://extensions in Chrome 123 or newer.
2. Turn on Developer mode and click Load unpacked.
3. Select this project's extension folder.
4. Right-click an image on a webpage and choose Save image to ImageShare.
5. Pick a board, add a title or notes, and save it.

You can also pin the extension and use its popup to pick images from the
current page or paste a URL. There's no build step for the extension.
More details are in extension/README.md.

How search and storage work

CLIP (openai/clip-vit-base-patch32) turns images and search phrases into
512-dimensional vectors. sqlite-vec compares them using cosine distance and
returns the closest 50 saved images. It searches the picture itself; titles,
filenames and notes don't affect the ranking. With only a few saved images,
some results may not be very relevant.

Images save before indexing finishes. A background worker builds the search
vectors, and unfinished jobs resume when the backend starts again. The model
runs on your computer. Saving a remote URL still requires downloading that
image from its host website.

SQLite stores the board information and vectors in backend/imageshare.sqlite3.
Uploaded files go in backend/uploads/. Both are created automatically and kept
out of Git. Back up both if you want to keep your library. Deleting an image
also removes its vector and any uploaded file that belongs to it.

The code is split into backend/ for Flask and search, frontend/src/ for the
website, and extension/ for the Chrome extension. The scripts/ folder has
shortcuts for starting the development servers.

Running the checks

From the project root:
  backend/.venv-search/bin/python -m unittest discover -s backend -v
  cd frontend
  pnpm build

The tests cover saving data, input validation, uploads, cleanup, search ranking,
board filtering and retries. Search tests use fixed vectors, so they check the
search code rather than CLIP's accuracy.

What's still missing

Sharing and collaboration aren't built yet, even though sharing is part of
the challenge. There are no accounts or permissions, and the app currently
runs locally for one person. Search only covers images you've saved or
uploaded; it doesn't find new images online.

Uploads can be JPEG, PNG, WebP or GIF, up to 15 MB and 25 million pixels. They
are converted to JPEG and resized to a maximum edge of 2048 pixels. This drops
metadata, transparency and animation, so keep the originals if you need them.

Some websites block image downloads. If a saved URL won't index, uploading
the file is another option. The extension saves links and can't copy images
that require a login to download.

Reflection

I picked Flask and SQLite because I was more comfortable with Python.
The main challenge was linking the image storage, the website and semantic
search without making uploads feel slow. Background indexing allows an image
to save before its search vector is ready and the UI shows failures so that
they can be retried. I also picked up a Chrome extension to make collecting
images easier.
The next step would be sharing and collaboration of collections which are not
implemented in this version yet.

The original challenge instructions are in README.md.
