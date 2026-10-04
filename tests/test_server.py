import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

spec = importlib.util.spec_from_file_location("preview", Path(__file__).resolve().parents[1] / "scripts/preview.py")
preview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)


class PreviewTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name).resolve()
        self.root = self.base / "site"
        self.root.mkdir()
        self.source = self.root / "draft page.html"
        self.original = b'<!doctype html><p id="draft">An unclear sentence.</p>'
        self.source.write_bytes(self.original)
        self.manifest = self.base / "findings.json"
        self.data = {"language":"en", "findings":[{"id":1,"selector":"#draft","quote":"An unclear sentence.","reason":"Unclear subject"}]}
        self.manifest.write_text(json.dumps(self.data))
        self.server = preview.make_server(self.source, self.root, self.manifest, 0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = self.server.preview_url
        self.origin = self.url.rsplit("/", 1)[0]

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, path):
        return urlopen(self.origin + path)

    def assert_http(self, path, code):
        with self.assertRaises(HTTPError) as caught:
            self.request(path)
        self.assertEqual(caught.exception.code, code)
        caught.exception.close()

    def test_response_only_refresh_and_remove(self):
        with urlopen(self.url) as response:
            content = response.read()
            self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertTrue(content.startswith(self.original))
        self.assertIn(b"data-findings=", content)
        self.assertEqual(self.source.read_bytes(), self.original)
        updated = self.original.replace(b"unclear", b"revised")
        self.source.write_bytes(updated)
        self.assertTrue(urlopen(self.url).read().startswith(updated))
        self.assertEqual(urlopen(self.url+"?review=off").read(), updated)
        self.assertEqual(urlopen(Request(self.url, method="HEAD")).read(), b"")

    def test_assets_links_and_no_listing(self):
        css = b"p { color: teal; }"
        (self.root / "style.css").write_bytes(css)
        (self.root / "next.html").write_text("<p>Another page</p>")
        self.assertEqual(self.request("/style.css").read(), css)
        self.assertEqual(self.request("/next.html").read(), b"<p>Another page</p>")
        self.assert_http("/", 404)

    def test_private_paths_and_host(self):
        (self.root / ".env").write_text("fictional-secret")
        (self.root / "alias").symlink_to(self.root / ".env")
        (self.root / "outside").symlink_to(self.manifest)
        for path in ["/.env", "/alias", "/outside", "/%2e%2e/findings.json", "/../findings.json"]:
            self.assert_http(path, 404)
        with self.assertRaises(HTTPError) as caught:
            urlopen(Request(self.url, headers={"Host":"external.invalid"}))
        self.assertEqual(caught.exception.code, 403)
        caught.exception.close()

    def test_manifest_reload_and_errors(self):
        import re
        body = urlopen(self.url).read().decode()
        endpoint = re.search(r'data-findings="([^"]+)"', body)[1]
        self.assertEqual(json.load(self.request(endpoint)), self.data)
        self.data["findings"][0]["quote"] = "A revision"
        self.manifest.write_text(json.dumps(self.data))
        self.assertEqual(json.load(self.request(endpoint)), self.data)
        self.manifest.write_text("{")
        self.assertIn("error", json.load(self.request(endpoint)))
        self.data["findings"].append(dict(self.data["findings"][0]))
        self.manifest.write_text(json.dumps(self.data))
        with self.assertRaises(ValueError):
            preview.load_findings(self.manifest)
        self.data["findings"].pop()
        for key in ("language", "kind"):
            owner = self.data if key == "language" else self.data["findings"][0]
            owner[key] = []
            self.manifest.write_text(json.dumps(self.data))
            self.assertIn("error", json.load(self.request(endpoint)))
            owner.pop(key)

    def test_input_mapping(self):
        for value, root in [(str(self.source), None), (self.source.as_uri(), None),
                            ("http://localhost:9999/draft%20page.html#draft", str(self.root))]:
            self.assertEqual(preview.resolve_source(value, root), (self.source, self.root))
        for value, root in [("https://example.com/page.html", str(self.root)),
                            ("http://localhost:9999/draft%20page.html", None),
                            ("http://localhost:9999/draft%20page.html?mode=1", str(self.root)),
                            (str(self.manifest), str(self.root)),
                            ("http://localhost:9999/dashboard", str(self.root))]:
            with self.assertRaises(ValueError):
                preview.resolve_source(value, root)


if __name__ == "__main__":
    unittest.main()
