from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os, sys, webbrowser
ROOT=Path(__file__).resolve().parent
os.chdir(ROOT)
port=int(sys.argv[1]) if len(sys.argv)>1 else 8765
url=f'http://127.0.0.1:{port}/'
print('RTS prototype:', url)
try: webbrowser.open(url)
except Exception: pass
ThreadingHTTPServer(('127.0.0.1',port), SimpleHTTPRequestHandler).serve_forever()
