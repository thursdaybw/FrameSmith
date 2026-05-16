#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

cd "$repo_root"

ansible-playbook \
  -i ansible/inventory.ini \
  ansible/playbooks/framesmith-static-site.yml \
  "$@"
