"""API tests use fixed embeddings; real CLIP is checked separately without mocks."""
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image
from app import create_app
from db import get_db
from media import fetch_image
from semantic import MODEL_ID


def picture(color='red'):
    output = io.BytesIO()
    Image.new('RGB', (40, 40), color).save(output, format='PNG')
    output.seek(0)
    return output


def vector(axis):
    data = np.zeros(512, dtype=np.float32)
    data[axis] = 1
    return data.tobytes()


class SearchTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.temp.name) / 'test.sqlite3')
        self.app = create_app(self.path, start_worker=False)
        self.app.config['EMBED_TEXT'] = lambda text: vector(0)
        self.client = self.app.test_client()
        self.board = self.client.post('/api/boards', json={'title': 'Test'}).json['id']

    def tearDown(self):
        self.temp.cleanup()

    def upload(self, board=None):
        result = self.client.post(f'/api/boards/{board or self.board}/uploads', data={'file': (picture(), '../../test.png')})
        self.assertEqual(result.status_code, 201)
        return result.json

    def index(self, image, axis):
        with self.app.app_context():
            db = get_db()
            with db:
                db.execute('INSERT INTO image_vectors VALUES (?, ?, ?)', (image['id'], vector(axis), MODEL_ID))
                db.execute("UPDATE images SET index_status = 'ready' WHERE id = ?", (image['id'],))

    def test_upload_validation_serving_and_cleanup(self):
        image = self.upload()
        self.assertEqual(image['index_status'], 'pending')
        self.assertNotIn('test.png', image['url'])
        with self.client.get(image['url']) as response:
            self.assertEqual(response.mimetype, 'image/jpeg')
        invalid = self.client.post(f'/api/boards/{self.board}/uploads', data={'file': (io.BytesIO(b'not an image'), 'fake.png')})
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(self.client.post('/api/boards/999/uploads', data={'file': (picture(), 'test.png')}).status_code, 404)
        self.client.delete(f"/api/boards/{self.board}/images/{image['id']}")
        self.assertEqual(self.client.get(image['url']).status_code, 404)

    def test_vector_ranking_filter_restart_delete(self):
        first = self.upload()
        second_board = self.client.post('/api/boards', json={'title': 'Other'}).json['id']
        second = self.upload(second_board)
        self.index(first, 1)
        self.index(second, 0)
        result = self.client.get('/api/search?q=something').json['images']
        self.assertEqual([r['id'] for r in result], [second['id'], first['id']])
        scoped = self.client.get(f'/api/search?q=something&board_id={self.board}').json['images']
        self.assertEqual([r['id'] for r in scoped], [first['id']])
        restarted = create_app(self.path, start_worker=False)
        restarted.config['EMBED_TEXT'] = lambda text: vector(0)
        self.assertEqual(len(restarted.test_client().get('/api/search?q=something').json['images']), 2)
        self.client.delete(f'/api/boards/{second_board}')
        self.assertEqual(self.client.get(second['url']).status_code, 404)
        self.assertEqual(len(self.client.get('/api/search?q=something').json['images']), 1)
        self.assertEqual(self.client.get('/api/search?q=').status_code, 400)
        self.assertEqual(self.client.get('/api/search?q=cat&board_id=bad').status_code, 400)

    def test_empty_status_and_retry(self):
        self.assertEqual(self.client.get('/api/search?q=cat').json['images'], [])
        image = self.upload()
        self.assertEqual(self.client.get('/api/search/status').json['pending'], 1)
        with self.app.app_context():
            db = get_db()
            with db:
                db.execute("UPDATE images SET index_status='failed', index_error='test'")
        self.assertEqual(self.client.post(f"/api/images/{image['id']}/reindex").status_code, 200)
        self.assertEqual(self.client.get('/api/search/status').json['failed'], 0)
        self.assertEqual(self.client.post('/api/images/999/reindex').status_code, 404)

    def test_private_remote_sources_are_blocked(self):
        for url in ['http://127.0.0.1/x', 'http://169.254.169.254/x', 'http://[::1]/x', 'file:///etc/passwd']:
            with self.assertRaises(ValueError):
                fetch_image(url)
        # DNS names resolving to private addresses are blocked too.
        with patch('media.socket.getaddrinfo', return_value=[(2, 1, 6, '', ('10.0.0.1', 80))]):
            with self.assertRaises(ValueError):
                fetch_image('http://example.com/photo.jpg')


if __name__ == '__main__':
    unittest.main()
