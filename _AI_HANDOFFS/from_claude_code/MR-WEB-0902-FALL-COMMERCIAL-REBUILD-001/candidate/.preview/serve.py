import http.server, socketserver, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..'))
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
socketserver.TCPServer.allow_reuse_address=True
with socketserver.TCPServer(("127.0.0.1",8790),H) as httpd:
    httpd.serve_forever()
