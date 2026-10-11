"""Front door for the Runpod load balancer, on PORT (80 by default).

GET /ping is the load balancer's health check: 204 ("initializing") until the model is loaded into
GPU memory, then 200. The first check starts that load, so a cold worker only takes traffic once a
roll can be answered at full speed. Every other path is passed to Ollama on 127.0.0.1:11434 as is;
replies are buffered, which suits the edge functions' non-streaming /api/chat calls.
"""

import json
import os
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

OLLAMA = "http://127.0.0.1:11434"
MODEL = os.environ.get("MODEL", "llama2-uncensored")
loading = threading.Lock()
last_health = [None]


def log(message):
    print(f"worker.py: {message}", flush=True)


def model_loaded():
    try:
        with urllib.request.urlopen(f"{OLLAMA}/api/ps", timeout=2) as reply:
            names = [m.get("name", "") for m in json.load(reply).get("models", [])]
    except (OSError, ValueError):
        return False
    return any(name.split(":")[0] == MODEL.split(":")[0] for name in names)


def load_model():
    # keep_alive -1: stay in GPU memory for the worker's whole life; Runpod stops idle workers.
    body = json.dumps({"model": MODEL, "keep_alive": -1}).encode()
    request = urllib.request.Request(f"{OLLAMA}/api/generate", body, {"Content-Type": "application/json"})
    started = time.time()
    log(f"loading {MODEL}")
    try:
        urllib.request.urlopen(request, timeout=600).read()
        log(f"loaded {MODEL} in {time.time() - started:.1f} s")
    except urllib.error.HTTPError as error:
        log(f"load failed ({error.code}): {error.read()[:300]!r}")
    except OSError as error:
        log(f"load failed: {error}")  # Ollama not up yet; the next health check tries again.
    finally:
        loading.release()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass  # The load balancer checks every second; ping() and forward() log what matters.

    def do_GET(self):
        if self.path == "/ping":
            self.ping()
        else:
            self.forward()

    def do_POST(self):
        self.forward()

    def do_DELETE(self):
        self.forward()

    def ping(self):
        healthy = model_loaded()
        if healthy != last_health[0]:
            log(f"health check from {self.client_address[0]}: {'200 ready' if healthy else '204 initializing'}")
            last_health[0] = healthy
        if healthy:
            self.reply(200, b'{"status":"ready"}')
            return
        if loading.acquire(blocking=False):
            threading.Thread(target=load_model, daemon=True).start()
        self.reply(204, b"")

    def forward(self):
        started = time.time()
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        headers = {"Content-Type": self.headers.get("Content-Type", "application/json")}
        request = urllib.request.Request(OLLAMA + self.path, body, headers, method=self.command)
        try:
            with urllib.request.urlopen(request, timeout=600) as reply:
                status = reply.status
                self.reply(status, reply.read(), reply.headers.get("Content-Type"))
        except urllib.error.HTTPError as error:
            status = error.code
            self.reply(status, error.read(), error.headers.get("Content-Type"))
        except OSError as error:
            status = 502
            self.reply(status, json.dumps({"error": f"Ollama unreachable: {error}"}).encode())
        log(f"{self.command} {self.path} -> {status} in {time.time() - started:.2f} s")

    def reply(self, status, data, content_type=None):
        self.send_response(status)
        if status != 204:
            self.send_header("Content-Type", content_type or "application/json")
            self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if status != 204:
            self.wfile.write(data)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "80"))
    log(f"listening on 0.0.0.0:{port}, model {MODEL}")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
