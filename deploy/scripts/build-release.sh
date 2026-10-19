#!/usr/bin/env bash
# Builds a release of Orbit Web: the static app plus its install scripts, as one tarball with a SHA-256 file.
# Run from the repository root. Nothing is uploaded or installed.
#   bash deploy/scripts/build-release.sh            → release/orbit-web-<version>-<commit>.tar.gz
set -euo pipefail
cd "$(dirname "$0")/../.."
if [ -n "$(git status --porcelain)" ]; then
  echo "The working tree has uncommitted changes: commit them so the release matches a commit." >&2
  exit 1
fi
version="$(node -p "require('./package.json').version")"
commit="$(git rev-parse --short HEAD)"
name="orbit-web-${version}-${commit}"
npm ci --no-audit --no-fund
npm run typecheck
npm run lint
npm test
npm run build
# The build never contains a config.json: each server writes its own at install time.
rm -f dist/config.json
out="release/${name}"
rm -rf "$out" && mkdir -p "$out"
cp -R dist "$out/dist"
cp -R deploy/nginx deploy/config "$out/"
cp deploy/scripts/install-release.sh deploy/scripts/rollback.sh deploy/scripts/verify.sh "$out/"
printf '%s\n' "$version" "$commit" > "$out/RELEASE"
tar -C release -czf "release/${name}.tar.gz" "$name"
(cd release && shasum -a 256 "${name}.tar.gz" > "${name}.tar.gz.sha256")
rm -rf "$out"
echo "release/${name}.tar.gz"
