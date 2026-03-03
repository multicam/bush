# Bush - Media Processing

## Overview

Media processing is an FFmpeg-based derivative generation pipeline triggered by upload completion. Workers are stateless units: each worker process registers with a named BullMQ queue backed by Redis, reads a job, downloads the source file from S3-compatible storage, runs FFmpeg or a supporting tool, and writes the output back to storage under deterministic keys. Workers have no shared in-process state. The current deployment runs workers as Node.js child processes on a single server, but the abstraction naturally scales to multiple servers or multiple worker processes without architecture changes — add machines, point them at the same Redis instance and the same storage bucket, and they join the pool. Outputs: thumbnails, filmstrips, proxy transcodes, HLS playlists, audio waveforms, and extracted metadata. All storage keys follow the conventions defined in `06-storage.md`.

---

## Specification

### 1. Worker Abstraction [Phase 1]

#### What a Worker Is

A worker is a long-running Node.js process that:

1. Registers with a specific BullMQ queue.
2. Pulls the next available job.
3. Downloads the source asset from S3-compatible storage via `StorageProvider`.
4. Runs FFmpeg (or a supporting tool: ImageMagick, LibreOffice, dcraw) as a child process.
5. Writes each output file to storage via `StorageProvider`.
6. Reports job completion or failure to BullMQ.
7. Emits progress events to Redis for WebSocket propagation to the client.

Workers are indistinguishable from BullMQ's perspective. Any number can run against the same Redis instance and the same queue. Concurrency is controlled by the `WORKER_*_CONCURRENCY` environment variables.

#### Worker Process Lifecycle

```
startup
  → register with BullMQ queue
  → begin processing loop
  → on SIGTERM: finish current job, then exit (graceful shutdown)
  → heartbeat to Redis every 30 seconds: bush:worker:{worker_id}:heartbeat
```

FFmpeg and FFprobe are invoked via `child_process.execFile()` — never via shell string interpolation. Temp files are written to `MEDIA_TEMP_DIR` (default: `/tmp/bush-processing`) and cleaned up unconditionally after job completion (success or failure).

#### Worker Configuration

```
WORKER_METADATA_CONCURRENCY=8
WORKER_THUMBNAIL_CONCURRENCY=4
WORKER_FILMSTRIP_CONCURRENCY=2
WORKER_PROXY_CONCURRENCY=2
WORKER_WAVEFORM_CONCURRENCY=4
MEDIA_TEMP_DIR=/tmp/bush-processing
FFMPEG_PATH=/usr/local/bin/ffmpeg
FFPROBE_PATH=/usr/local/bin/ffprobe
```

Full variable reference in `30-configuration.md`.

---

### 2. Processing Pipeline Overview [Phase 1]

#### Trigger

- Upload completion (all chunks confirmed, multipart finalized).
- API creates asset record in SQLite with `status = 'processing'`.
- API enqueues processing jobs to BullMQ based on file MIME type.

#### Job Queue Design

| Queue | Default Concurrency |
|-------|-------------------|
| `media:metadata` | 8 |
| `media:thumbnail` | 4 |
| `media:filmstrip` | 2 |
| `media:proxy` | 2 |
| `media:waveform` | 4 |

Job data payload:
```typescript
{
  assetId: string;
  accountId: string;
  projectId: string;
  storageKey: string;  // key of the original file in storage
  mimeType: string;
  sourceFilename: string;
}
```

#### Job Dependency Chain

```
upload complete
  → media:metadata  (always first; provides duration, resolution, codec)
      → media:thumbnail   (after metadata)
      → media:filmstrip   (after metadata, video only)
      → media:proxy       (after metadata, video only)
      → media:waveform    (after metadata, video and audio only)
      → media:transcription (after metadata, video and audio only — see 08-transcription.md)
```

#### Job Prioritization

Priority field on BullMQ jobs (lower number = higher priority):

| Priority | Scenario |
|----------|----------|
| 1 | User-initiated reprocess or version replacement |
| 5 | Standard upload (default) |
| 10 | Bulk upload or batch import |

Within the same priority level: FIFO ordering.

---

### 3. Thumbnail Generation [Phase 1]

#### Output Sizes

| Size | Dimensions | Storage Key |
|------|-----------|-------------|
| Small | 320×180 | `thumbnail/thumb_small.webp` |
| Medium | 640×360 | `thumbnail/thumb_medium.webp` |
| Large | 1280×720 | `thumbnail/thumb_large.webp` |

Format: WebP, quality 80. Aspect ratio preserved; non-16:9 sources letterboxed/pillarboxed with black.

The thumbnail extraction position defaults to 50% of duration. Users can override via "Set Thumbnail" action; the position is stored as `thumbnail_position` on the asset record and re-used on reprocess.

#### Video Thumbnails

```bash
# Extract frame at 50% duration (e.g., 60s for a 120s video)
ffmpeg -ss 60 -i input.mov -vframes 1 \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black" \
  -c:v libwebp -quality 80 thumb_large.webp

ffmpeg -ss 60 -i input.mov -vframes 1 \
  -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:black" \
  -c:v libwebp -quality 80 thumb_medium.webp

ffmpeg -ss 60 -i input.mov -vframes 1 \
  -vf "scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2:black" \
  -c:v libwebp -quality 80 thumb_small.webp
```

#### Image Thumbnails

```bash
ffmpeg -i input.jpg \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black" \
  -c:v libwebp -quality 80 thumb_large.webp
```

Animated GIF/WebP: extract first frame only (`-vframes 1`).

#### RAW Image Thumbnails

```bash
dcraw -T -w -o 1 input.cr3   # outputs input.tiff
ffmpeg -i input.tiff \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black" \
  -c:v libwebp -quality 80 thumb_large.webp
```

`dcraw` flags: `-T` (TIFF output), `-w` (camera white balance), `-o 1` (sRGB).

#### Adobe Format Thumbnails (PSD, AI, EPS)

```bash
convert "input.psd[0]" -resize 1280x720 -background black \
  -gravity center -extent 1280x720 thumb_large.webp
```

AI/EPS requires Ghostscript backend for ImageMagick. INDD: extract embedded preview if available; otherwise generate a placeholder.

#### Document Thumbnails (PDF, DOCX, PPTX, XLSX)

```bash
# PDF
convert -density 150 "input.pdf[0]" -resize 1280x720 \
  -background white -gravity center -extent 1280x720 thumb_large.webp

# DOCX/PPTX/XLSX — convert to PDF first
libreoffice --headless --convert-to pdf input.docx --outdir /tmp
convert -density 150 "/tmp/input.pdf[0]" -resize 1280x720 thumb_large.webp
```

#### Performance Targets

| Source | Target |
|--------|--------|
| Video (any size) | < 10 seconds |
| Image (< 50 MB) | < 5 seconds |
| RAW image (< 100 MB) | < 15 seconds |

---

### 4. Hover Scrub Filmstrip [Phase 1]

Video assets only.

#### Generation

- Extract one frame per second of video duration.
- Each frame: 160×90 pixels (16:9).
- Assemble into a JPEG sprite sheet, 10-column tile grid.
- Example: 120-second video = 120 frames = 10×12 grid = 1600×1080 pixels.

```bash
ffmpeg -i input.mov \
  -vf "fps=1,scale=160:90:force_original_aspect_ratio=decrease,pad=160:90:(ow-iw)/2:(oh-ih)/2:black,tile=10x0" \
  -c:v mjpeg -q:v 3 filmstrip.jpg
```

#### Manifest

```json
{
  "width": 160,
  "height": 90,
  "columns": 10,
  "rows": 12,
  "totalFrames": 120,
  "intervalSeconds": 1
}
```

#### Storage Keys

```
{account_id}/{project_id}/{asset_id}/filmstrip/filmstrip.jpg
{account_id}/{project_id}/{asset_id}/filmstrip/filmstrip.json
```

#### Client Usage

On hover, derive the frame index from cursor position, then use CSS `background-position` to display the correct tile.

#### Performance Target

| Source | Target |
|--------|--------|
| 1-hour video | < 2 minutes |

---

### 5. Proxy Transcoding [Phase 1]

#### Resolution Ladder

| Label | Resolution | Video Bitrate | Audio Bitrate | Plan |
|-------|-----------|--------------|---------------|------|
| 360p | 640×360 | 800 kbps | 128 kbps AAC | All plans |
| 540p | 960×540 | 1.5 Mbps | 128 kbps AAC | All plans |
| 720p | 1280×720 | 2.5 Mbps | 128 kbps AAC | All plans |
| 1080p | 1920×1080 | 5 Mbps | 128 kbps AAC | Pro+ |
| 4K | 3840×2160 | 15 Mbps | 128 kbps AAC | Pro+ |

Never upscale: source resolution (from `media:metadata` job) determines which tiers are generated.

#### Codec Settings

- Video: H.264 (libx264), High profile, level auto.
- Pixel format: yuv420p (SDR) or yuv420p10le (HDR 4K proxy, Pro+ only).
- Audio: AAC (`libfdk_aac` preferred, `aac` fallback), stereo, 128 kbps.
- Container: MP4 with `-movflags +faststart` for progressive download.
- Preset: `medium` (balance of speed and quality).
- Target bitrate via `-b:v` (not CRF) for predictable file sizes.

#### FFmpeg Command (per resolution)

```bash
# 720p example
ffmpeg -i input.mov \
  -c:v libx264 -profile:v high -b:v 2500k -maxrate 3000k -bufsize 5000k \
  -pix_fmt yuv420p \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black" \
  -c:a aac -b:a 128k -ac 2 \
  -movflags +faststart \
  -y proxy_720p.mp4
```

#### Storage Keys

```
{account_id}/{project_id}/{asset_id}/proxy/360p.mp4
{account_id}/{project_id}/{asset_id}/proxy/540p.mp4
{account_id}/{project_id}/{asset_id}/proxy/720p.mp4
{account_id}/{project_id}/{asset_id}/proxy/1080p.mp4
{account_id}/{project_id}/{asset_id}/proxy/4k.mp4
```

#### Performance Targets

| Source | Target |
|--------|--------|
| 1 GB source → 720p | 2–4 minutes |
| 1 GB source → 1080p | 3–6 minutes |
| 5 GB source → 4K | 10–20 minutes |

---

### 6. HLS Generation [Phase 1]

After proxy MP4s are written to storage, segment each into HLS.

- Segment duration: 6 seconds.
- Generate per-resolution playlist and a master playlist referencing all variants.
- Client-side playback via **hls.js** (Chrome, Firefox) with native HLS fallback (Safari).

```bash
# Per-resolution segmentation (actual implementation transcodes from source)
ffmpeg -i source.mov \
  -c:v libx264 -profile:v high -b:v 2500k -maxrate 3000k -bufsize 5000k \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black" \
  -c:a aac -b:a 128k -ac 2 -pix_fmt yuv420p \
  -f hls -hls_time 6 -hls_list_size 0 -hls_playlist_type vod \
  -hls_segment_filename "720p/segment_%04d.ts" \
  720p/playlist.m3u8
```

Master playlist assembled programmatically. When a WebVTT caption file exists, the master playlist includes a subtitle track:

```m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-INDEPENDENT-SEGMENTS

#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",DEFAULT=NO,AUTOSELECT=YES,LANGUAGE="en",URI="../captions/en.vtt"

#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,SUBTITLES="subs"
360p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=960x540,SUBTITLES="subs"
540p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,SUBTITLES="subs"
720p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,SUBTITLES="subs"
1080p/playlist.m3u8
```

#### Client-Side Playback

The video viewer uses **hls.js** for adaptive bitrate streaming on non-Safari browsers:

- Dynamic import (code-split, ~60KB gzipped) — only loaded when `hlsSrc` is provided
- Safari: native HLS via `video.src = hlsSrc`
- Chrome/Firefox: `Hls.isSupported()` → attach to `<video>` element
- Fallback: proxy MP4 if HLS is unavailable
- Resolution switcher wired to `hls.currentLevel` for manual quality selection
- ABR enabled by default (`startLevel: -1`)
- Fatal error recovery: network errors retry, media errors recover, unrecoverable falls back to MP4

#### Caption Tracks in HLS

When a transcription is completed for a video file, a WebVTT caption file is generated and stored:

1. `processWebVTT` reads transcript words from DB, groups into segments, exports as VTT
2. Stored at `{account_id}/{project_id}/{asset_id}/captions/{language}.vtt`
3. HLS master playlist checks for caption file existence via `headObject`
4. If present, adds `#EXT-X-MEDIA:TYPE=SUBTITLES` to manifest
5. hls.js exposes subtitle tracks via `hls.subtitleTracks` — wired to caption toggle

#### Storage Keys

```
{account_id}/{project_id}/{asset_id}/hls/master.m3u8
{account_id}/{project_id}/{asset_id}/hls/360p/playlist.m3u8
{account_id}/{project_id}/{asset_id}/hls/360p/segment_0001.ts
{account_id}/{project_id}/{asset_id}/hls/720p/playlist.m3u8
{account_id}/{project_id}/{asset_id}/hls/720p/segment_0001.ts
{account_id}/{project_id}/{asset_id}/captions/en.vtt
```

#### Performance Target

| Source | Target |
|--------|--------|
| Per proxy file | < 30 seconds |

---

### 7. Audio Waveform Generation [Phase 1]

Applicable to: audio files (all supported formats) and video files (audio track extracted).

#### Output Format

JSON only. No PNG. Client renders waveform from peak data using Canvas or SVG.

```json
{
  "version": 1,
  "sampleRate": 10,
  "channels": 1,
  "duration": 120.5,
  "peaks": [0.12, 0.34, 0.56, 0.78, 0.45]
}
```

- Resolution: 1 peak per 100 ms (10 peaks per second).
- Stereo inputs: average left and right channels to mono peaks.
- Values normalized to 0.0–1.0.

#### Extraction

Primary: FFmpeg raw PCM piped to Node.js peak computation:

```bash
ffmpeg -i input.mov -ac 1 -f f32le -ar 10 -acodec pcm_f32le pipe:1
```

Alternative (if `audiowaveform` CLI is available):

```bash
audiowaveform -i input.wav --pixels-per-second 10 -o waveform.json --output-format json
```

#### Storage Key

```
{account_id}/{project_id}/{asset_id}/waveform/waveform.json
```

#### Performance Target

| Source | Target |
|--------|--------|
| 1-hour audio or video | < 30 seconds |

---

### 8. Metadata Extraction [Phase 1]

Runs first in the job dependency chain. All downstream jobs depend on its output.

#### Tools

- FFprobe (bundled with FFmpeg): all media files.
- ImageMagick `identify`: image-specific fields.
- ExifTool: fallback for RAW and Adobe formats.

#### FFprobe Command

```bash
ffprobe -v quiet -print_format json -show_format -show_streams input.mov
```

#### Field Mapping

| Bush Field | FFprobe Source | Notes |
|-----------|---------------|-------|
| Alpha Channel | `streams[video].pix_fmt` contains "a" | Boolean |
| Audio Bit Depth | `streams[audio].bits_per_raw_sample` | Integer |
| Audio Bit Rate | `streams[audio].bit_rate` | Convert to human-readable |
| Audio Codec | `streams[audio].codec_name` | Map to display name |
| Bit Depth | `streams[video].bits_per_raw_sample` | Integer |
| Bit Rate | `format.bit_rate` | Overall bitrate |
| Channels | `streams[audio].channels` | Integer |
| Color Space | `streams[video].color_space` | e.g., bt709, bt2020nc |
| Duration | `format.duration` | Seconds (float) |
| Dynamic Range | Derived from color_transfer + color_primaries | SDR, HDR10, HDR10+, HLG, Dolby Vision |
| Frame Rate | `streams[video].r_frame_rate` | Evaluate fraction (30000/1001) |
| Height | `streams[video].height` | Integer |
| Width | `streams[video].width` | Integer |
| Sample Rate | `streams[audio].sample_rate` | Integer (Hz) |
| Video Bit Rate | `streams[video].bit_rate` | May require calculation |
| Video Codec | `streams[video].codec_name` | Map to display name |
| File Size | `format.size` | Bytes |
| Format | `format.format_long_name` | e.g., "QuickTime / MOV" |
| Page Count | `pdfinfo` (PDF only) | Integer or null |
| Source Filename | Upload metadata | Not from FFprobe |

#### Codec Display Name Mapping

| FFprobe `codec_name` | Display Name |
|----------------------|-------------|
| h264 | H.264/AVC |
| hevc | H.265/HEVC |
| prores | Apple ProRes |
| dnxhd | Avid DNxHD |
| mjpeg | Motion JPEG |
| aac | AAC |
| pcm_s16le / pcm_s24le | PCM |
| mp3 | MP3 |
| flac | FLAC |
| vorbis | Vorbis |

Fields absent from FFprobe output are stored as `null`. The UI displays `--` or hides the field for null values.

#### Performance Target

| Source | Target |
|--------|--------|
| Any file | < 5 seconds |

---

### 9. HDR Processing [Phase 1]

#### Detection

Determined from FFprobe stream properties:

| HDR Standard | Detection Criteria |
|-------------|-------------------|
| HDR10 | `color_transfer=smpte2084` + `color_primaries=bt2020` |
| HDR10+ | HDR10 + dynamic metadata side data |
| HLG | `color_transfer=arib-std-b67` + `color_primaries=bt2020` |
| Dolby Vision | `codec_tag_string` contains "dovi" or side data present |

Stored as `dynamic_range` on the asset record. Values: `SDR`, `HDR10`, `HDR10+`, `HLG`, `Dolby Vision`.

#### Tone Mapping for SDR Proxies (360p, 540p, 720p, 1080p)

HDR sources require tone mapping during proxy transcode:

```bash
ffmpeg -i hdr_input.mov \
  -vf "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,scale=1280:720" \
  -c:v libx264 -b:v 2500k \
  -c:a aac -b:a 128k \
  -movflags +faststart proxy_720p.mp4
```

Tone mapping algorithm: `hable` (perceptual, good for mixed content). `desat=0` preserves colors.

#### HDR 4K Proxy Preservation (Pro+)

4K proxy retains HDR when source is HDR. H.264 High 10 profile, yuv420p10le, bt2020 color space.

```bash
ffmpeg -i hdr_input.mov \
  -c:v libx264 -profile:v high10 -b:v 15000k \
  -pix_fmt yuv420p10le \
  -color_primaries bt2020 -color_trc smpte2084 -colorspace bt2020nc \
  -vf "scale=3840:2160:force_original_aspect_ratio=decrease,pad=3840:2160:(ow-iw)/2:(oh-ih)/2:black" \
  -c:a aac -b:a 128k -movflags +faststart proxy_4k.mp4
```

HLS segments for HDR 4K are tagged with the appropriate color metadata.

---

### 10. Format-Specific Processing [Phase 1]

| Format Group | Formats | Pipeline |
|-------------|---------|---------|
| Video | 3GPP, AVI, FLV, MKV, MOV, MP4, MXF, WebM, WMV | metadata + thumbnail + filmstrip + proxy + HLS + waveform |
| Audio | AAC, AIFF, FLAC, M4A, MP3, OGG, WAV, WMA | metadata + waveform |
| Image (standard) | BMP, EXR, GIF, HEIC, JPG, PNG, TGA, TIFF, WebP | metadata + thumbnail |
| Image (RAW) | 3fr, arw, cr2, cr3, crw, mrw, nef, orf, pef, raf, rw2, sr2, srf, srw | metadata + thumbnail (via dcraw/LibRaw) |
| Image (Adobe) | PSD, AI, EPS, INDD | metadata + thumbnail (via ImageMagick) |
| Documents | PDF, DOCX, PPTX, XLSX | metadata + thumbnail + page previews (PDF) |
| Markdown | .md, .markdown | none — fetched as text, rendered client-side |

#### Document Page Previews (PDF)

```bash
# Render all pages as JPEG for the PDF viewer
convert -density 150 "input.pdf" -resize 1920x1080 -quality 85 "page_%03d.jpg"
```

Page count extracted via `pdfinfo` (poppler-utils). DOCX/PPTX/XLSX converted to PDF via LibreOffice headless before page rendering.

Storage keys:
```
{account_id}/{project_id}/{asset_id}/pages/page_001.jpg
{account_id}/{project_id}/{asset_id}/pages/page_002.jpg
```

Performance target: 50-page PDF rendered in < 1 minute.

---

### 11. Processing Status and Error Handling [Phase 1]

#### Asset Status Flow

```
uploading → processing → ready
                     └→ processing_failed
```

| Status | Meaning |
|--------|---------|
| `uploading` | File upload in progress |
| `processing` | At least one job is active or queued |
| `ready` | All jobs completed successfully |
| `processing_failed` | One or more jobs failed after all retries |

Partial success: if thumbnail succeeds but proxy fails, the asset is `processing_failed` but thumbnail is available and served. The client shows available derivatives regardless of overall status.

#### Job-Level Status

Tracked per job in BullMQ. States: `waiting`, `active`, `completed`, `failed`, `delayed`.

#### Retry Strategy

| Setting | Value |
|---------|-------|
| Max attempts | 3 |
| Backoff type | Exponential |
| Initial delay | 5 seconds |
| Multiplier | 2× (5 s, 10 s, 20 s) |

#### Timeouts

| Job Type | Timeout |
|----------|---------|
| Metadata extraction | 30 seconds |
| Thumbnail generation | 60 seconds |
| Filmstrip generation | 5 minutes |
| Waveform generation | 2 minutes |
| Proxy transcode (per resolution) | 30 minutes |
| HLS segmentation | 10 minutes |
| Document conversion | 5 minutes |

Timeout counts as a failed attempt.

#### Failure Handling

1. Job exhausts all retries → permanently failed in BullMQ.
2. `processing_status` updated in SQLite per job type.
3. If all critical jobs fail → asset status set to `processing_failed`.
4. In-app and email notification sent to the uploader.
5. Admin dashboard shows failed jobs with error details and stack trace.
6. Manual retry: `POST /api/assets/{id}/reprocess` (see `04-api-reference.md`).

#### Progress Tracking

- FFmpeg progress parsed from stderr (`time=` field).
- Progress percentage written to Redis: `bush:progress:{asset_id}:{job_type}` (0–100).
- Client receives updates via WebSocket subscription on asset ID.
- Event shape: `{ assetId, jobType, progress: number, status: string }`.

---

### 12. Queue Monitoring [Phase 1]

- BullMQ dashboard (Bull Board) exposed on an admin-only route.
- Metrics tracked per queue: depth, average processing time, failure rate, worker utilization.

#### Alerts

| Condition | Severity |
|-----------|----------|
| Queue depth > 100 jobs | Warning |
| Queue depth > 500 jobs | Critical |
| Job failure rate > 10% in 1 hour | Alert |
| Worker heartbeat missing > 60 seconds | Alert |

---

### 13. Resource Management [Phase 1]

- FFmpeg concurrency bounded by `WORKER_*_CONCURRENCY` — no system-level cgroups required.
- Temp files in `MEDIA_TEMP_DIR`. Cleaned up after each job unconditionally.
- Disk space check performed before starting large transcode jobs.
- FFmpeg thread cap: `-threads 4` per job (default auto would saturate CPU on concurrent jobs).
- Memory: FFmpeg memory bounded by thread cap and output resolution; no additional limit needed for 1080p and below.

---

## Cross-references

- `06-storage.md` — storage key conventions, derivative types, upload flow, queue names
- `01-data-model.md` — asset entity schema, processing status fields
- `04-api-reference.md` — reprocess endpoint, asset status API
- `30-configuration.md` — FFmpeg binary paths, temp directory, worker concurrency, HLS segment duration
