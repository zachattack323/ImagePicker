"""Application factory: configure Flask, initialize SQLite, register the API."""
from pathlib import Path
from flask import Flask, jsonify
from indexer import start_indexer
from werkzeug.exceptions import HTTPException
from db import close_db, get_db
from routes import api


def create_app(database=None, start_worker=True, upload_folder=None):
    app = Flask(__name__)
    app.config['DATABASE'] = database or str(Path(__file__).parent / 'imageshare.sqlite3')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
    app.config['UPLOAD_FOLDER'] = upload_folder or str(Path(app.config['DATABASE']).parent / 'uploads')
    Path(app.config['UPLOAD_FOLDER']).mkdir(parents=True, exist_ok=True)
    app.teardown_appcontext(close_db)
    with app.app_context():
        db = get_db()
        db.execute('PRAGMA journal_mode = WAL')
        # Add columns in place so existing boards and images are preserved.
        get_db().executescript((Path(__file__).parent / 'schema.sql').read_text())
        columns = {row['name'] for row in db.execute('PRAGMA table_info(images)')}
        for name, definition in [('index_status', "TEXT NOT NULL DEFAULT 'pending'"), ('index_error', "TEXT NOT NULL DEFAULT ''")]:
            if name not in columns:
                db.execute(f'ALTER TABLE images ADD COLUMN {name} {definition}')
        db.commit()
    app.register_blueprint(api, url_prefix='/api')

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify(error=error.description), error.code

    if start_worker:
        start_indexer(app)
    return app
