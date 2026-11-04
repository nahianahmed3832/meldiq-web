"""Validate saved Part 1 documentation. No network or application operations."""

import argparse
from collections import Counter
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

from PIL import Image


ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source-root", type=Path, default=ROOT.parents[1], help="Owning checkout containing the original historical research; saved evidence is always checked here.")
SOURCE_ROOT = parser.parse_args().source_root.resolve()
COLUMNS = [
    "Feature ID", "Category", "Feature name", "Yapin behavior", "Reference URL",
    "Screenshot reference", "Verification status", "Meldiq existing status",
    "Gap description", "Assigned implementation part", "Priority",
    "Acceptance criteria", "Dependencies", "Implementation status",
    "Testing status", "Owner", "Notes",
]
FAMILIES = {
    "PART 2": "WEB AUTH PROFILE LOOK PREF SHELL TRUST".split(),
    "PART 3": "SOCIAL MSG SEARCH COMM CHANNEL ROLE MOD NOTIFY EVENT LOBBY GATE PERM".split(),
    "PART 4": "VOICE MEDIA EXPR BOT BOTOPT DEV BILL RELEASE OPS API BOTEVENT GATEWAY".split(),
}
YAPIN_STATES = {
    "VERIFIED_INTERACTION_CURRENT", "VERIFIED_WORKFLOW_HISTORICAL",
    "OBSERVED_UI_CURRENT", "OBSERVED_UI_HISTORICAL", "UNVERIFIED_DOCS",
    "UNVERIFIED_RESTRICTED", "UNVERIFIED_NOT_FOUND",
}
MELDIQ_STATES = {
    "PRESENT_SOURCE", "OBSERVED_LIVE_UI", "PARTIAL", "MISSING_IN_INSPECTED_WEB",
    "INTENTIONAL_DIFFERENCE", "UNVERIFIED",
}
IMPLEMENTATION_STATES = {
    "RESEARCH_REQUIRED", "NOT_STARTED_IN_THIS_PROGRAM", "IN_PROGRESS",
    "IMPLEMENTED_NOT_ACCEPTED", "ACCEPTED", "DEFERRED_DECISION", "RETIRED_WITH_REASON",
}
REQUIRED = [
    "README.md", "SCREEN_INVENTORY.md", "CURRENT_ARCHITECTURE.md",
    "FEATURE_REGISTER.csv", "USER_JOURNEYS.md", "IMPLEMENTATION_ROADMAP.md",
    "DESIGN_DECISIONS.md", "PROJECT_CONTROL.md", "EXECUTION_PROGRESS.md",
    "ROUTE_INVENTORY.md", "EVIDENCE_INDEX.md", "QA_REPORT.md",
    "handoffs/PART_1_REPORT.md",
]
errors = []
checks = Counter()


def check(condition, label, group):
    checks[group] += 1
    if not condition:
        errors.append(label)


def read_json(relative):
    return json.loads((ROOT / relative).read_text())


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


for relative in REQUIRED:
    check((ROOT / relative).is_file(), f"Missing deliverable: {relative}", "deliverables")

with (ROOT / "FEATURE_REGISTER.csv").open(newline="") as stream:
    reader = csv.DictReader(stream)
    check(reader.fieldnames == COLUMNS, "CSV headers differ from requested 17 columns", "register")
    rows = list(reader)

ids = [row["Feature ID"] for row in rows]
id_set = set(ids)
check(len(ids) == len(id_set), "Duplicate feature IDs", "register")
records = read_json("evidence/register-records.json")
check(rows == records, "CSV differs from reconciliation records", "register")
control = (ROOT / "PROJECT_CONTROL.md").read_text()
contracts = set()
for line in control.splitlines():
    if re.match(r"\| C-[A-Z]+", line):
        contracts.update(re.findall(r"C-[A-Z]+", line.split("|")[1]))

route_manifest = read_json("evidence/public-routes.json")
public_paths = {"/", *(item["path"] for item in route_manifest)}
evidence_references = set()
for row in rows:
    fid = row["Feature ID"]
    check(set(row) == set(COLUMNS), f"Unexpected field count: {fid}", "register")
    check(all(isinstance(row.get(col), str) and row[col].strip() for col in COLUMNS),
          f"Blank field: {fid}", "register")
    match = re.fullmatch(r"YAP-([A-Z]+)-(\d{3})", fid)
    check(bool(match), f"Invalid stable ID: {fid}", "register")
    expected_owner = next((owner for owner, families in FAMILIES.items()
                           if match and match[1] in families), None)
    check(row["Owner"] == row["Assigned implementation part"] == expected_owner,
          f"Owner/part/family mismatch: {fid}", "ownership")
    check(row["Verification status"] in YAPIN_STATES, f"Invalid Yapin status: {fid}", "register")
    if row["Verification status"] == "VERIFIED_INTERACTION_CURRENT":
        check("Current executed scope:" in row["Notes"],
              f"Current interaction lacks bounded executed scope: {fid}", "verification_scope")
    check(row["Meldiq existing status"] in MELDIQ_STATES, f"Invalid Meldiq status: {fid}", "register")
    check(row["Implementation status"] in IMPLEMENTATION_STATES,
          f"Invalid implementation status: {fid}", "register")
    check(row["Priority"] in {"P0", "P1", "P2", "P3"}, f"Invalid priority: {fid}", "register")
    check(set(re.findall(r"C-[A-Z]+", row["Dependencies"])) <= contracts,
          f"Undeclared dependency contract: {fid}", "contracts")
    ref = urlsplit(row["Reference URL"])
    check(ref.scheme == "https" and ref.hostname in {"yapin.gg", "www.yapin.gg"}
          and ref.path in public_paths, f"Uninventoried reference URL: {fid}", "references")
    shot = row["Screenshot reference"]
    check(shot.startswith("NONE — ") or (ROOT / shot).is_file(),
          f"Missing screenshot: {fid}", "references")
    evidence_references.update(re.findall(r"evidence/[A-Za-z0-9_./-]+\.(?:txt|json)", row["Notes"]))

for relative in sorted(evidence_references):
    check((ROOT / relative).is_file(), f"Missing row evidence: {relative}", "references")

counts = read_json("evidence/register-counts.json")
check(counts["total"] == len(rows), "Feature total mismatch", "counts")
for key, field in [
    ("byPart", "Owner"), ("byYapinVerification", "Verification status"),
    ("byMeldiqStatus", "Meldiq existing status"), ("byPriority", "Priority"),
]:
    check(counts[key] == dict(Counter(row[field] for row in rows)), f"Count mismatch: {key}", "counts")
if "byImplementation" in counts:
    check(counts["byImplementation"] == dict(Counter(row["Implementation status"] for row in rows)),
          "Implementation state count mismatch", "counts")
if "part2Implementation" in counts:
    check(counts["part2Implementation"] == dict(Counter(row["Implementation status"] for row in rows if row["Owner"] == "PART 2")),
          "Part 2 state count mismatch", "counts")
if (ROOT / "part2/feature-dispositions.json").exists():
    dispositions = read_json("part2/feature-dispositions.json")
    owned = {row["Feature ID"]: row for row in rows if row["Owner"] == "PART 2"}
    check(len(dispositions) == len(owned) == len({item["id"] for item in dispositions}),
          "Part 2 dispositions do not cover each owned row exactly once", "part2")
    for item in dispositions:
        check(item["id"] in owned and item["state"] == owned[item["id"]]["Implementation status"],
              f"Part 2 disposition mismatch: {item['id']}", "part2")

api = read_json("evidence/documented-api-operations.json")
schema = read_json("evidence/yapin-openapi-audit.json")
api_set = {(item["method"], item["path"]) for item in api}
schema_set = {(item["method"], item["path"]) for item in schema["operations"]}
check(len(api) == len(api_set) == counts["apiOperations"], "Duplicate/mismatched API operations", "schema")
check(api_set == schema_set and counts["openApiReconciled"], "Browser/API-schema operation mismatch", "schema")
check(sum(bool(item["testing"]) for item in api) == counts["explicitTestingApiOperations"],
      "Testing-operation count mismatch", "schema")
for family, key, values in [
    ("API", "apiOperations", api),
    ("BOTEVENT", "documentedBotEvents", schema["eventTypes"]),
    ("GATEWAY", "documentedGatewayFrames", schema["gatewayFrameNames"]),
]:
    check(sum(fid.startswith(f"YAP-{family}-") for fid in ids) == len(values) == counts[key],
          f"Register/schema count mismatch: {family}", "schema")

inventory = read_json("evidence/screen-metadata.json")
inventory_counts = read_json("evidence/inventory-counts.json")
screens = [item for item in inventory if item["dimensions"]]
images = {file.relative_to(ROOT).as_posix() for file in (ROOT / "screenshots").rglob("*")
          if file.suffix.lower() in {".png", ".jpg", ".jpeg"}}
check(images == {item["screenshot"] for item in screens}, "Image/metadata file-set mismatch", "images")
for item in screens:
    file = ROOT / item["screenshot"]
    check(file.is_file() and digest(file) == item["sha256"],
          f"Screenshot hash mismatch: {item['screenshot']}", "images")
    try:
        with Image.open(file) as image:
            size, fmt = image.size, image.format
            image.verify()
        check(list(size) == item["dimensions"] and fmt == item["format"],
              f"Image dimensions/format mismatch: {item['screenshot']}", "images")
    except Exception:
        check(False, f"Image cannot decode: {item['screenshot']}", "images")
    expected_refs = [row["Feature ID"] for row in rows if row["Screenshot reference"] == item["screenshot"]]
    check(item["features"] == expected_refs, f"Screen/feature mapping mismatch: {item['screenshot']}", "references")

computed_inventory = {
    "canonicalYapinPathsInspected": len(public_paths),
    "currentYapinScreenshots": sum(item["date"] == "2026-11-04" and "/meldiq/" not in item["screenshot"] for item in screens),
    "historicalYapinScreenshots": sum(item["date"] == "2026-11-01" for item in screens),
    "meldiqScreenshots": sum("/meldiq/" in item["screenshot"] for item in screens),
    "textOnlyScreens": len(inventory) - len(screens),
    "documentedScreenStates": len(inventory),
    "screenshotsTotal": len(images),
}
for key, expected in computed_inventory.items():
    check(inventory_counts[key] == expected, f"Inventory count mismatch: {key}", "counts")
check(len(public_paths) == len(route_manifest) + 1, "Duplicate canonical public paths", "routes")
for item in route_manifest:
    check(urlsplit(item["url"]).path == item["path"], f"Route path mismatch: {item['path']}", "routes")
    check((ROOT / "evidence" / item["evidence"]).is_file(), f"Missing route text: {item['path']}", "routes")
    check((ROOT / "screenshots/current" / item["screenshot"]).is_file(),
          f"Missing route capture: {item['path']}", "routes")

imports = read_json("evidence/historical-import-manifest.json")
for item in imports:
    saved, original = ROOT / item["saved"], SOURCE_ROOT / item["source"]
    check(saved.is_file() and digest(saved) == item["sha256"],
          f"Imported evidence changed: {item['saved']}", "provenance")
    expected = item.get("originalSha256", item["sha256"])
    check(original.is_file() and digest(original) == expected,
          f"Historical source changed: {item['source']}", "provenance")
check(sum("text" in item["kind"] for item in imports) == inventory_counts["historicalTextsImported"],
      "Historical-text count mismatch", "counts")

markdown_link_count = 0
for file in ROOT.rglob("*.md"):
    body = file.read_text()
    for match in re.finditer(r"!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+\"[^\"]*\")?\)", body):
        target = match[1].strip("<>")
        parsed = urlsplit(target)
        if parsed.scheme or target.startswith("#"):
            continue
        dest = Path(unquote(parsed.path))
        if not dest.is_absolute():
            dest = file.parent / dest
        check(dest.exists(), f"Broken local Markdown link in {file.relative_to(ROOT)}: {target}", "links")
        markdown_link_count += 1
    for fid in set(re.findall(r"\bYAP-[A-Z]+-\d{3}\b", body)):
        check(fid in id_set, f"Unknown feature reference in {file.relative_to(ROOT)}: {fid}", "references")

first = read_json("evidence/meldiq-runtime-20261104.json")
last = read_json("evidence/meldiq-runtime-final-20261104.json")
for key in ["containers", "symlinks", "webConfig"]:
    check(first.get(key) == last.get(key), f"Runtime baseline changed between observations: {key}", "runtime")

secret_patterns = {
    "private-key block": r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "credential-bearing database URL": r"(?:postgres(?:ql)?|mongodb(?:\+srv)?):\/\/[^\s\"/]+:[^\s\"@]+@",
    "AWS access-key format": r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b",
    "live secret-key format": r"\bsk_live_[A-Za-z0-9]{20,}\b",
    "JWT format": r"\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b",
    "GitHub token format": r"\bgh[pousr]_[A-Za-z0-9]{30,}\b",
}
for file in ROOT.rglob("*"):
    if not file.is_file() or file.suffix not in {".md", ".csv", ".json", ".txt"}:
        continue
    body = file.read_text(errors="replace")
    for label, pattern in secret_patterns.items():
        check(not re.search(pattern, body), f"Review {label} in {file.relative_to(ROOT)}", "bounded_secret_scan")

result = {
    "checkedAt": datetime.now(timezone.utc).isoformat(),
    "status": "PASS" if not errors else "FAIL",
    "scope": "saved documentation only; no network/application/database operations",
    "historicalSourceRoot": str(SOURCE_ROOT),
    "checksByGroup": dict(checks), "checkCount": sum(checks.values()),
    "featureRows": len(rows), "owners": counts["byPart"],
    "localMarkdownLinksChecked": markdown_link_count,
    "rowEvidenceFilesChecked": len(evidence_references),
    "inventory": computed_inventory,
    "apiOperations": len(api_set), "historicalImportsChecked": len(imports),
    "runtimeIdentityUnchanged": all(first.get(key) == last.get(key) for key in ["containers", "symlinks", "webConfig"]),
    "errors": errors,
}
(ROOT / "evidence/qa-results.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
raise SystemExit(1 if errors else 0)
