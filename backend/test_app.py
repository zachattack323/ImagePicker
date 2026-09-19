"""Exercise persistence, validation, and board boundaries with temporary databases."""
import tempfile
import unittest
from pathlib import Path
from app import create_app


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.temp.name) / 'test.sqlite3')
        self.client = create_app(self.path, start_worker=False).test_client()

    def tearDown(self):
        self.temp.cleanup()

    def board(self):
        response = self.client.post('/api/boards', json={'title': 'My inspiration'})
        self.assertEqual(response.status_code, 201)
        return response.json['id']

    def test_save_restart_edit_and_delete(self):
        board = self.board()
        response = self.client.post(f'/api/boards/{board}/images', json={
            'title': 'Mountains', 'url': 'https://example.com/photo.jpg', 'notes': 'Go here'})
        self.assertEqual(response.status_code, 201)
        image = response.json['id']
        # A fresh Flask application must read the same data from disk.
        restarted = create_app(self.path, start_worker=False).test_client()
        self.assertEqual(restarted.get(f'/api/boards/{board}').json['images'][0]['notes'], 'Go here')
        response = restarted.patch(f'/api/boards/{board}/images/{image}', json={'notes': 'Next summer'})
        self.assertEqual(response.json['notes'], 'Next summer')
        self.assertEqual(response.json['title'], 'Mountains')
        self.assertEqual(restarted.delete(f'/api/boards/{board}/images/{image}').status_code, 204)
        self.assertEqual(restarted.get(f'/api/boards/{board}').json['images'], [])

    def test_validation_and_wrong_board(self):
        self.assertEqual(self.client.post('/api/boards', json={'title': '  '}).status_code, 400)
        self.assertEqual(self.client.post('/api/boards', json=[]).status_code, 400)
        first, second = self.board(), self.board()
        for url in ['javascript:alert(1)', 'file:///tmp/a', 'https://[invalid']:
            self.assertEqual(self.client.post(f'/api/boards/{first}/images', json={'title': 'Bad', 'url': url}).status_code, 400)
        image = self.client.post(f'/api/boards/{first}/images', json={'title': 'A', 'url': 'https://example.com/a.png'}).json['id']
        self.assertEqual(self.client.delete(f'/api/boards/{second}/images/{image}').status_code, 404)
        self.assertEqual(len(self.client.get(f'/api/boards/{first}').json['images']), 1)
        self.assertEqual(self.client.delete(f'/api/boards/{first}').status_code, 204)
        self.assertEqual(self.client.get(f'/api/boards/{first}').status_code, 404)
        self.assertEqual(self.client.get('/api/boards').json[0]['image_count'], 0)


if __name__ == '__main__':
    unittest.main()
