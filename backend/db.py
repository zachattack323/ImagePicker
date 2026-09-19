"""One SQLite connection per request, closed automatically by Flask."""
import sqlite3
import sqlite_vec
from flask import current_app, g


def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(current_app.config['DATABASE'])
        g.db.enable_load_extension(True)
        sqlite_vec.load(g.db)
        g.db.enable_load_extension(False)
        g.db.execute('PRAGMA busy_timeout = 10000')
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA foreign_keys = ON')
    return g.db


def close_db(error=None):
    connection = g.pop('db', None)
    if connection is not None:
        connection.close()
