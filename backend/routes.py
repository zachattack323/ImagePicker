"""Board and image routes. All SQL values use bound parameters."""
from urllib.parse import urlparse
from flask import Blueprint, abort, jsonify, request
from db import get_db

api = Blueprint('api', __name__)


def payload():
    """Reject malformed JSON and arrays before handlers access named fields."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400, 'Send a JSON object.')
    return data


def field(data, name, limit, required=False):
    """Apply the same trimming and length rules to every write endpoint."""
    value = data.get(name, '')
    if not isinstance(value, str):
        abort(400, f'{name} must be text.')
    value = value.strip()
    if required and not value:
        abort(400, f'{name} is required.')
    if len(value) > limit:
        abort(400, f'{name} must be at most {limit} characters.')
    return value


def board_or_404(board_id):
    board = get_db().execute('SELECT * FROM boards WHERE id = ?', (board_id,)).fetchone()
    if board is None:
        abort(404, 'Board not found.')
    return dict(board)


@api.get('/boards')
def list_boards():
    # Summaries avoid downloading every saved image just to show the board list.
    rows = get_db().execute('''
        SELECT boards.*, (SELECT COUNT(*) FROM images WHERE board_id = boards.id) AS image_count,
        (SELECT url FROM images WHERE board_id = boards.id ORDER BY id DESC LIMIT 1) AS cover
        FROM boards ORDER BY id DESC
    ''').fetchall()
    return jsonify([dict(row) for row in rows])


@api.post('/boards')
def create_board():
    data = payload()
    title = field(data, 'title', 100, True)
    description = field(data, 'description', 500)
    db = get_db()
    # The connection context commits on success and rolls back on an exception.
    with db:
        result = db.execute('INSERT INTO boards (title, description) VALUES (?, ?)', (title, description))
    return jsonify(board_or_404(result.lastrowid)), 201


@api.get('/boards/<int:board_id>')
def get_board(board_id):
    board = board_or_404(board_id)
    board['images'] = [dict(row) for row in get_db().execute(
        'SELECT * FROM images WHERE board_id = ? ORDER BY id DESC', (board_id,))]
    return jsonify(board)


@api.delete('/boards/<int:board_id>')
def delete_board(board_id):
    board_or_404(board_id)
    db = get_db()
    uploads = [row['url'] for row in db.execute('SELECT url FROM images WHERE board_id = ?', (board_id,))]
    with db:
        db.execute('DELETE FROM boards WHERE id = ?', (board_id,))
    for url in uploads:
        remove_upload(url)
    return '', 204


@api.post('/boards/<int:board_id>/images')
def save_image(board_id):
    board_or_404(board_id)
    data = payload()
    url = field(data, 'url', 2048, True)
    try:
        parsed = urlparse(url)
        valid = parsed.scheme in ('http', 'https') and parsed.hostname and not parsed.username and not parsed.password
    except ValueError:
        valid = False
    if not valid:
        abort(400, 'Use a valid http or https image URL.')
    title = field(data, 'title', 150, True)
    notes = field(data, 'notes', 2000)
    db = get_db()
    # The connection context commits on success and rolls back on an exception.
    with db:
        result = db.execute('INSERT INTO images (board_id, url, title, notes) VALUES (?, ?, ?, ?)',
                            (board_id, url, title, notes))
    from indexer import notify_indexer
    notify_indexer()
    return jsonify(dict(db.execute('SELECT * FROM images WHERE id = ?', (result.lastrowid,)).fetchone())), 201


@api.route('/boards/<int:board_id>/images/<int:image_id>', methods=['PATCH', 'DELETE'])
def change_image(board_id, image_id):
    db = get_db()
    # Match both IDs so an image cannot be changed through the wrong board URL.
    row = db.execute('SELECT * FROM images WHERE id = ? AND board_id = ?', (image_id, board_id)).fetchone()
    if row is None:
        abort(404, 'Image not found in this board.')
    if request.method == 'DELETE':
        with db:
            db.execute('DELETE FROM images WHERE id = ?', (image_id,))
        remove_upload(row['url'])
        return '', 204
    data = payload()
    title = field(data, 'title', 150, True) if 'title' in data else row['title']
    notes = field(data, 'notes', 2000) if 'notes' in data else row['notes']
    with db:
        db.execute('UPDATE images SET title = ?, notes = ? WHERE id = ?', (title, notes, image_id))
    return jsonify(dict(db.execute('SELECT * FROM images WHERE id = ?', (image_id,)).fetchone()))


@api.post('/boards/<int:board_id>/uploads')
def upload_image(board_id):
    """Store re-encoded pixels under a generated name, never the user's filename."""
    from pathlib import Path
    from uuid import uuid4
    from flask import current_app
    from media import decode_image, MAX_BYTES
    from indexer import notify_indexer
    board_or_404(board_id)
    upload = request.files.get('file')
    if upload is None:
        abort(400, 'Choose an image to upload.')
    try:
        image = decode_image(upload.stream.read(MAX_BYTES + 1))
    except ValueError as exc:
        abort(400, str(exc))
    title = (upload.filename or 'Untitled image').replace('\\', '/').split('/')[-1][:150]
    name = uuid4().hex + '.jpg'
    path = Path(current_app.config['UPLOAD_FOLDER']) / name
    image.save(path, format='JPEG', quality=90)
    db = get_db()
    try:
        with db:
            result = db.execute('INSERT INTO images (board_id, url, title) VALUES (?, ?, ?)',
                                (board_id, '/api/uploads/' + name, title))
    except Exception:
        path.unlink(missing_ok=True)
        raise
    notify_indexer()
    return jsonify(dict(db.execute('SELECT * FROM images WHERE id = ?', (result.lastrowid,)).fetchone())), 201


@api.get('/uploads/<name>')
def serve_upload(name):
    import re
    from flask import current_app, send_from_directory
    if not re.fullmatch(r'[a-f0-9]{32}\.jpg', name):
        abort(404)
    response = send_from_directory(current_app.config['UPLOAD_FOLDER'], name, mimetype='image/jpeg')
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


@api.get('/search/status')
def search_status():
    rows = get_db().execute('SELECT index_status, COUNT(*) AS count FROM images GROUP BY index_status')
    counts = {'pending': 0, 'ready': 0, 'failed': 0}
    counts.update({row['index_status']: row['count'] for row in rows})
    return jsonify(counts)


@api.post('/images/<int:image_id>/reindex')
def retry_index(image_id):
    from indexer import notify_indexer
    db = get_db()
    with db:
        result = db.execute("UPDATE images SET index_status = 'pending', index_error = '' WHERE id = ?", (image_id,))
    if not result.rowcount:
        abort(404, 'Image not found.')
    notify_indexer()
    return jsonify(status='pending')


@api.get('/search')
def semantic_search():
    from flask import current_app
    from semantic import embed, MODEL_ID
    query = request.args.get('q', '').strip()
    if not query or len(query) > 300:
        abort(400, 'Enter a search phrase of 1–300 characters.')
    board_id = request.args.get('board_id')
    if board_id is not None:
        if not board_id.isdigit():
            abort(400, 'Invalid board.')
        board_or_404(int(board_id))
    db = get_db()
    if not db.execute('SELECT 1 FROM image_vectors LIMIT 1').fetchone():
        return jsonify(images=[], query=query)
    try:
        vector = current_app.config.get('EMBED_TEXT', embed)(query)
    except Exception:
        current_app.logger.exception('Search model unavailable')
        abort(503, 'The search model is not ready. Check model setup and try again.')
    # Exact cosine ranking runs inside SQLite. Join to live images to keep titles
    # current and apply the board filter before taking the closest 50 results.
    rows = db.execute('''
        SELECT images.*, boards.title AS board_title,
               1 - vec_distance_cosine(image_vectors.embedding, ?) AS similarity
        FROM image_vectors JOIN images ON images.id = image_vectors.image_id
        JOIN boards ON boards.id = images.board_id
        WHERE image_vectors.model = ? AND (? IS NULL OR images.board_id = ?)
        ORDER BY similarity DESC, images.id DESC LIMIT 50
    ''', (vector, MODEL_ID, board_id, board_id)).fetchall()
    return jsonify(images=[dict(row) for row in rows], query=query)


def remove_upload(url):
    """Delete only files owned by this app, after the database deletion commits."""
    from pathlib import Path
    from flask import current_app
    import re
    if re.fullmatch(r'/api/uploads/[a-f0-9]{32}\.jpg', url):
        (Path(current_app.config['UPLOAD_FOLDER']) / url.rsplit('/', 1)[1]).unlink(missing_ok=True)
