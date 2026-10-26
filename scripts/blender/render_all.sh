#!/usr/bin/env bash
# Render all six plates (Cycles CPU). Usage: BLENDER=/path/to/blender scripts/blender/render_all.sh [samples] [width] [height] [quality]
set -e
BL="${BLENDER:-blender}"; S="${1:-48}"; W="${2:-3072}"; H="${3:-1536}"; Q="${4:-82}"
cd "$(dirname "$0")/../.."
for r in attic kitchen mortuary hallway basement frontdoor; do
  "$BL" -b -P "scripts/blender/room_$r.py" -- --out "${OUT:-assets/rooms}/$r.jpg" --samples "$S" --w "$W" --h "$H" --quality "$Q" | grep -E "RENDERED|Error" || true
done
