#!/usr/bin/env python3
"""
MissionMed preview server — MR-WEB-0902.

ROUTING RULE (founder ruling MR-WEB-0902D):
  "/" MUST open the customer-facing Mission Residency candidate, never
  documentation. The internal QA hub lives at "/review/" and is explicitly
  NOT a production page — it is excluded from the Codex deployment payload.
"""
import http.server, socketserver, os

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

# Default the founder's entry point to State A so the first thing seen is the
# customer experience during Fall Access Week — what a prospect would actually
# see. The toolbar labels it "simulated", and /pages/...?state=P shows the true
# pre-launch state. The production truth gate in campaign-state.js is untouched:
# with verified_live_at null, real production still cannot show Fall Access.
CUSTOMER_HOME = '/pages/mission-residency.html?state=A'

# Short, memorable URLs for the founder. Every one lands on a customer surface
# except /review/, which is last on purpose.
ALIASES = {
    '/':            CUSTOMER_HOME,
    '/mr':          CUSTOMER_HOME,
    '/home':        '/pages/home-corporate.html?state=A',
    '/complete':    '/pages/program-complete.html?state=A',
    '/essentials':  '/pages/program-essentials.html?state=A',
    '/360':         '/pages/program-360.html?state=A',
    '/ps':          '/pages/program-ps.html?state=A',
    '/compare':     '/pages/compare.html?state=A',
    '/payment':     '/pages/payment.html?state=A',
    '/truth':       '/pages/mission-residency.html?state=P',
    '/faq':         '/pages/mission-residency.html#faq',
    '/sept8':       '/pages/mission-residency.html?state=B',
    '/review':      '/review/index.html',
}

class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0].rstrip('/') or '/'
        if path in ALIASES:
            target = ALIASES[path]
            # preserve any query string the founder typed (e.g. ?state=B)
            if '?' in self.path and '?' not in target and '#' not in target:
                target += '?' + self.path.split('?', 1)[1]
            self.send_response(302)
            self.send_header('Location', target)
            self.end_headers()
            return
        return super().do_GET()

    def end_headers(self):
        # never cache during review — the founder should always see the latest build
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def log_message(self, *a):
        pass

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", 8790), H) as httpd:
    print("Customer preview:  http://127.0.0.1:8790/")
    print("Internal QA hub:   http://127.0.0.1:8790/review/")
    httpd.serve_forever()
