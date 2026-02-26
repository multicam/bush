/**
 * Bush Platform - Transcription Service
 *
 * High-level API for transcription operations.
 * Reference: specs/08-transcription.md
 */

// Types
export * from "./types.js";

// Providers
export { DeepgramProvider, createDeepgramProvider } from "./providers/deepgram.js";
export { FasterWhisperProvider, createFasterWhisperProvider } from "./providers/faster-whisper.js";

// Export
export {
  groupWordsIntoSegments,
  exportToSrt,
  exportToVtt,
  exportToTxt,
  exportTranscription,
  parseSrt,
  parseVtt,
} from "./export.js";

// Processor
export {
  processTranscriptionJob,
  createTranscriptionWorker,
  enqueueTranscriptionJob,
  QUEUE_NAME,
  JOB_TIMEOUT,
  RETRY_CONFIG,
} from "./processor.js";
