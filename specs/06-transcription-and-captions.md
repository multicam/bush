# Bush - Transcription & Captions

## R6 Decision (2026-02-18)

> **Primary provider: Deepgram Nova-2** — $200 free credits (~427 hours, 8-42 months runway at 10-50 hrs/mo).
> **Self-hosted fallback: faster-whisper small INT8** — EUR 0-3.29/mo, viable on main VPS or dedicated CX22.
> **Architecture: Abstracted `TranscriptionProvider` interface** — swap or combine providers without code changes.
> **Diarization MVP: None** — add later via cloud API or SpeechBrain CPU pipeline.

---

## Summary

Bush provides AI-powered transcription and caption capabilities to make video and audio content searchable and accessible. Transcription runs as an async BullMQ job after upload, stores word-level timestamped results in the database, and integrates with the existing FTS5 search index.

---

## 1. Provider Architecture

### Abstracted Interface

All providers implement `TranscriptionProvider`:

```typescript
interface TranscriptionProvider {
  readonly name: string;
  submit(request: TranscriptionRequest): Promise<string>;
  getResult(requestId: string): Promise<TranscriptionResult | null>;
  parseCallback(payload: unknown): TranscriptionResult;
  isCallbackSuccess(payload: unknown): boolean;
}
```

### Provider Comparison (R6 Research)

| Provider | Cost/hr (w/ diarization) | Languages | Diarization | WER (English) | Free Tier |
|----------|------------------------|-----------|-------------|---------------|-----------|
| **Deepgram Nova-2** | $0.47 | 36 | Yes | ~5-8% | $200 credits |
| AssemblyAI | $0.17 | 99 | Yes (best) | ~5-8% | $50 credits |
| faster-whisper small INT8 | EUR 0-3.29/mo VPS | 100+ | No | ~10-12% | Open source |
| whisper.cpp small | EUR 0-3.29/mo VPS | 100+ | No | ~10-12% | Open source |
| OpenAI Whisper API | $0.36 | 57 | No | ~9-10% | None |
| Google Cloud STT V2 | $1.44 | 125+ | Yes | ~10-12% | 60 min/mo |

### Provider Selection Logic

1. **Phase 1 (MVP)**: Deepgram Nova-2 via API. Free credits cover the bootstrap period. Best quality + diarization.
2. **Phase 2 (post-credits)**: Evaluate cost. Options:
   - Stay with Deepgram ($23/mo at 50 hrs)
   - Switch to AssemblyAI ($8.50/mo, 2.7x cheaper)
   - Switch to self-hosted faster-whisper (EUR 3.29/mo, no diarization)
   - Hybrid: self-hosted for bulk, cloud API for diarization-needed files

---

## 2. Self-Hosted Option (faster-whisper)

### Feasibility

| Setup | RAM | Speed (1hr audio) | Cost |
|-------|-----|-------------------|------|
| Main VPS (2 threads, shared) | 1.5 GB | ~60-90 min | EUR 0 |
| Dedicated CX22 (2 vCPU, 4GB) | 1.5 GB | ~40-60 min | EUR 3.29/mo |
| Dedicated CX32 (4 vCPU, 8GB) | 1.5 GB | ~25-40 min | EUR 7.11/mo |

### What Doesn't Work Self-Hosted

- Whisper large-v3: needs 10-15GB RAM, hours per file on CPU
- Pyannote diarization on CPU: impractically slow without GPU
- SenseVoice/Moonshine: only 5-7 languages (need 27+)
- Vosk/DeepSpeech/Coqui: dead or too inaccurate

### Self-Hosted Architecture

```
[Main VPS]                         [Transcription VPS (optional)]
  BullMQ pushes job  ──Redis──>      faster-whisper worker
  FFmpeg extracts audio              Processes with small INT8 model
                     <──Redis──      Returns word-level JSON
```

---

## 3. Features

### 3.1 Automatic Transcription
- Triggered automatically after video/audio upload completes
- BullMQ `media:transcription` queue (same infrastructure as thumbnails, proxies)
- Audio extracted from video via FFmpeg (mono, 16kHz WAV) before sending to provider
- Language auto-detection (or user-specified hint)
- 27+ languages supported (36 via Deepgram, 100+ via Whisper)

### 3.2 Word-Level Timestamps
- Every word stored with start/end time in milliseconds
- Enables time-synced highlighting during playback
- Click-to-seek from any word in the transcript
- Supports search-within-transcript with jump-to-time

### 3.3 Speaker Diarization (Phase 2)
- Identifies distinct speakers in the audio
- Generic labels (Speaker 1, Speaker 2) assigned automatically
- User can rename speakers after the fact (stored in `speakerNames` JSON)
- Speaker changes reflected in transcript display and captions
- MVP ships without diarization; added via cloud API or SpeechBrain

### 3.4 Editable Transcripts
- Users can correct transcription errors inline
- Original word preserved (`originalWord` column) for audit trail
- Edits tracked with `editedAt` and `editedByUserId`
- Edited transcript used for search index and caption export

### 3.5 Caption Export
- Generate WebVTT (.vtt) and SRT (.srt) from stored word data
- Words grouped into ~7-word segments, respecting speaker changes
- Speaker names included in captions (VTT `<v>` tags, SRT `[]` prefix)
- Export via API: `GET /v4/files/:id/captions?format=vtt`

### 3.6 Transcript Search
- Full transcript text indexed in SQLite FTS5
- Search results link to specific files with timestamp
- Integrates with existing global search (Cmd+K)
- Highlighted search terms in transcript view

---

## 4. Processing Pipeline

### Job Flow

```
File uploaded
  → media:metadata job extracts duration
  → media:transcription job queued (after metadata complete)
    → FFmpeg extracts audio (mono, 16kHz, WAV)
    → Audio sent to provider (URL or upload)
    → Provider returns word-level JSON (via callback or polling)
    → Words stored in transcript_words table
    → Full text stored in transcripts table
    → FTS5 search index updated
    → File status updated
```

### Queue Configuration

```typescript
// Added to existing media queue types
TRANSCRIPTION: "media:transcription"

// Job options
{
  attempts: 3,
  backoff: { type: "exponential", delay: 60000 },
  timeout: 1800000, // 30 minutes max
  removeOnComplete: true,
}
```

---

## 5. Database Schema

### `transcripts` Table

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | `tr_` prefixed ID |
| file_id | TEXT FK (unique) | One transcript per file |
| provider | TEXT | `deepgram`, `assemblyai`, `faster-whisper` |
| provider_transcript_id | TEXT | External reference ID |
| full_text | TEXT | Complete transcript for search/display |
| language | TEXT | Detected language (ISO 639-1) |
| language_confidence | INTEGER | 0-100 |
| speaker_count | INTEGER | Number of distinct speakers |
| speaker_names | JSON | User-assigned names: `{"0": "Alice", "1": "Bob"}` |
| status | TEXT | `pending`, `processing`, `completed`, `failed` |
| error_message | TEXT | Error details if failed |
| duration_seconds | INTEGER | Audio duration transcribed |
| is_edited | BOOLEAN | Whether user has made corrections |
| edited_at | TIMESTAMP | Last edit time |
| edited_by_user_id | TEXT FK | Who last edited |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `transcript_words` Table

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | `tw_` prefixed ID |
| transcript_id | TEXT FK | Parent transcript |
| word | TEXT | The word (current, possibly edited) |
| start_ms | INTEGER | Start time in milliseconds |
| end_ms | INTEGER | End time in milliseconds |
| speaker | INTEGER | Speaker index (0, 1, 2...) |
| confidence | INTEGER | 0-100 |
| position | INTEGER | Word order in transcript |
| original_word | TEXT | Original before user edit (null if unedited) |

### Indexes
- `transcripts.file_id` — unique index
- `transcripts.status` — for queue processing
- `transcript_words(transcript_id)` — for loading words
- `transcript_words(transcript_id, start_ms)` — for time-range queries during playback
- `transcript_words(transcript_id, position)` — for ordering

### FTS5 Integration

```sql
CREATE VIRTUAL TABLE transcript_search USING fts5(
  file_id,
  full_text,
  content=transcripts,
  content_rowid=rowid
);
```

---

## 6. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v4/files/:id/transcript` | Get transcript with words |
| POST | `/v4/files/:id/transcript` | Trigger manual re-transcription |
| PUT | `/v4/files/:id/transcript` | Update transcript (edit words, rename speakers) |
| DELETE | `/v4/files/:id/transcript` | Delete transcript |
| GET | `/v4/files/:id/captions` | Export as VTT or SRT (`?format=vtt\|srt`) |
| GET | `/v4/files/:id/transcript/words` | Get words for time range (`?start_ms=&end_ms=`) |

---

## 7. Frontend Components

### Transcript Panel
- Sidebar panel (like Comment Panel) showing scrollable transcript
- Words highlighted as audio/video plays (time-synced)
- Click any word to seek to that timestamp
- Speaker labels with color coding
- Search within transcript (Ctrl+F)
- Edit mode: click word to correct, saves via API

### Caption Viewer
- Captions overlaid on video player (toggle on/off)
- Uses VTT generated from transcript words
- Respects user edits and speaker names

### Transcript Search Results
- Transcript matches appear in global search (Cmd+K)
- Shows matching text with surrounding context
- Click to navigate to file at the matched timestamp

---

## 8. Configuration

```bash
# Provider selection
TRANSCRIPTION_PROVIDER=deepgram  # deepgram | assemblyai | faster-whisper

# Deepgram
DEEPGRAM_API_KEY=

# AssemblyAI (alternative)
ASSEMBLYAI_API_KEY=

# Self-hosted faster-whisper (alternative)
FASTER_WHISPER_URL=http://transcription-vps:8080
FASTER_WHISPER_MODEL=small
FASTER_WHISPER_LANGUAGE=  # empty = auto-detect

# General
TRANSCRIPTION_AUTO_ENABLED=true  # Auto-transcribe on upload
TRANSCRIPTION_MAX_DURATION=7200  # Max file duration in seconds (2 hours)
```

---

## 9. Supported Languages (Deepgram Nova-2)

Bulgarian, Catalan, Chinese (Simplified/Traditional), Czech, Danish, Dutch, English, Estonian, Finnish, Flemish, French, German, Greek, Hindi, Hungarian, Indonesian, Italian, Japanese, Korean, Latvian, Lithuanian, Malay, Norwegian, Polish, Portuguese, Romanian, Russian, Slovak, Spanish, Swedish, Thai, Turkish, Ukrainian, Vietnamese.

36 languages — exceeds the 27-language requirement.

---

## 10. Key Files

| File | Purpose |
|------|---------|
| `src/transcription/types.ts` | Provider interface, result types |
| `src/transcription/index.ts` | Provider factory |
| `src/transcription/providers/deepgram.ts` | Deepgram implementation |
| `src/transcription/providers/assemblyai.ts` | AssemblyAI implementation (swap-in) |
| `src/transcription/providers/faster-whisper.ts` | Self-hosted implementation (swap-in) |
| `src/transcription/processor.ts` | BullMQ job processor |
| `src/transcription/export.ts` | VTT/SRT generation from word data |
| `src/api/routes/transcripts.ts` | API endpoints |
| `src/api/routes/webhooks.ts` | Provider callback endpoint |
| `src/web/components/transcript/` | Transcript panel, search, captions |
