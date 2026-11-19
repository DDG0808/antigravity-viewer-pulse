#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/uninstall.sh"
STATUS=$?
echo ""
read -r -p "按回车键关闭此窗口..." _
exit $STATUS
