#!/usr/bin/env bash
set -euo pipefail

deploy_host="${FRAMESMITH_DEPLOY_HOST:-bevansbench.com}"
deploy_user="${FRAMESMITH_DEPLOY_USER:-bevan}"
deploy_web_root="${FRAMESMITH_DEPLOY_WEB_ROOT:-/home/bevan/workspace/framesmith}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

cd "$repo_root"

rsync -az --delete \
  --exclude ".git/" \
  --exclude "old/" \
  --exclude "node_modules/" \
  --exclude ".DS_Store" \
  --exclude "*.mp4" \
  ./ \
  "${deploy_user}@${deploy_host}:${deploy_web_root}/"

ssh "${deploy_user}@${deploy_host}" "bash -s" <<EOF_REMOTE
set -euo pipefail

cd "$deploy_web_root"

test -f index.html
test -f script.js

printf 'deployed FrameSmith static files to %s\n' "$deploy_web_root"
EOF_REMOTE
