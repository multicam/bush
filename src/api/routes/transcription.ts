/**
 * Bush Platform - Transcription Routes
 *
 * API routes for transcription and caption management.
 * Reference: specs/17-api-complete.md Section 6.12
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { transcripts, transcriptWords, files, captions, users } from "../../db/schema.js";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { authMiddleware, requireAuth } from "../auth-middleware.js";
import {
  sendSingle,
  sendNoContent,
  RESOURCE_TYPES,
  formatDates,
} from "../response.js";
import { NotFoundError, ValidationError, AuthorizationError } from "../../errors/index.js";
import { verifyProjectAccess, verifyAccountMembership } from "../access-control.js";
import { enqueueTranscriptionJob } from "../../transcription/index.js";
import { exportTranscription } from "../../transcription/export.js";
import type { CaptionFormat } from "../../transcription/types.js";
import { getStorageProvider } from "../../storage/index.js";
import { randomUUID } from "crypto";

const app = new Hono();

// Apply authentication to all routes
app.use("*", authMiddleware());

/**
 * Check if user has edit access to a project
 * Returns true if user is owner, content_admin, or has edit+ project permission
 */
async function hasEditAccess(_projectId: string, userId: string, accountId: string): Promise<boolean> {
  // First check account role
  const role = await verifyAccountMembership(userId, accountId);
  if (role && (role === "owner" || role === "content_admin")) {
    return true;
  }

  // TODO: Check project-specific permissions when implemented
  // For now, any account member can edit
  return !!role;
}

/**
 * Check if user has view access to a project
 */
async function hasViewAccess(projectId: string, userId: string, accountId: string): Promise<boolean> {
  const access = await verifyProjectAccess(projectId, accountId);
  if (!access) return false;

  const role = await verifyAccountMembership(userId, accountId);
  return !!role;
}

/**
 * Check if user has share access (can export)
 */
async function hasShareAccess(_projectId: string, userId: string, accountId: string): Promise<boolean> {
  const role = await verifyAccountMembership(userId, accountId);
  if (role && (role === "owner" || role === "content_admin")) {
    return true;
  }
  // TODO: Check edit_and_share permission when project permissions are implemented
  return !!role;
}

/**
 * GET /v4/files/:fileId/transcription - Get transcription for a file
 */
app.get("/", async (c) => {
  const session = requireAuth(c);
  const fileId = c.req.param("fileId")!;

  // Get file and verify access
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("file", fileId);
  }

  const canView = await hasViewAccess(file.projectId, session.userId, session.currentAccountId);
  if (!canView) {
    throw new AuthorizationError("View permission required");
  }

  // Get transcription
  const [transcript] = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.fileId, fileId))
    .limit(1);

  if (!transcript) {
    throw new NotFoundError("transcription", fileId);
  }

  // Get editor user if edited
  let editedByUser = null;
  if (transcript.editedByUserId) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, transcript.editedByUserId))
      .limit(1);
    if (user) {
      editedByUser = formatDates(user);
    }
  }

  return sendSingle(c, {
    id: transcript.id,
    type: "transcription",
    attributes: {
      file_id: transcript.fileId,
      status: transcript.status,
      provider: transcript.provider,
      language: transcript.language,
      language_confidence: transcript.languageConfidence,
      full_text: transcript.fullText,
      speaker_count: transcript.speakerCount,
      speaker_names: transcript.speakerNames || {},
      duration_seconds: transcript.durationSeconds,
      is_edited: transcript.isEdited,
      edited_at: transcript.editedAt?.toISOString() || null,
      edited_by_user_id: transcript.editedByUserId,
      edited_by_user: editedByUser,
      error_message: transcript.errorMessage,
      created_at: transcript.createdAt.toISOString(),
      updated_at: transcript.updatedAt.toISOString(),
    },
  }, RESOURCE_TYPES.TRANSCRIPT);
});

/**
 * POST /v4/files/:fileId/transcription - Generate/re-generate transcription
 */
app.post("/", async (c) => {
  const session = requireAuth(c);
  const fileId = c.req.param("fileId")!;
  const body = await c.req.json().catch(() => ({}));

  // Get file and verify access
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("file", fileId);
  }

  const canEdit = await hasEditAccess(file.projectId, session.userId, session.currentAccountId);
  if (!canEdit) {
    throw new AuthorizationError("Edit permission required");
  }

  // Verify file is video or audio
  if (!file.mimeType.startsWith("video/") && !file.mimeType.startsWith("audio/")) {
    throw new ValidationError("Transcription is only available for video and audio files", {
      pointer: "/data/attributes/file_id",
    });
  }

  // Check file status
  if (file.status === "uploading" || file.status === "processing") {
    throw new ValidationError("File is still being processed. Please wait.", {
      pointer: "/data/attributes/file_id",
    });
  }

  // Get duration from technical metadata
  const durationSeconds = file.technicalMetadata?.duration || 0;
  if (!durationSeconds) {
    throw new ValidationError("File duration not available. Please wait for processing to complete.", {
      pointer: "/data/attributes/file_id",
    });
  }

  // Extract options from request
  const language = body.language || "auto";
  const speakerIdentification = body.speaker_identification === true;

  // Build storage key
  const storageKey = `accounts/${session.currentAccountId}/projects/${file.projectId}/assets/${fileId}/original/${file.name}`;

  // Enqueue transcription job
  await enqueueTranscriptionJob({
    fileId,
    accountId: session.currentAccountId,
    projectId: file.projectId,
    storageKey,
    mimeType: file.mimeType,
    durationSeconds,
    language,
    speakerIdentification,
  });

  // Create or update transcript record with pending status
  const [existingTranscript] = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.fileId, fileId))
    .limit(1);

  if (existingTranscript) {
    await db
      .update(transcripts)
      .set({
        status: "pending",
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(transcripts.id, existingTranscript.id));

    return sendSingle(c, {
      id: existingTranscript.id,
      type: "transcription",
      attributes: {
        file_id: fileId,
        status: "pending",
        provider: existingTranscript.provider,
        language: existingTranscript.language,
        language_confidence: existingTranscript.languageConfidence,
        full_text: null,
        speaker_count: null,
        speaker_names: {},
        duration_seconds: null,
        is_edited: false,
        edited_at: null,
        edited_by_user_id: null,
        error_message: null,
        created_at: existingTranscript.createdAt.toISOString(),
        updated_at: new Date().toISOString(),
      },
    }, RESOURCE_TYPES.TRANSCRIPT);
  } else {
    const transcriptId = `tr_${randomUUID().replace(/-/g, "")}`;
    const provider = process.env.TRANSCRIPTION_PROVIDER || "deepgram";

    await db.insert(transcripts).values({
      id: transcriptId,
      fileId,
      provider: provider as "deepgram" | "assemblyai" | "faster-whisper",
      status: "pending",
      speakerNames: {},
      isEdited: false,
    });

    return sendSingle(c, {
      id: transcriptId,
      type: "transcription",
      attributes: {
        file_id: fileId,
        status: "pending",
        provider,
        language: null,
        language_confidence: null,
        full_text: null,
        speaker_count: null,
        speaker_names: {},
        duration_seconds: null,
        is_edited: false,
        edited_at: null,
        edited_by_user_id: null,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }, RESOURCE_TYPES.TRANSCRIPT);
  }
});

/**
 * PUT /v4/files/:fileId/transcription - Update transcription (edit words, rename speakers)
 */
app.put("/", async (c) => {
  const session = requireAuth(c);
  const fileId = c.req.param("fileId")!;
  const body = await c.req.json();

  // Get file and verify access
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("file", fileId);
  }

  const canEdit = await hasEditAccess(file.projectId, session.userId, session.currentAccountId);
  if (!canEdit) {
    throw new AuthorizationError("Edit permission required");
  }

  // Get transcription
  const [transcript] = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.fileId, fileId))
    .limit(1);

  if (!transcript) {
    throw new NotFoundError("transcription", fileId);
  }

  if (transcript.status !== "completed") {
    throw new ValidationError("Cannot edit transcription that is not completed", {
      pointer: "/data/attributes/status",
    });
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
    editedByUserId: session.userId,
    editedAt: new Date(),
  };

  // Update speaker names if provided
  if (body.speaker_names && typeof body.speaker_names === "object") {
    updates.speakerNames = body.speaker_names;
    updates.isEdited = true;
  }

  // Update individual words if provided
  if (body.words && Array.isArray(body.words)) {
    for (const wordUpdate of body.words) {
      if (wordUpdate.id && wordUpdate.word) {
        // Get existing word to preserve original
        const [existingWord] = await db
          .select()
          .from(transcriptWords)
          .where(eq(transcriptWords.id, wordUpdate.id))
          .limit(1);

        if (existingWord && existingWord.word !== wordUpdate.word) {
          await db
            .update(transcriptWords)
            .set({
              word: wordUpdate.word,
              originalWord: existingWord.originalWord || existingWord.word,
            })
            .where(eq(transcriptWords.id, wordUpdate.id));
        }
      }
    }
    updates.isEdited = true;

    // Rebuild full text from words
    const allWords = await db
      .select()
      .from(transcriptWords)
      .where(eq(transcriptWords.transcriptId, transcript.id))
      .orderBy(asc(transcriptWords.position));

    updates.fullText = allWords.map((w) => w.word).join(" ");
  }

  // Update full text directly if provided
  if (body.full_text && typeof body.full_text === "string") {
    updates.fullText = body.full_text;
    updates.isEdited = true;
  }

  await db
    .update(transcripts)
    .set(updates)
    .where(eq(transcripts.id, transcript.id));

  // Get updated transcript
  const [updatedTranscript] = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.id, transcript.id))
    .limit(1);

  return sendSingle(c, {
    id: updatedTranscript!.id,
    type: "transcription",
    attributes: {
      file_id: updatedTranscript!.fileId,
      status: updatedTranscript!.status,
      provider: updatedTranscript!.provider,
      language: updatedTranscript!.language,
      language_confidence: updatedTranscript!.languageConfidence,
      full_text: updatedTranscript!.fullText,
      speaker_count: updatedTranscript!.speakerCount,
      speaker_names: updatedTranscript!.speakerNames || {},
      duration_seconds: updatedTranscript!.durationSeconds,
      is_edited: updatedTranscript!.isEdited,
      edited_at: updatedTranscript!.editedAt?.toISOString() || null,
      edited_by_user_id: updatedTranscript!.editedByUserId,
      error_message: updatedTranscript!.errorMessage,
      created_at: updatedTranscript!.createdAt.toISOString(),
      updated_at: updatedTranscript!.updatedAt.toISOString(),
    },
  }, RESOURCE_TYPES.TRANSCRIPT);
});

/**
 * DELETE /v4/files/:fileId/transcription - Delete transcription
 */
app.delete("/", async (c) => {
  const session = requireAuth(c);
  const fileId = c.req.param("fileId")!;

  // Get file and verify access
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("file", fileId);
  }

  const canEdit = await hasEditAccess(file.projectId, session.userId, session.currentAccountId);
  if (!canEdit) {
    throw new AuthorizationError("Edit permission required");
  }

  // Get transcription
  const [transcript] = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.fileId, fileId))
    .limit(1);

  if (!transcript) {
    throw new NotFoundError("transcription", fileId);
  }

  // Delete words first (cascade should handle this, but be explicit)
  await db
    .delete(transcriptWords)
    .where(eq(transcriptWords.transcriptId, transcript.id));

  // Delete transcript
  await db
    .delete(transcripts)
    .where(eq(transcripts.id, transcript.id));

  return sendNoContent(c);
});

/**
 * GET /v4/files/:fileId/transcription/export - Export transcription as SRT/VTT/TXT
 */
app.get("/export", async (c) => {
  const session = requireAuth(c);
  const fileId = c.req.param("fileId")!;
  const format = (c.req.query("format") || "vtt") as CaptionFormat;

  // Validate format
  if (!["srt", "vtt", "txt"].includes(format)) {
    throw new ValidationError("Format must be one of: srt, vtt, txt", {
      pointer: "/query/format",
    });
  }

  // Get file and verify access
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("file", fileId);
  }

  const canShare = await hasShareAccess(file.projectId, session.userId, session.currentAccountId);
  if (!canShare) {
    throw new AuthorizationError("Edit & Share permission required for export");
  }

  // Get transcription
  const [transcript] = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.fileId, fileId))
    .limit(1);

  if (!transcript || transcript.status !== "completed") {
    throw new NotFoundError("transcription", fileId);
  }

  // Get words
  const words = await db
    .select()
    .from(transcriptWords)
    .where(eq(transcriptWords.transcriptId, transcript.id))
    .orderBy(asc(transcriptWords.position));

  if (words.length === 0) {
    throw new ValidationError("No words found in transcription", {
      pointer: "/data/attributes/words",
    });
  }

  // Export to requested format
  const content = exportTranscription(
    words.map((w) => ({
      word: w.word,
      startMs: w.startMs,
      endMs: w.endMs,
      speaker: w.speaker ?? undefined,
    })),
    format,
    transcript.speakerNames || {}
  );

  // Set appropriate content type
  const contentTypes: Record<CaptionFormat, string> = {
    srt: "application/x-subrip",
    vtt: "text/vtt",
    txt: "text/plain",
  };

  const extensions: Record<CaptionFormat, string> = {
    srt: "srt",
    vtt: "vtt",
    txt: "txt",
  };

  const baseName = file.name.replace(/\.[^.]+$/, "");
  const filename = `${baseName}.${extensions[format]}`;

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": contentTypes[format],
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});

/**
 * GET /v4/files/:fileId/transcription/words - Get words for time range
 */
app.get("/words", async (c) => {
  const session = requireAuth(c);
  const fileId = c.req.param("fileId")!;
  const startMs = c.req.query("start_ms") ? parseInt(c.req.query("start_ms")!, 10) : undefined;
  const endMs = c.req.query("end_ms") ? parseInt(c.req.query("end_ms")!, 10) : undefined;

  // Get file and verify access
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("file", fileId);
  }

  const canView = await hasViewAccess(file.projectId, session.userId, session.currentAccountId);
  if (!canView) {
    throw new AuthorizationError("View permission required");
  }

  // Get transcription
  const [transcript] = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.fileId, fileId))
    .limit(1);

  if (!transcript) {
    throw new NotFoundError("transcription", fileId);
  }

  // Build query conditions
  const conditions = [eq(transcriptWords.transcriptId, transcript.id)];

  if (startMs !== undefined) {
    conditions.push(gte(transcriptWords.endMs, startMs));
  }

  if (endMs !== undefined) {
    conditions.push(lte(transcriptWords.startMs, endMs));
  }

  // Get words
  const words = await db
    .select()
    .from(transcriptWords)
    .where(and(...conditions))
    .orderBy(asc(transcriptWords.position));

  return c.json({
    data: words.map((w) => ({
      id: w.id,
      type: "transcript_word",
      attributes: {
        word: w.word,
        start_ms: w.startMs,
        end_ms: w.endMs,
        speaker: w.speaker,
        confidence: w.confidence,
        position: w.position,
        original_word: w.originalWord,
      },
    })),
  });
});

// ============================================================
// Captions Routes
// ============================================================

const captionsApp = new Hono();
captionsApp.use("*", authMiddleware());

/**
 * GET /v4/files/:fileId/captions - List caption tracks
 */
captionsApp.get("/", async (c) => {
  const session = requireAuth(c);
  const fileId = c.req.param("fileId")!;

  // Get file and verify access
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("file", fileId);
  }

  const canView = await hasViewAccess(file.projectId, session.userId, session.currentAccountId);
  if (!canView) {
    throw new AuthorizationError("View permission required");
  }

  // Get captions
  const captionList = await db
    .select()
    .from(captions)
    .where(eq(captions.fileId, fileId))
    .orderBy(asc(captions.createdAt));

  return c.json({
    data: captionList.map((caption) => ({
      id: caption.id,
      type: "caption",
      attributes: {
        file_id: caption.fileId,
        language: caption.language,
        format: caption.format,
        label: caption.label,
        is_default: caption.isDefault,
        created_at: caption.createdAt.toISOString(),
      },
    })),
  });
});

/**
 * POST /v4/files/:fileId/captions - Upload caption file
 */
captionsApp.post("/", async (c) => {
  const session = requireAuth(c);
  const fileId = c.req.param("fileId")!;

  // Get file and verify access
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("file", fileId);
  }

  const canEdit = await hasEditAccess(file.projectId, session.userId, session.currentAccountId);
  if (!canEdit) {
    throw new AuthorizationError("Edit permission required");
  }

  // Parse multipart form
  const requestContentType = c.req.header("Content-Type") || "";
  if (!requestContentType.includes("multipart/form-data")) {
    throw new ValidationError("Multipart form data required", {
      pointer: "/header/Content-Type",
    });
  }

  const formData = await c.req.formData();
  const captionFile = formData.get("file") as File | null;
  const language = formData.get("language") as string | null;
  const label = formData.get("label") as string | null;
  const format = formData.get("format") as "srt" | "vtt" | null;

  if (!captionFile) {
    throw new ValidationError("Caption file is required", {
      pointer: "/form/file",
    });
  }

  if (!language) {
    throw new ValidationError("Language is required", {
      pointer: "/form/language",
    });
  }

  // Determine format from file extension or parameter
  const detectedFormat = format || (captionFile.name.endsWith(".vtt") ? "vtt" : "srt");
  if (!["srt", "vtt"].includes(detectedFormat)) {
    throw new ValidationError("Format must be srt or vtt", {
      pointer: "/form/format",
    });
  }

  // Upload to storage
  const storage = getStorageProvider();
  const captionId = `cap_${randomUUID().replace(/-/g, "")}`;
  const storageKey = `accounts/${session.currentAccountId}/projects/${file.projectId}/captions/${captionId}.${detectedFormat}`;

  const fileBuffer = Buffer.from(await captionFile.arrayBuffer());
  const contentType = detectedFormat === "vtt" ? "text/vtt" : "application/x-subrip";
  await storage.putObject(storageKey, fileBuffer, contentType);

  // Create caption record
  await db.insert(captions).values({
    id: captionId,
    fileId,
    language,
    format: detectedFormat,
    storageKey,
    label: label || language,
    isDefault: false,
    createdByUserId: session.userId,
  });

  return sendSingle(c, {
    id: captionId,
    type: "caption",
    attributes: {
      file_id: fileId,
      language,
      format: detectedFormat,
      label: label || language,
      is_default: false,
      created_at: new Date().toISOString(),
    },
  }, RESOURCE_TYPES.CAPTION);
});

/**
 * DELETE /v4/files/:fileId/captions/:captionId - Delete caption track
 */
captionsApp.delete("/:captionId", async (c) => {
  const session = requireAuth(c);
  const fileId = c.req.param("fileId")!;
  const captionId = c.req.param("captionId")!;

  // Get file and verify access
  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw new NotFoundError("file", fileId);
  }

  const access = await verifyProjectAccess(file.projectId, session.currentAccountId);
  if (!access) {
    throw new NotFoundError("file", fileId);
  }

  const canEdit = await hasEditAccess(file.projectId, session.userId, session.currentAccountId);
  if (!canEdit) {
    throw new AuthorizationError("Edit permission required");
  }

  // Get caption
  const [caption] = await db
    .select()
    .from(captions)
    .where(and(eq(captions.id, captionId), eq(captions.fileId, fileId)))
    .limit(1);

  if (!caption) {
    throw new NotFoundError("caption", captionId);
  }

  // Delete from storage
  const storage = getStorageProvider();
  await storage.deleteObject(caption.storageKey).catch(() => {});

  // Delete from database
  await db.delete(captions).where(eq(captions.id, captionId));

  return sendNoContent(c);
});

export default app;
export { captionsApp };
