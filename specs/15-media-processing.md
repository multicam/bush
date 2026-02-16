# Bush - Media Processing

## Summary
FFmpeg-based media processing pipeline triggered on upload completion. BullMQ job queues backed by Redis. Workers run as direct Node.js child processes (no containers). Outputs: thumbnails, filmstrips, proxy transcodes, HLS playlists, audio waveforms, and extracted metadata. All derivatives stored under the key conventions defined in `16-storage-and-data.md`.

---

## 1. Processing Pipeline Overview

### Trigger
- Upload completion (all chunks confirmed, multipart finalized)
- API creates asset record in SQLite with `status = 'processing'`
- API enqueues processing jobs to BullMQ based on file type

### Job Queue Design (BullMQ)
- One Redis-backed BullMQ instance
- Named queues per job type:

| Queue | Job Types | Default Concurrency |
|-------|-----------|-------------------|
| `media:thumbnail` | Thumbnail generation | 4 |
| `media:filmstrip` | Hover scrub filmstrip | 2 |
| `media:proxy` | Proxy transcoding + HLS | 2 |
| `media:waveform` | Audio waveform extraction | 4 |
| `media:metadata` | FFprobe metadata extraction | 8 |

- Metadata extraction runs first (other jobs may depend on duration, resolution, codec info)
- Job data includes: `assetId`, `accountId`, `projectId`, `storageKey`, `mimeType`, `sourceFilename`

### Job Dependency Chain
```
upload complete
  --> media:metadata (always first)
      --> media:thumbnail (after metadata)
      --> media:filmstrip (after metadata, video only)
      --> media:proxy (after metadata, video only)
      --> media:waveform (after metadata, video/audio only)
```

### Worker Architecture
- Workers are Node.js processes spawned via `child_process.fork()` or standalone Node scripts
- Each worker process registers with BullMQ and processes jobs from its assigned queue
- FFmpeg/FFprobe invoked via `child_process.execFile()` -- not shell execution
- Worker count configurable via environment variables:
  ```
  WORKER_THUMBNAIL_CONCURRENCY=4
  WORKER_FILMSTRIP_CONCURRENCY=2
  WORKER_PROXY_CONCURRENCY=2
  WORKER_WAVEFORM_CONCURRENCY=4
  WORKER_METADATA_CONCURRENCY=8
  ```
- Graceful shutdown: finish current job before exit (SIGTERM handler)
- Health check: workers report heartbeat to Redis (`bush:worker:{worker_id}:heartbeat`)

### Prioritization
- Priority levels (BullMQ priority field, lower = higher priority):
  - `1` -- User-initiated re-process or version replacement
  - `5` -- Standard upload (default)
  - `10` -- Bulk upload / batch import
- Within same priority: FIFO ordering

---

## 2. Thumbnail Generation

### Video Thumbnails
- Extract single frame at configurable position (default: 50% of duration)
- Position stored as `thumbnail_position` on asset record (overridable via "Set Thumbnail" action)
- Generate three sizes:

| Size | Dimensions | Use |
|------|-----------|-----|
| Small | 320x180 | Grid view (small cards) |
| Medium | 640x360 | Grid view (medium/large cards) |
| Large | 1280x720 | Player poster, share previews |

- Format: WebP (quality 80). JPEG fallback if client lacks WebP support.
- Aspect ratio preserved; letterbox/pillarbox with black if non-16:9
- FFmpeg command (video):
  ```bash
  # Extract frame at 50% duration (e.g., 60s for a 120s video)
  ffmpeg -ss 60 -i input.mov -vframes 1 -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black" -c:v libwebp -quality 80 thumb_large.webp
  ffmpeg -ss 60 -i input.mov -vframes 1 -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:black" -c:v libwebp -quality 80 thumb_medium.webp
  ffmpeg -ss 60 -i input.mov -vframes 1 -vf "scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2:black" -c:v libwebp -quality 80 thumb_small.webp
  ```

### Image Thumbnails
- Resize source image directly (no frame extraction)
- Same three output sizes
- For animated GIF/WebP: extract first frame only
- FFmpeg command:
  ```bash
  ffmpeg -i input.jpg -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black" -c:v libwebp -quality 80 thumb_large.webp
  ```

### RAW Image Thumbnails
- Convert RAW to intermediate TIFF via dcraw/LibRaw first, then resize
  ```bash
  dcraw -T -w -o 1 input.cr3    # outputs input.tiff
  ffmpeg -i input.tiff -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black" -c:v libwebp -quality 80 thumb_large.webp
  ```

### Adobe Format Thumbnails (PSD, AI, EPS)
- Render via ImageMagick (first layer / first page):
  ```bash
  convert "input.psd[0]" -resize 1280x720 -background black -gravity center -extent 1280x720 thumb_large.webp
  ```

### Document Thumbnails (PDF, DOCX, PPTX, XLSX)
- PDF: render first page via ImageMagick/Ghostscript
  ```bash
  convert -density 150 "input.pdf[0]" -resize 1280x720 -background white -gravity center -extent 1280x720 thumb_large.webp
  ```
- DOCX/PPTX/XLSX: convert to PDF first via LibreOffice headless, then render first page
  ```bash
  libreoffice --headless --convert-to pdf input.docx --outdir /tmp
  convert -density 150 "/tmp/input.pdf[0]" -resize 1280x720 thumb_large.webp
  ```

### Storage Keys
```
{account_id}/{project_id}/{asset_id}/thumbnail/thumb_small.webp
{account_id}/{project_id}/{asset_id}/thumbnail/thumb_medium.webp
{account_id}/{project_id}/{asset_id}/thumbnail/thumb_large.webp
```

---

## 3. Hover Scrub Filmstrip

### Generation
- Video assets only
- Extract one frame per second of video duration
- Each frame: 160x90 pixels (16:9)
- Assemble into a sprite sheet (tile grid)
- Grid layout: 10 columns, rows as needed
  - Example: 120-second video = 120 frames = 10x12 grid = 1600x1080 sprite sheet

### FFmpeg Command
```bash
# Extract 1fps, scale to 160x90, assemble into 10-column tile grid
ffmpeg -i input.mov -vf "fps=1,scale=160:90:force_original_aspect_ratio=decrease,pad=160:90:(ow-iw)/2:(oh-ih)/2:black,tile=10x0" -c:v mjpeg -q:v 3 filmstrip.jpg
```

### Output Format
- Single JPEG sprite sheet (quality 3, ~50-200 KB for typical video)
- Accompanying JSON manifest:
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

### Client Usage
- On hover, calculate which frame index corresponds to cursor position
- Use CSS `background-position` to show correct tile from sprite sheet

### Storage Keys
```
{account_id}/{project_id}/{asset_id}/filmstrip/filmstrip.jpg
{account_id}/{project_id}/{asset_id}/filmstrip/filmstrip.json
```

---

## 4. Proxy Transcoding

### Resolution Ladder

| Label | Resolution | Video Bitrate | Audio Bitrate | Plan Requirement |
|-------|-----------|--------------|---------------|-----------------|
| 360p | 640x360 | 800 kbps | 128 kbps AAC | All plans |
| 540p | 960x540 | 1.5 Mbps | 128 kbps AAC | All plans |
| 720p | 1280x720 | 2.5 Mbps | 128 kbps AAC | All plans |
| 1080p | 1920x1080 | 5 Mbps | 128 kbps AAC | Pro+ |
| 4K | 3840x2160 | 15 Mbps | 128 kbps AAC | Pro+ |

- Never upscale: if source is 720p, generate 360p, 540p, and 720p only
- Source resolution determined from metadata extraction step

### Codec Settings
- Video: H.264 (libx264), High profile, Level auto
- Pixel format: yuv420p (SDR) or yuv420p10le (HDR 4K proxy)
- Audio: AAC (libfdk_aac preferred, aac fallback), stereo, 128 kbps
- Container: MP4 with `+faststart` for progressive download
- Preset: `medium` (balance of speed and quality)
- CRF mode not used -- target bitrate via `-b:v` for predictable file sizes

### FFmpeg Command (per resolution)
```bash
# 720p proxy example
ffmpeg -i input.mov \
  -c:v libx264 -profile:v high -b:v 2500k -maxrate 3000k -bufsize 5000k \
  -pix_fmt yuv420p \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black" \
  -c:a aac -b:a 128k -ac 2 \
  -movflags +faststart \
  -y proxy_720p.mp4
```

### HLS Generation
- After proxy MP4s are generated, segment each into HLS
- Segment duration: 6 seconds
- Generate per-resolution playlist + master playlist with all variants
- FFmpeg command (per resolution):
  ```bash
  ffmpeg -i proxy_720p.mp4 \
    -c copy -f hls \
    -hls_time 6 -hls_list_size 0 \
    -hls_segment_filename "720p/segment_%03d.ts" \
    720p/playlist.m3u8
  ```
- Master playlist (`master.m3u8`) assembled programmatically:
  ```m3u8
  #EXTM3U
  #EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
  360p/playlist.m3u8
  #EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=960x540
  540p/playlist.m3u8
  #EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
  720p/playlist.m3u8
  #EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
  1080p/playlist.m3u8
  ```

### Storage Keys
```
{account_id}/{project_id}/{asset_id}/proxy/360p.mp4
{account_id}/{project_id}/{asset_id}/proxy/540p.mp4
{account_id}/{project_id}/{asset_id}/proxy/720p.mp4
{account_id}/{project_id}/{asset_id}/proxy/1080p.mp4
{account_id}/{project_id}/{asset_id}/proxy/4k.mp4
{account_id}/{project_id}/{asset_id}/hls/master.m3u8
{account_id}/{project_id}/{asset_id}/hls/720p/playlist.m3u8
{account_id}/{project_id}/{asset_id}/hls/720p/segment_001.ts
```

---

## 5. Audio Waveform Generation

### Applicable To
- Audio files (all 8 supported formats)
- Video files (audio track extracted)

### Waveform Data Format
- JSON peaks array: normalized amplitude values between 0.0 and 1.0
- Resolution: 1 peak per 100ms of audio (10 peaks per second)
- Stereo: average of left and right channels
- Output:
  ```json
  {
    "version": 1,
    "sampleRate": 10,
    "channels": 1,
    "duration": 120.5,
    "peaks": [0.12, 0.34, 0.56, 0.78, 0.45, ...]
  }
  ```

### Extraction Method
- Use FFmpeg to extract raw PCM, then compute peaks in Node.js
  ```bash
  ffmpeg -i input.mov -ac 1 -f f32le -ar 10 -acodec pcm_f32le pipe:1
  ```
- Alternative: use `audiowaveform` CLI tool (BBC) if available
  ```bash
  audiowaveform -i input.wav --pixels-per-second 10 -o waveform.json --output-format json
  ```

### Visual Rendering
- Waveform rendered client-side from JSON peaks data
- Default display: 800x80 pixels (responsive, scales to container)
- Server does NOT generate a PNG -- rendering is purely client-side via Canvas/SVG

### Storage Keys
```
{account_id}/{project_id}/{asset_id}/waveform/waveform.json
```

---

## 6. Metadata Extraction

### Tool
- FFprobe (bundled with FFmpeg) for all media files
- ImageMagick `identify` for image-specific fields
- ExifTool as fallback for RAW/Adobe formats

### FFprobe Command
```bash
ffprobe -v quiet -print_format json -show_format -show_streams input.mov
```

### Field Mapping (FFprobe to Bush Metadata)

| Bush Field | FFprobe Source | Notes |
|-----------|---------------|-------|
| Alpha Channel | `streams[video].pix_fmt` contains "a" (e.g., `yuva420p`) | Boolean |
| Audio Bit Depth | `streams[audio].bits_per_raw_sample` | Integer |
| Audio Bit Rate | `streams[audio].bit_rate` | Convert to human-readable |
| Audio Codec | `streams[audio].codec_name` | Map to display name |
| Bit Depth | `streams[video].bits_per_raw_sample` | Integer |
| Bit Rate | `format.bit_rate` | Overall bitrate |
| Channels | `streams[audio].channels` | Integer |
| Color Space | `streams[video].color_space` | e.g., bt709, bt2020nc |
| Duration | `format.duration` | Seconds (float) |
| Dynamic Range | Derived from color_transfer + color_primaries | See Section 7 |
| End Time | `format.duration` | Same as duration for standard files |
| Frame Rate | `streams[video].r_frame_rate` | Evaluate fraction (e.g., 30000/1001) |
| Resolution - Height | `streams[video].height` | Integer |
| Resolution - Width | `streams[video].width` | Integer |
| Sample Rate | `streams[audio].sample_rate` | Integer (Hz) |
| Start Time | `format.start_time` | Usually 0.0 |
| Video Bit Rate | `streams[video].bit_rate` | May need calculation |
| Video Codec | `streams[video].codec_name` | Map to display name |
| File Size | `format.size` | Bytes |
| File Type | Derived from MIME type / extension | Enum: video, audio, image, document |
| Format | `format.format_long_name` | e.g., "QuickTime / MOV" |
| Page Count | N/A for video/audio; PDF: `pdfinfo` | Integer or null |
| Source Filename | From upload metadata (not FFprobe) | Preserved as-is |

### Codec Display Name Mapping
| FFprobe `codec_name` | Bush Display Name |
|----------------------|------------------|
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

### Handling Missing Fields
- Fields not present in FFprobe output: store as `null` in database
- UI displays "--" or hides the field for null values
- Image files: no Duration, Frame Rate, Audio fields (all null)
- Audio files: no Resolution, Frame Rate, Video fields (all null)
- Documents: only File Size, File Type, Format, Page Count populated

---

## 7. HDR Processing

### HDR Detection
Determined from FFprobe stream properties:

| HDR Standard | Detection Criteria |
|-------------|-------------------|
| HDR10 | `color_transfer=smpte2084` + `color_primaries=bt2020` |
| HDR10+ | HDR10 + dynamic metadata side data |
| HLG | `color_transfer=arib-std-b67` + `color_primaries=bt2020` |
| Dolby Vision | `codec_tag_string` contains "dovi" or side data present |

- Store detected HDR type in `dynamic_range` metadata field
- Values: `SDR`, `HDR10`, `HDR10+`, `HLG`, `Dolby Vision`

### Tone Mapping for SDR Proxies
- All proxies at 360p, 540p, 720p, and 1080p are SDR (yuv420p)
- HDR sources require tone mapping during proxy transcode:
  ```bash
  ffmpeg -i hdr_input.mov \
    -vf "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,scale=1280:720" \
    -c:v libx264 -b:v 2500k -c:a aac -b:a 128k \
    -movflags +faststart proxy_720p.mp4
  ```
- Tone mapping algorithm: `hable` (perceptual, good for mixed content)
- Desaturation: `desat=0` (preserve colors)

### HDR Proxy Preservation (4K, Pro+ Only)
- 4K proxy retains HDR when source is HDR
- Output: H.264 High 10 profile, yuv420p10le, bt2020 color space
- Only generated for Pro+ plans
  ```bash
  ffmpeg -i hdr_input.mov \
    -c:v libx264 -profile:v high10 -b:v 15000k \
    -pix_fmt yuv420p10le \
    -color_primaries bt2020 -color_trc smpte2084 -colorspace bt2020nc \
    -vf "scale=3840:2160:force_original_aspect_ratio=decrease,pad=3840:2160:(ow-iw)/2:(oh-ih)/2:black" \
    -c:a aac -b:a 128k -movflags +faststart proxy_4k.mp4
  ```
- HLS for HDR 4K: segments tagged with appropriate color metadata

---

## 8. Format-Specific Processing

### Video (9 formats: 3GPP, AVI, FLV, MKV, MOV, MP4, MXF, WebM, WMV)
- Full pipeline: metadata + thumbnail + filmstrip + proxy + HLS + waveform
- Standard FFmpeg decode/encode path for all supported codecs

### Audio (8 formats: AAC, AIFF, FLAC, M4A, MP3, OGG, WAV, WMA)
- Pipeline: metadata + waveform only
- No thumbnail (use generic audio icon client-side)
- No proxy transcode (stream original or convert to AAC on-the-fly if needed)

### Image -- Standard (BMP, EXR, GIF, HEIC, JPG, PNG, TGA, TIFF, WebP)
- Pipeline: metadata + thumbnail
- No filmstrip, no proxy, no waveform
- Animated GIF/WebP: first frame only for thumbnail

### Image -- RAW (3fr, arw, cr2, cr3, crw, mrw, nef, orf, pef, raf, rw2, sr2, srf, srw)
- Pipeline: metadata + thumbnail
- Conversion: dcraw or LibRaw to intermediate TIFF, then standard thumbnail pipeline
- dcraw flags: `-T` (TIFF output), `-w` (camera white balance), `-o 1` (sRGB)
- Metadata: ExifTool preferred over FFprobe for RAW files

### Image -- Adobe (PSD, AI, EPS, INDD)
- Pipeline: metadata + thumbnail
- Rendering: ImageMagick `convert` with `[0]` index (first layer/page)
- AI/EPS: may require Ghostscript backend for ImageMagick
- INDD: limited support -- extract embedded preview if available

### Documents (PDF, DOCX, PPTX, XLSX)
- Pipeline: metadata + thumbnail + page previews (PDF)
- PDF: render each page as JPEG for the PDF viewer
  ```bash
  convert -density 150 "input.pdf" -resize 1920x1080 -quality 85 "page_%03d.jpg"
  ```
- Page count: extracted via `pdfinfo` (poppler-utils)
- DOCX/PPTX/XLSX: convert to PDF via LibreOffice headless first
- Page preview storage:
  ```
  {account_id}/{project_id}/{asset_id}/pages/page_001.jpg
  {account_id}/{project_id}/{asset_id}/pages/page_002.jpg
  ```

### Interactive ZIP (HTML)
- No processing -- serve extracted content directly
- ZIP extracted to storage, served via CDN
- Security: sanitize HTML, block external scripts (CSP headers)

---

## 9. Processing Status and Error Handling

### Asset Status Flow
```
uploading --> processing --> ready
                        \-> processing_failed
```

| Status | Description |
|--------|-------------|
| `uploading` | File upload in progress |
| `processing` | At least one processing job is active or queued |
| `ready` | All processing jobs completed successfully |
| `processing_failed` | One or more jobs failed after all retries |

- Partial success: if thumbnail succeeds but proxy fails, asset is `processing_failed` but thumbnail is available
- Client shows available derivatives even when status is `processing_failed`

### Job-Level Status
- Tracked per job in BullMQ (available via `Bull Board` or custom admin UI)
- States: `waiting`, `active`, `completed`, `failed`, `delayed` (retry backoff)

### Retry Strategy
| Setting | Value |
|---------|-------|
| Max attempts | 3 |
| Backoff type | Exponential |
| Initial delay | 5 seconds |
| Backoff multiplier | 2x (5s, 10s, 20s) |

### Timeout Per Job Type
| Job Type | Timeout |
|----------|---------|
| Metadata extraction | 30 seconds |
| Thumbnail generation | 60 seconds |
| Filmstrip generation | 5 minutes |
| Waveform generation | 2 minutes |
| Proxy transcode (per resolution) | 30 minutes |
| HLS segmentation | 10 minutes |
| Document conversion | 5 minutes |

- Timeout triggers job failure (counts as an attempt)

### Failure Handling
1. Job exhausts all retries --> marked as permanently failed in BullMQ
2. Asset `processing_status` updated in SQLite (per-job-type status tracked)
3. If all critical jobs fail: asset status set to `processing_failed`
4. Notification sent to uploader (in-app + email if enabled)
5. Admin dashboard shows failed jobs with error details
6. Manual retry available via API: `POST /api/assets/{id}/reprocess`

### Progress Tracking
- FFmpeg progress parsed from stderr (`time=` output)
- Progress percentage pushed to Redis: `bush:progress:{asset_id}:{job_type}`
- Client receives updates via WebSocket subscription on asset ID
- Progress events: `{ assetId, jobType, progress: 0-100, status }`

---

## 10. Performance Targets

### Processing Time Targets

| Operation | Source Size / Type | Target Time |
|-----------|-------------------|-------------|
| Metadata extraction | Any | < 5 seconds |
| Thumbnail (video) | Any | < 10 seconds |
| Thumbnail (image) | < 50 MB | < 5 seconds |
| Thumbnail (RAW) | < 100 MB | < 15 seconds |
| Filmstrip | 1 hour video | < 2 minutes |
| Waveform | 1 hour audio/video | < 30 seconds |
| Proxy 720p | 1 GB source | ~2-4 minutes |
| Proxy 1080p | 1 GB source | ~3-6 minutes |
| Proxy 4K | 5 GB source | ~10-20 minutes |
| HLS segmentation | Per proxy file | < 30 seconds |
| PDF page render | 50-page PDF | < 1 minute |

### Queue Monitoring
- BullMQ dashboard (Bull Board) exposed on admin route
- Metrics tracked:
  - Queue depth per queue
  - Average processing time per job type
  - Failure rate per job type
  - Worker utilization
- Alerts:
  - Queue depth > 100 jobs: warning
  - Queue depth > 500 jobs: critical
  - Job failure rate > 10% in 1 hour: alert
  - Worker heartbeat missing > 60 seconds: alert

### Resource Management
- FFmpeg processes limited by worker concurrency (not system-level)
- Temp files written to configurable `TEMP_DIR` (default `/tmp/bush-processing`)
- Temp files cleaned up after job completion (success or failure)
- Disk space check before starting large transcode jobs
- Memory: FFmpeg memory usage bounded by `-threads` flag (default: auto, cap at 4 per job)

---

## 11. Environment Configuration

```
# FFmpeg
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe

# ImageMagick
IMAGEMAGICK_PATH=/usr/bin/convert
IDENTIFY_PATH=/usr/bin/identify

# RAW processing
DCRAW_PATH=/usr/bin/dcraw

# LibreOffice (document conversion)
LIBREOFFICE_PATH=/usr/bin/libreoffice

# Worker concurrency
WORKER_THUMBNAIL_CONCURRENCY=4
WORKER_FILMSTRIP_CONCURRENCY=2
WORKER_PROXY_CONCURRENCY=2
WORKER_WAVEFORM_CONCURRENCY=4
WORKER_METADATA_CONCURRENCY=8

# Processing
TEMP_DIR=/tmp/bush-processing
THUMBNAIL_POSITION=0.5
THUMBNAIL_FORMAT=webp
FILMSTRIP_FPS=1
FILMSTRIP_TILE_WIDTH=160
FILMSTRIP_TILE_HEIGHT=90
FILMSTRIP_COLUMNS=10
HLS_SEGMENT_DURATION=6
PROXY_PRESET=medium

# Redis (shared with 16-storage-and-data.md config)
REDIS_URL=redis://localhost:6379
```
