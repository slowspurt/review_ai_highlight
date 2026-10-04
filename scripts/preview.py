#!/usr/bin/env python3
"""Serve an unchanged static source with temporary, browser-side review outlines."""
import argparse
import json
import mimetypes
from pathlib import Path
import secrets
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import quote, unquote, urlsplit

ASSET = Path(__file__).resolve().parent.parent / "assets" / "overlay.js"


def load_findings(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or set(data) - {"language", "findings"}:
        raise ValueError("Expected language and findings only")
    if data.get("language", "en") not in ("en", "ko"):
        raise ValueError("language must be en or ko")
    findings = data.get("findings")
    if not isinstance(findings, list) or len(findings) > 100:
        raise ValueError("findings must be an array with at most 100 entries")
    ids = set()
    for item in findings:
        if not isinstance(item, dict) or set(item) - {"id", "selector", "quote", "reason", "kind", "replacement"}:
            raise ValueError("Unknown finding fields")
        number = item.get("id")
        if type(number) is not int or number < 1 or number > 9999 or number in ids:
            raise ValueError("Finding IDs must be unique integers from 1 to 9999")
        ids.add(number)
        for key in ("selector", "quote", "reason"):
            if not isinstance(item.get(key), str) or not item[key].strip():
                raise ValueError(f"Finding {number}: {key} must be a nonempty string")
        if item.get("kind", "passage") not in ("passage", "group"):
            raise ValueError("kind must be passage or group")
        if "replacement" in item and not isinstance(item["replacement"], str):
            raise ValueError("replacement must be plain text (an empty string previews deletion)")
    return data


def resolve_source(value, root_value=None):
    parsed = urlsplit(value)
    root = Path(root_value).expanduser().resolve() if root_value else None
    if parsed.scheme in {"http", "https"}:
        if parsed.scheme != "http" or parsed.hostname not in {"localhost", "127.0.0.1", "::1"} or not root:
            raise ValueError("Page URLs require http://loopback and --root pointing to the static document root")
        if parsed.username or parsed.password or parsed.query:
            raise ValueError("Credentials and query-based pages are not supported")
        source = root / unquote(parsed.path).lstrip("/")
    elif parsed.scheme == "file":
        if parsed.netloc not in {"", "localhost"} or parsed.query:
            raise ValueError("Use a local file URL without a query")
        source = Path(unquote(parsed.path)).expanduser()
    elif parsed.scheme:
        raise ValueError("Use a local HTML path, file URL, or mapped loopback HTTP URL")
    else:
        source = Path(value).expanduser()
    source = source.resolve()
    root = root or source.parent
    if not root.is_dir() or not source.is_relative_to(root):
        raise ValueError("Source must be inside --root")
    if not source.is_file() or source.suffix.lower() not in {".html", ".htm"}:
        raise ValueError("Source must be an existing .html or .htm file (no app routes)")
    if any(part.startswith(".") for part in source.relative_to(root).parts):
        raise ValueError("Hidden paths are not served")
    source.read_text(encoding="utf-8")
    return source, root


def make_server(source, root, findings_path, port):
    token = secrets.token_hex(16)
    prefix = f"/__review_{token}/"
    source_url = "/" + quote(source.relative_to(root).as_posix(), safe="/")

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # Avoid logging document paths and text.

        def do_HEAD(self):
            self.respond(head=True)

        def do_GET(self):
            self.respond()

        def respond(self, head=False):
            allowed = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
            if self.headers.get("Host") not in allowed:
                self.send_error(403, "Loopback Host required")
                return
            route = urlsplit(self.path)
            path = unquote(route.path)
            content_type = "application/octet-stream"
            try:
                if path == prefix + "overlay.js":
                    content = ASSET.read_bytes()
                    content_type = "text/javascript; charset=utf-8"
                elif path == prefix + "findings.json":
                    try:
                        data = load_findings(findings_path)
                    except (OSError, ValueError):
                        data = {"error": "Invalid findings file. Fix it and refresh."}
                    content = json.dumps(data, ensure_ascii=False).encode("utf-8")
                    content_type = "application/json; charset=utf-8"
                else:
                    parts = Path(path.lstrip("/")).parts
                    target = (root / path.lstrip("/")).resolve()
                    if (any(p.startswith(".") for p in parts)
                            or not target.is_relative_to(root) or not target.is_file()
                            or any(p.startswith(".") for p in target.relative_to(root).parts)
                            or target == findings_path or target == ASSET):
                        self.send_error(404)
                        return
                    content = target.read_bytes()
                    content_type = mimetypes.guess_type(target.name)[0] or content_type
                    if target == source and route.query != "review=off":
                        # Append without replacing text inside source scripts or comments.
                        content.decode("utf-8")
                        content += (f'<script src="{prefix}overlay.js" '
                                    f'data-findings="{prefix}findings.json" defer></script>').encode()
                    if target.suffix.lower() in {".html", ".htm"}:
                        content_type = "text/html; charset=utf-8"
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(content)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()
                if not head:
                    self.wfile.write(content)
            except (OSError, UnicodeError, ValueError):
                self.send_error(422, "Cannot read static source")

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.preview_url = f"http://127.0.0.1:{server.server_port}{source_url}"
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", help="UTF-8 HTML path, file URL, or loopback HTTP URL mapped through --root")
    parser.add_argument("--findings", required=True, type=Path, help="Private JSON annotation file")
    parser.add_argument("--root", help="Static asset root; defaults to the source parent")
    parser.add_argument("--port", type=int, default=8793, help="Loopback port; 0 chooses a free port (default: 8793)")
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error("--port must be between 0 and 65535")
    try:
        source, root = resolve_source(args.source, args.root)
        findings = args.findings.expanduser().resolve()
        load_findings(findings)
        server = make_server(source, root, findings, args.port)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    print(f"Review preview: {server.preview_url}", flush=True)
    print("Refresh after saving source or findings. Remove opens the unannotated source. Ctrl+C stops this server.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
