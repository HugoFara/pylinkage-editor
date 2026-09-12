"""Serve the FastAPI app in-process from the Pyodide worker.

There is no HTTP server in the browser: the worker turns each frontend request
into an ASGI scope, awaits the app, and hands the response back. The same
`pylinkage_editor_server` code answers on GitHub Pages and behind uvicorn.
"""

import base64
import json
from urllib.parse import unquote

import anyio.to_thread


async def _run_sync(func, *args, **_kwargs):
    """FastAPI runs ``def`` endpoints in a thread pool; Pyodide has no threads."""
    return func(*args)


anyio.to_thread.run_sync = _run_sync

# Import after the patch so nothing captures the original.
from pylinkage_editor_server.main import app  # noqa: E402


async def handle(method: str, url: str, headers_json: str, body: str) -> str:
    """Run one request through the app; returns JSON ``{status, headers, body}``.

    ``body`` (request and response) is text: every editor route speaks JSON or
    text, and binary exports are returned base64-encoded under ``body_b64``.
    """
    path, _, query = url.partition("?")
    headers = [(k.lower().encode(), v.encode()) for k, v in json.loads(headers_json)]
    headers.append((b"host", b"pyodide"))
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method.upper(),
        "scheme": "http",
        "path": unquote(path),
        "raw_path": path.encode(),
        "query_string": query.encode(),
        "root_path": "",
        "headers": headers,
        "server": ("pyodide", 80),
        "client": ("127.0.0.1", 0),
    }
    payload = body.encode()
    delivered = False

    async def receive():
        nonlocal delivered
        if delivered:
            return {"type": "http.disconnect"}
        delivered = True
        return {"type": "http.request", "body": payload, "more_body": False}

    response: dict = {"status": 500, "headers": []}
    chunks: list[bytes] = []

    async def send(message):
        if message["type"] == "http.response.start":
            response["status"] = message["status"]
            response["headers"] = [[k.decode(), v.decode()] for k, v in message.get("headers", [])]
        elif message["type"] == "http.response.body":
            chunks.append(message.get("body", b""))

    await app(scope, receive, send)
    raw = b"".join(chunks)
    try:
        response["body"] = raw.decode()
    except UnicodeDecodeError:
        response["body_b64"] = base64.b64encode(raw).decode()
    return json.dumps(response)
