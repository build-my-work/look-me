#!/usr/bin/env bash
# Look Me 价值卡导出：电脑端横图 1600×900 逻辑分辨率（2x 渲染 3200×1800）
# 用法：bash promo/value-card/export.sh [输出路径.png]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$SCRIPT_DIR/../../lookme-value-card.png}"
OUT="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ ! -x "$CHROME" ]; then
  CHROME="$(command -v google-chrome || command -v chromium || true)"
fi
[ -n "${CHROME:-}" ] || { echo "未找到 Chrome，请修改脚本中的 CHROME 路径"; exit 1; }
"$CHROME" --headless --disable-gpu --force-device-scale-factor=2 \
  --window-size=1600,900 --screenshot="$OUT" --hide-scrollbars \
  "file://$SCRIPT_DIR/index.html?t=0" >/dev/null 2>&1
echo "已导出：$OUT"
