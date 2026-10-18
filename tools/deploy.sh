#!/bin/sh
# Publish chaewon/ as its own GitHub Pages project site:
# https://chaewon-lee-announcer.github.io/showhost/
#
#   sh tools/deploy.sh
#
# This repo stays the source, with its own Pages off (the BrilliantTiger org site would
# move it to brillianttigercorp.com). The Pages repo only holds a copy of chaewon/ at its
# root plus .nojekyll; a CNAME there, if one is added later, is kept.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
REPO=${DEPLOY_REPO:-git@github.com:Chaewon-Lee-Announcer/showhost.git}
WORK=$(mktemp -d)
trap 'rm -rf "${WORK:?}"' EXIT

if ! git clone -q --depth 1 "$REPO" "$WORK/site" 2>/dev/null; then
  mkdir -p "$WORK/site"
  git -C "$WORK/site" init -q -b main
  git -C "$WORK/site" remote add origin "$REPO"
fi

rsync -a --delete --exclude '.git' --exclude '.nojekyll' --exclude 'CNAME' --exclude '.DS_Store' "$ROOT/chaewon/" "$WORK/site/"
touch "$WORK/site/.nojekyll"

SRC=$(git -C "$ROOT" rev-parse --short HEAD)
git -C "$WORK/site" add -A
if git -C "$WORK/site" diff --cached --quiet; then
  echo "nothing to publish"
  exit 0
fi
git -C "$WORK/site" -c user.name="$(git -C "$ROOT" config user.name)" -c user.email="$(git -C "$ROOT" config user.email)" \
  commit -q -m "Publish from BrilliantTiger/chaewon.lee.showhost@$SRC"
git -C "$WORK/site" push -q origin HEAD:main
echo "published $SRC to $REPO"
