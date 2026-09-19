"""Process persistent pending jobs in one background worker per Flask process."""
import threading
from pathlib import Path
from flask import current_app
from db import get_db
from media import decode_image, fetch_image
from semantic import embed, MODEL_ID


def start_indexer(app):
    wake = threading.Event()
    app.extensions['index_wake'] = wake

    def run():
        while True:
            wake.wait(timeout=3)
            wake.clear()
            with app.app_context():
                db = get_db()
                rows = db.execute("SELECT id, url FROM images WHERE index_status = 'pending' ORDER BY id").fetchall()
                for row in rows:
                    try:
                        if row['url'].startswith('/api/uploads/'):
                            name = row['url'].removeprefix('/api/uploads/')
                            if Path(name).name != name:
                                raise ValueError('Invalid upload path.')
                            image = decode_image((Path(app.config['UPLOAD_FOLDER']) / name).read_bytes())
                        else:
                            image = fetch_image(row['url'])
                        vector = app.config.get('EMBED_IMAGE', lambda value: embed(value, image=True))(image)
                        # A user may delete the image while inference is running.
                        # Recheck inside the write transaction to prevent orphan vectors.
                        with db:
                            db.execute('BEGIN IMMEDIATE')
                            if db.execute('SELECT id FROM images WHERE id = ? AND url = ?', (row['id'], row['url'])).fetchone():
                                db.execute('INSERT OR REPLACE INTO image_vectors (image_id, embedding, model) VALUES (?, ?, ?)',
                                           (row['id'], vector, MODEL_ID))
                                db.execute("UPDATE images SET index_status = 'ready', index_error = '' WHERE id = ?", (row['id'],))
                    except Exception as exc:
                        app.logger.warning('Indexing image %s failed: %s', row['id'], exc)
                        message = str(exc) if isinstance(exc, ValueError) else 'Could not index this image. Check the source and model setup, then retry.'
                        with db:
                            db.execute("UPDATE images SET index_status = 'failed', index_error = ? WHERE id = ? AND url = ?", (message, row['id'], row['url']))

    threading.Thread(target=run, name='image-indexer', daemon=True).start()
    wake.set()


def notify_indexer():
    event = current_app.extensions.get('index_wake')
    if event:
        event.set()
