#!/bin/bash
set -euo pipefail

echo "=== Generating 1-second H.264 visual test clip ==="

ffmpeg -y \
  -f lavfi -i testsrc=s=128x128:d=1 \
  -c:v libx264 -pix_fmt yuv420p \
  reference_visual.mp4

echo "Wrote reference_visual.mp4"
echo

echo "=== Extracting ffprobe trace ==="

# capture BOTH stdout and stderr
ffprobe -v trace reference_visual.mp4 2>&1 | \
  tee reference_visual.trace.txt >/dev/null

echo "Wrote reference_visual.trace.txt"
echo

echo "=== Extracting hex dump ==="

xxd -g 1 -c 16 reference_visual.mp4 > reference_visual.hex.txt

echo "Wrote reference_visual.hex.txt"
echo

echo "=== Extracting MP4 box tree ==="

if ffprobe -h | grep -q show_boxes; then
    ffprobe -v quiet -print_format json -show_boxes reference_visual.mp4 \
      > reference_visual.boxtree.txt
else
    echo "ffprobe lacks -show_boxes, using fallback parser"
    grep "type:" reference_visual.trace.txt > reference_visual.boxtree.txt
fi

echo "Wrote reference_visual.boxtree.txt"
echo
echo "=== Done ==="
