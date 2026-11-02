"""Prepare a CSS-only overlay on the verified newer production artifact."""
import hashlib
import json
import re
import sys
import tarfile
from pathlib import Path

root = Path(sys.argv[1]).resolve()
archive = root / "production-baseline.tar.gz"
assert hashlib.sha256(archive.read_bytes()).hexdigest() == "d23890fd216757328a731f63474c342101ceb32456f4fed82a1d3573184632c5"
baseline = root / "baseline"
baseline.mkdir()
with tarfile.open(archive) as bundle:
    bundle.extractall(baseline, filter="data")
baseline = baseline / "dist"
html = (baseline / "index.html").read_text()
old_build = re.search(r'"buildId":"([^"]+)"', html)[1]
old_css = re.search(r'href="(/_next/static/css/[^" ]+\.css)"', html)[1]
css = (baseline / old_css.lstrip("/")).read_text()
replacements = [
    (".workspace{display:grid;grid-template-rows:var(--topbar-h) minmax(0,1fr);min-width:0}",
     ".workspace{display:flex;flex-direction:column;min-height:0;min-width:0}"),
    (".topbar{display:flex;align-items:center;gap:12px;padding:0 2px 10px 10px}",
     ".topbar{height:var(--topbar-h);flex-shrink:0;display:flex;align-items:center;gap:12px;padding:0 2px 10px 10px}"),
    (".body{display:flex;gap:var(--frame-gap);", ".body{display:flex;flex:1 1 0;gap:var(--frame-gap);"),
    (".app.phone-bare .workspace{grid-template-rows:minmax(0,1fr)}", ""),
    (".workspace{grid-template-rows:minmax(0,1fr)}", ""),
    (".workspace{grid-template-rows:56px minmax(0,1fr)}", ".topbar{height:56px}"),
]
for before, after in replacements:
    assert css.count(before) == 1, before
    css = css.replace(before, after)
new_css = "/_next/static/css/" + hashlib.sha256(css.encode()).hexdigest()[:20] + ".css"
new_build = "service-inbox-layout-90ef729"
overlay = root / "overlay"

def write(relative, data):
    path = overlay / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)

write(new_css.lstrip("/"), css.encode())
for filename in ["index.html", "404.html"]:
    text = (baseline / filename).read_text()
    assert old_build in text and old_css in text
    text = text.replace(old_build, new_build).replace(old_css, new_css)
    write(filename, text.encode())
for path in (baseline / "_next/static" / old_build).iterdir():
    data = path.read_text().replace(old_css.lstrip("/"), new_css.lstrip("/"))
    write("_next/static/" + new_build + "/" + path.name, data.encode())
files = {str(path.relative_to(overlay)): hashlib.sha256(path.read_bytes()).hexdigest()
         for path in sorted(overlay.rglob("*")) if path.is_file()}
with tarfile.open(root / "overlay.tar.gz", "w:gz") as bundle:
    for relative in files:
        bundle.add(overlay / relative, arcname=relative)
manifest = {
    "sourceFixCommit": "90ef729",
    "method": "CSS-only overlay preserving the exact current production JavaScript",
    "expectedWeb": "/opt/meldiq-web/releases/0.5.0-beta-platform-sync-a5da62bd3b08",
    "newWeb": "/opt/meldiq-web/releases/0.5.0-beta-service-inbox-layout-90ef729",
    "expectedApiImage": "griip-internal-messaging-api:0.76.0-platform-sync-56b1522778d5",
    "baselineBuildId": old_build,
    "buildId": new_build,
    "css": new_css,
    "baselineFiles": {name: hashlib.sha256((baseline / name).read_bytes()).hexdigest()
                      for name in ["index.html", "404.html", old_css.lstrip("/")]},
    "files": files,
    "archiveSha256": hashlib.sha256((root / "overlay.tar.gz").read_bytes()).hexdigest(),
}
(root / "RELEASE.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps({"buildId": new_build, "css": new_css, "files": len(files)}))
