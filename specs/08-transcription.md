# Bush - Transcription

## Overview

Bush provides AI-powered transcription for video and audio assets. Transcription runs as an async BullMQ job (`media:transcription`) after upload completes. All providers implement the `TranscriptionProvider` interface, so the active vendor is a configuration choice — not a code change. Results are stored at the word level with millisecond timestamps, enabling time-synced playback highlighting, click-to-seek navigation, and caption export. The full transcript text is indexed in SQLite FTS5 and integrated with the global search experience.

---

## Specification

### 1. Provider Interface [Phase 1]

All transcription providers implement:

```typescript
interface TranscriptionProvider {
  readonly name: string;

  /** Submit audio for transcription. Returns a provider-specific request ID. */
  submit(request: TranscriptionRequest): Promise<string>;

  /** Poll for results. Returns null if still processing. */
  getResult(requestId: string): Promise<TranscriptionResult | null>;

  /** Parse a webhook callback payload into a result. */
  parseCallback(payload: unknown): TranscriptionResult;

  /** Determine whether a webhook payload represents a successful completion. */
  isCallbackSuccess(payload: unknown): boolean;
}

interface TranscriptionRequest {
  audioUrl: string;        // Pre-signed URL to a 16kHz mono WAV file
  language?: string;       // ISO 639-1 hint, or empty for auto-detect
  enableDiarization: boolean;
}

interface TranscriptionResult {
  providerTranscriptId: string;
  fullText: string;
  language: string;
  languageConfidence: number; // 0-100
  speakerCount: number;
  words: TranscriptionWord[];
}

interface TranscriptionWord {
  word: string;
  startMs: number;
  endMs: number;
  speaker: number;    // Speaker index (0-based). 0 when diarization is off.
  confidence: number; // 0-100
}
```

The active provider is selected via the `TRANSCRIPTION_PROVIDER` environment variable. No application code outside the provider factory (`src/transcription/index.ts`) references a specific vendor.

---

### 2. Provider Options [Phase 1]

#### Provider Comparison

| Provider | Cost/hr | Languages | Diarization | WER (English) | Free Tier |
|----------|---------|-----------|-------------|---------------|-----------|
| Deepgram Nova-2 | $0.47 | 36 | Yes | ~5–8% | $200 credits |
| AssemblyAI | $0.17 | 99 | Yes | ~5–8% | $50 credits |
| faster-whisper (self-hosted) | EUR 0–3.29/mo VPS | 100+ | No | ~10–12% | Open source |
| OpenAI Whisper API | $0.36 | 57 | No | ~9–10% | None |

#### Provider Selection by Environment

| Environment | Provider | Model | Rationale |
|-------------|----------|-------|-----------|
| Dev (GPU available) | faster-whisper | large-v3-turbo | Free, < 1 min/hr, Deepgram-level accuracy on RTX 3090 |
| Prod (MVP) | Deepgram Nova-2 | nova-2 | $200 free credits cover bootstrap; best quality + diarization |
| Prod (post-credits) | Evaluate | — | Deepgram ($23/mo at 50 hrs), AssemblyAI ($8.50/mo), or self-hosted |

#### faster-whisper Self-Hosted (Dev)

```bash
# GPU setup (bare metal, no Docker)
uv venv ~/.venvs/whisper-server
source ~/.venvs/whisper-server/bin/activate
uv pip install faster-whisper-server

# Run on GPU
faster-whisper-server --model large-v3-turbo --device cuda --port 8080
```

Model options for self-hosted:

| Model | VRAM | Speed (1hr audio) | WER |
|-------|------|-------------------|-----|
| large-v3-turbo | ~3–4 GB | < 1 min | ~5–8% |
| large-v3 | ~10 GB | ~2–3 min | ~5–6% |
| medium | ~5 GB | ~1–2 min | ~7–9% |
| small INT8 | ~2 GB | < 1 min | ~10–12% |

CPU-only self-hosted (production fallback, no GPU):

| Setup | Speed (1hr audio) | Cost |
|-------|-------------------|------|
| Main VPS, 2 threads, shared | ~60–90 min | EUR 0 |
| Dedicated CX22, 2 vCPU | ~40–60 min | EUR 3.29/mo |
| Dedicated CX32, 4 vCPU | ~25–40 min | EUR 7.11/mo |

Self-hosted limitations on CPU: large-v3 model requires 10–15 GB RAM and is impractically slow; diarization via pyannote is GPU-only.

---

### 3. Features [Phase 1]

#### 3.1 Automatic Transcription [Phase 1]

- Triggered automatically after video or audio upload completes processing (after `media:metadata` job).
- BullMQ `media:transcription` queue — same infrastructure as thumbnail and proxy jobs.
- Audio extracted from video via FFmpeg to 16kHz mono WAV before submitting to provider.
- Language auto-detected unless user specifies a hint.
- 36+ languages supported (36 via Deepgram, 100+ via faster-whisper/AssemblyAI).

#### 3.2 Word-Level Timestamps [Phase 1]

- Every word stored with `start_ms` and `end_ms` in milliseconds.
- Enables time-synced highlighting during playback.
- Click any word in the transcript panel to seek to that position.
- Supports search-within-transcript with jump-to-timestamp.

#### 3.3 Speaker Diarization (Phase 2)

- Identifies distinct speakers; assigns generic labels (Speaker 1, Speaker 2, ...).
- Users rename speakers after the fact; names stored in `speaker_names` JSON field.
- Speaker changes reflected in transcript display and caption export.
- MVP ships without diarization. Added in Phase 2 via cloud API (Deepgram or AssemblyAI).

#### 3.4 Editable Transcripts [Phase 1]

- Users correct transcription errors inline.
- Original word preserved in `original_word` column for audit trail.
- Edits tracked with `edited_at` and `edited_by_user_id`.
- Edited transcript drives search index updates and caption export.

#### 3.5 Caption Export [Phase 1]

- Generate WebVTT (`.vtt`) and SRT (`.srt`) from stored word data.
- Words grouped into ~7-word segments, respecting speaker boundaries.
- Speaker names included: VTT `<v>` tags, SRT `[]` prefix.
- API endpoint: `GET /v4/files/:id/captions?format=vtt|srt`

#### 3.6 HLS Caption Tracks [Phase 1]

- After transcription completes, `processWebVTT` generates a `.vtt` file stored at `{account}/{project}/{asset}/captions/en.vtt`.
- The HLS master playlist (`master.m3u8`) includes the caption as a subtitle track via `#EXT-X-MEDIA:TYPE=SUBTITLES`.
- hls.js exposes subtitle tracks via `hls.subtitleTracks`, wired to the player's caption toggle button.
- If transcription completes after HLS generation, only the master playlist is regenerated (not segments).
- Implementation: `src/media/processors/webvtt.ts`

#### 3.7 Transcript Search [Phase 1]

- Full transcript text indexed in SQLite FTS5.
- Search results link to the file with timestamp.
- Integrated with global search (Cmd+K).
- Matched terms highlighted in the transcript panel.

---

### 4. Processing Pipeline [Phase 1]

#### Job Flow

```
File uploaded
  → media:metadata  (extracts duration)
  → media:transcription  (queued after metadata completes)
      → FFmpeg extracts audio (mono, 16kHz WAV)
      → Audio submitted to provider (pre-signed URL)
      → Provider returns word-level JSON (webhook callback or polling)
      → Words stored in transcript_words table
      → Full text stored in transcripts table
      → FTS5 search index updated
      → File transcript status updated to 'completed'
```

#### Queue Configuration

```typescript
const TRANSCRIPTION_QUEUE = "media:transcription";

const jobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 60_000 },
  timeout: 1_800_000,  // 30 minutes max
  removeOnComplete: true,
};
```

---

### 5. Database Schema [Phase 1]

#### `transcripts` Table

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | `tr_` prefixed ID |
| file_id | TEXT FK UNIQUE | One transcript per file |
| provider | TEXT | `deepgram`, `assemblyai`, `faster-whisper` |
| provider_transcript_id | TEXT | External reference ID |
| full_text | TEXT | Complete transcript for search and display |
| language | TEXT | Detected language (ISO 639-1) |
| language_confidence | INTEGER | 0–100 |
| speaker_count | INTEGER | Number of distinct speakers |
| speaker_names | JSON | `{"0": "Alice", "1": "Bob"}` |
| status | TEXT | `pending`, `processing`, `completed`, `failed` |
| error_message | TEXT | Error details if failed |
| duration_seconds | INTEGER | Audio duration transcribed |
| is_edited | BOOLEAN | Whether user has made corrections |
| edited_at | TIMESTAMP | Last edit time |
| edited_by_user_id | TEXT FK | Who last edited |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### `transcript_words` Table

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | `tw_` prefixed ID |
| transcript_id | TEXT FK | Parent transcript |
| word | TEXT | Current word (may be user-edited) |
| start_ms | INTEGER | Start time in milliseconds |
| end_ms | INTEGER | End time in milliseconds |
| speaker | INTEGER | Speaker index (0-based) |
| confidence | INTEGER | 0–100 |
| position | INTEGER | Word order within transcript |
| original_word | TEXT | Original before user edit (null if unedited) |

#### Indexes

```sql
CREATE UNIQUE INDEX transcripts_file_id ON transcripts(file_id);
CREATE INDEX transcripts_status ON transcripts(status);
CREATE INDEX tw_transcript_id ON transcript_words(transcript_id);
CREATE INDEX tw_transcript_time ON transcript_words(transcript_id, start_ms);
CREATE INDEX tw_transcript_pos ON transcript_words(transcript_id, position);
```

#### FTS5 Integration

```sql
CREATE VIRTUAL TABLE transcript_search USING fts5(
  file_id,
  full_text,
  content=transcripts,
  content_rowid=rowid
);
```

Triggers on `transcripts.full_text` update the FTS5 index and cascade to the global search.

---

### 6. API Endpoints [Phase 1]

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v4/files/:id/transcript` | Retrieve transcript with all words |
| POST | `/v4/files/:id/transcript` | Trigger manual re-transcription |
| PUT | `/v4/files/:id/transcript` | Update transcript (edit words, rename speakers) |
| DELETE | `/v4/files/:id/transcript` | Delete transcript and all word records |
| GET | `/v4/files/:id/captions` | Export as VTT or SRT (`?format=vtt\|srt`) |
| GET | `/v4/files/:id/transcript/words` | Fetch words for a time range (`?start_ms=&end_ms=`) |

The path segment is `/transcript` (not `/transcription`). This is the authoritative path.

---

### 7. Frontend Components [Phase 1]

#### Transcript Panel

- Sidebar panel (mirrors the Comment Panel layout) with a scrollable word-level transcript.
- Words highlighted in sync with playback position.
- Click any word to seek to that timestamp.
- Speaker labels with per-speaker color coding.
- Search within transcript (Ctrl+F / Cmd+F).
- Edit mode: click a word to correct it; saved via `PUT /v4/files/:id/transcript`.

#### Caption Viewer

- Captions overlaid on the video player, toggleable.
- Uses VTT generated from stored word data via the captions endpoint.
- Respects user edits and speaker names.

#### Transcript Search Results

- Transcript matches surface in global search (Cmd+K).
- Displays matching text with surrounding context.
- Clicking a result navigates to the file and seeks to the matched timestamp.

---

### 8. Supported Languages [Phase 1]

Deepgram Nova-2 (36 languages — exceeds the 27-language requirement):

Bulgarian, Catalan, Chinese (Simplified), Chinese (Traditional), Czech, Danish, Dutch, English, Estonian, Finnish, Flemish, French, German, Greek, Hindi, Hungarian, Indonesian, Italian, Japanese, Korean, Latvian, Lithuanian, Malay, Norwegian, Polish, Portuguese, Romanian, Russian, Slovak, Spanish, Swedish, Thai, Turkish, Ukrainian, Vietnamese.

faster-whisper and AssemblyAI support 100+ languages.

---

### 9. Key Source Files [Phase 1]

| File | Purpose |
|------|---------|
| `src/transcription/types.ts` | Provider interface and result types |
| `src/transcription/index.ts` | Provider factory |
| `src/transcription/providers/deepgram.ts` | Deepgram Nova-2 implementation |
| `src/transcription/providers/assemblyai.ts` | AssemblyAI implementation |
| `src/transcription/providers/faster-whisper.ts` | Self-hosted faster-whisper implementation |
| `src/transcription/processor.ts` | BullMQ job processor |
| `src/transcription/export.ts` | VTT and SRT generation from word data |
| `src/media/processors/webvtt.ts` | WebVTT generation for HLS caption tracks |
| `src/api/routes/transcripts.ts` | API route handlers |
| `src/api/routes/webhooks.ts` | Provider webhook callback endpoint |
| `src/web/components/transcript/` | Transcript panel, caption viewer, search results |

---

## Cross-references

- `07-media-processing.md` — job queue infrastructure, audio extraction step, dependency chain
- `06-storage.md` — storage keys for audio extraction temp files; transcript JSON storage
- `04-api-reference.md` — transcription API endpoints, caption export, webhook registration
- `01-data-model.md` — transcript and transcript_words entity schemas
- `30-configuration.md` — API keys (DEEPGRAM_API_KEY, ASSEMBLYAI_API_KEY), TRANSCRIPTION_PROVIDER, FASTER_WHISPER_URL, TRANSCRIPTION_MAX_DURATION
