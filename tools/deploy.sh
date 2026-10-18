#!/bin/sh
# Publish chaewon/ to the moshim-kr GitHub Pages site: https://moshim-kr.github.io/chaewon/
#
#   sh tools/deploy.sh
#
# This repo stays the source. The Pages repo only holds the built copy, the root
# redirect and .nojekyll. Its CNAME, if one is added later for moshim.kr, is kept.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
REPO=${DEPLOY_REPO:-git@github.com:moshim-kr/moshim-kr.github.io.git}
WORK=$(mktemp -d)
trap 'rm -rf "${WORK:?}"' EXIT

if ! git clone -q --depth 1 "$REPO" "$WORK/site" 2>/dev/null; then
  mkdir -p "$WORK/site"
  git -C "$WORK/site" init -q -b main
  git -C "$WORK/site" remote add origin "$REPO"
fi

mkdir -p "$WORK/site/chaewon"
rsync -a --delete --exclude '.DS_Store' "$ROOT/chaewon/" "$WORK/site/chaewon/"
cp "$ROOT/index.html" "$WORK/site/index.html"
touch "$WORK/site/.nojekyll"

SRC=$(git -C "$ROOT" rev-parse --short HEAD)
git -C "$WORK/site" add -A
if git -C "$WORK/site" diff --cached --quiet; then
  echo "nothing to publish"
  exit 0
fi
git -C "$WORK/site" -c user.name="$(git -C "$ROOT" config user.name)" -c user.email="$(git -C "$ROOT" config user.email)" \
  commit -q -m "Publish chaewon from BrilliantTiger/chaewon.lee.showhost@$SRC"
git -C "$WORK/site" push -q origin HEAD:main
echo "published $SRC to $REPO"
