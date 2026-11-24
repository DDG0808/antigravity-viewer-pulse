#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$PATH"
if [ -d "$HOME/.nvm/versions/node" ]; then
  LATEST_NVM_NODE="$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | sort -t. -k1.2,1n -k2,2n -k3,3n | tail -n 1 || true)"
  if [ -n "$LATEST_NVM_NODE" ]; then
    export PATH="$HOME/.nvm/versions/node/$LATEST_NVM_NODE/bin:$PATH"
  fi
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================================="
echo "  Antigravity Pulse · 一键彻底卸载与官方原版无损还原"
echo "=========================================================="

if ! command -v node >/dev/null 2>&1; then
  echo "❌ 未检测到 Node.js (>=18)，请先通过 Homebrew (brew install node) 或官网安装 Node.js 后再执行卸载。"
  exit 1
fi

node cli.js teardown "$@"
