#!/usr/bin/env bash
# Generate synthetic media fixtures for BP tests
# Produces tiny files suitable for upload testing (~100KB total)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MEDIA_DIR="$SCRIPT_DIR/media"

mkdir -p "$MEDIA_DIR"

echo "Generating BP media fixtures..."

# Video: 2s 320x240 color bars (~50KB)
if [ ! -f "$MEDIA_DIR/sample-video.mp4" ]; then
  if command -v ffmpeg &>/dev/null; then
    ffmpeg -y -f lavfi -i "color=c=blue:s=320x240:d=2" \
      -c:v libx264 -preset ultrafast -crf 40 \
      "$MEDIA_DIR/sample-video.mp4" 2>/dev/null
    echo "  ✓ sample-video.mp4"
  else
    echo "  ⚠ ffmpeg not found, creating placeholder video"
    dd if=/dev/urandom of="$MEDIA_DIR/sample-video.mp4" bs=1024 count=50 2>/dev/null
  fi
fi

# Image: 800x600 gradient (~15KB)
if [ ! -f "$MEDIA_DIR/sample-image.jpg" ]; then
  if command -v convert &>/dev/null; then
    convert -size 800x600 gradient:blue-purple "$MEDIA_DIR/sample-image.jpg" 2>/dev/null
    echo "  ✓ sample-image.jpg"
  elif command -v ffmpeg &>/dev/null; then
    ffmpeg -y -f lavfi -i "color=c=purple:s=800x600:d=1" \
      -frames:v 1 "$MEDIA_DIR/sample-image.jpg" 2>/dev/null
    echo "  ✓ sample-image.jpg (via ffmpeg)"
  else
    echo "  ⚠ No image tool found, creating placeholder"
    dd if=/dev/urandom of="$MEDIA_DIR/sample-image.jpg" bs=1024 count=15 2>/dev/null
  fi
fi

# Audio: 3s sine wave (~20KB)
if [ ! -f "$MEDIA_DIR/sample-audio.mp3" ]; then
  if command -v ffmpeg &>/dev/null; then
    # Try mp3 first, fall back to wav if libmp3lame unavailable
    if ffmpeg -y -f lavfi -i "sine=frequency=440:duration=3" \
        -c:a libmp3lame -b:a 48k \
        "$MEDIA_DIR/sample-audio.mp3" 2>/dev/null; then
      echo "  ✓ sample-audio.mp3"
    else
      ffmpeg -y -f lavfi -i "sine=frequency=440:duration=3" \
        -c:a pcm_s16le \
        "$MEDIA_DIR/sample-audio.wav" 2>/dev/null
      # Rename to .mp3 for test consistency (content doesn't matter for upload tests)
      mv "$MEDIA_DIR/sample-audio.wav" "$MEDIA_DIR/sample-audio.mp3"
      echo "  ✓ sample-audio.mp3 (wav fallback)"
    fi
  else
    echo "  ⚠ ffmpeg not found, creating placeholder audio"
    dd if=/dev/urandom of="$MEDIA_DIR/sample-audio.mp3" bs=1024 count=20 2>/dev/null
  fi
fi

# Document: 1-page text PDF (~10KB)
if [ ! -f "$MEDIA_DIR/sample-document.pdf" ]; then
  # Minimal valid PDF with text
  cat > "$MEDIA_DIR/sample-document.pdf" << 'PDFEOF'
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 24 Tf 100 700 Td (Bush BP Test) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000360 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
441
%%EOF
PDFEOF
  echo "  ✓ sample-document.pdf"
fi

echo "✅ Media fixtures ready in $MEDIA_DIR"
ls -lh "$MEDIA_DIR/"
