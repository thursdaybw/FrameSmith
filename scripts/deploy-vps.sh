#!/usr/bin/env bash
set -euo pipefail

deploy_host="${FRAMESMITH_DEPLOY_HOST:-bevansbench.com}"
deploy_user="${FRAMESMITH_DEPLOY_USER:-bevan}"
deploy_repo_dir="${FRAMESMITH_DEPLOY_REPO_DIR:-/home/bevan/workspace/framesmith}"
deploy_branch="${FRAMESMITH_DEPLOY_BRANCH:-main}"
deploy_repo_url="${FRAMESMITH_DEPLOY_REPO_URL:-git@github.com:thursdaybw/FrameSmith.git}"

ssh "${deploy_user}@${deploy_host}" "bash -s" <<EOF_REMOTE
set -euo pipefail

if [ ! -d "$deploy_repo_dir/.git" ]; then
    mkdir -p "$(dirname "$deploy_repo_dir")"
    git clone --branch "$deploy_branch" "$deploy_repo_url" "$deploy_repo_dir"
fi

cd "$deploy_repo_dir"

git fetch origin "$deploy_branch"
git switch "$deploy_branch"
git pull --ff-only origin "$deploy_branch"

test -f index.html
test -f script.js

git --no-pager log -1 --oneline --decorate
EOF_REMOTE
