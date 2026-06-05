import http.server
import ssl
import sys
import urllib.error
import urllib.request
from http import HTTPStatus
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REMOTE_API = "https://aiserv.sky.4pple.net"


class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_POST(self):
        if self.path == "/inference":
            self.proxy_inference()
        else:
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def proxy_inference(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length else None
        headers = {
            "Content-Type": self.headers.get("Content-Type", ""),
            "Accept": self.headers.get("Accept", "application/json"),
        }

        request = urllib.request.Request(
            REMOTE_API + self.path,
            data=body,
            headers=headers,
            method="POST",
        )

        context = ssl._create_unverified_context()

        try:
            with urllib.request.urlopen(request, context=context, timeout=60) as response:
                payload = response.read()
                self.send_response(response.getcode())
                content_type = response.getheader("Content-Type")
                if content_type:
                    self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
        except urllib.error.HTTPError as error:
            payload = error.read()
            self.send_response(error.code)
            content_type = error.headers.get("Content-Type")
            if content_type:
                self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as exc:
            payload = str(exc).encode("utf-8")
            self.send_response(HTTPStatus.BAD_GATEWAY)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    def log_message(self, format, *args):
        sys.stderr.write("%s - - [%s] %s\n" % (self.client_address[0], self.log_date_time_string(), format % args))


def run(server_class=http.server.ThreadingHTTPServer, handler_class=ProxyHandler, port=8082):
    server_address = ("", port)
    httpd = server_class(server_address, handler_class)
    print(f"Serving static files and proxy at http://localhost:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    run()
