#!/usr/bin/env python3
"""3528B prototype dev server — serves this folder with caching disabled
so edits and fresh builds always load. Usage:  python3 serve.py [port]"""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4174
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoStoreHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()


if __name__ == '__main__':
    print(f'3528B prototype → http://localhost:{PORT}/index.html')
    HTTPServer(('127.0.0.1', PORT), NoStoreHandler).serve_forever()
