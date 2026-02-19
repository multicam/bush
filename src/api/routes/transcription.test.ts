/**
 * Bush Platform - Transcription Routes Tests
 *
 * Comprehensive unit tests for transcription and captions API routes.
 */

// Mock all dependencies BEFORE any imports (vitest hoists vi.mock calls)
vi.mock("../../db/index.js", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../auth-middleware.js", () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
  requireAuth: vi.fn(),
}));

vi.mock("../access-control.js", () => ({
  verifyProjectAccess: vi.fn(),
  verifyAccountMembership: vi.fn(),
}));

vi.mock("../../db/schema.js", () => ({
  transcripts: {
    id: "id",
    fileId: "fileId",
    status: "status",
    provider: "provider",
    language: "language",
    languageConfidence: "languageConfidence",
    fullText: "fullText",
    speakerCount: "speakerCount",
    speakerNames: "speakerNames",
    durationSeconds: "durationSeconds",
    isEdited: "isEdited",
    editedAt: "editedAt",
    editedByUserId: "editedByUserId",
    errorMessage: "errorMessage",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  transcriptWords: {
    id: "id",
    transcriptId: "transcriptId",
    word: "word",
    originalWord: "originalWord",
    startMs: "startMs",
    endMs: "endMs",
    speaker: "speaker",
    confidence: "confidence",
    position: "position",
  },
  files: {
    id: "id",
    name: "name",
    projectId: "projectId",
    mimeType: "mimeType",
    status: "status",
    technicalMetadata: "technicalMetadata",
  },
  captions: {
    id: "id",
    fileId: "fileId",
    language: "language",
    format: "format",
    storageKey: "storageKey",
    label: "label",
    isDefault: "isDefault",
    createdByUserId: "createdByUserId",
    createdAt: "createdAt",
  },
  users: {
    id: "id",
    email: "email",
    name: "name",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, val) => ({ type: "eq", field, val })),
  and: vi.fn((...args) => ({ type: "and", args })),
  desc: vi.fn((field) => ({ type: "desc", field })),
  lt: vi.fn((field, val) => ({ type: "lt", field, val })),
  sql: vi.fn((strings, ...values) => ({ type: "sql", strings, values })),
  isNull: vi.fn((field) => ({ type: "isNull", field })),
  asc: vi.fn((field) => ({ type: "asc", field })),
  gte: vi.fn((field, val) => ({ type: "gte", field, val })),
  lte: vi.fn((field, val) => ({ type: "lte", field, val })),
}));

vi.mock("../response.js", () => ({
  sendSingle: vi.fn((c, data, _type) =>
    c.json({ data: { id: data.id, type: _type, attributes: data } })
  ),
  sendNoContent: vi.fn((c) => c.body(null, 204)),
  RESOURCE_TYPES: {
    TRANSCRIPT: "transcript",
    CAPTION: "caption",
  },
  formatDates: vi.fn((obj: Record<string, unknown>) => {
    const result: Record<string, unknown> = { ...obj };
    for (const key of Object.keys(result)) {
      if (result[key] instanceof Date) {
        result[key] = (result[key] as Date).toISOString();
      }
    }
    return result;
  }),
}));

vi.mock("../../transcription/index.js", () => ({
  enqueueTranscriptionJob: vi.fn(),
}));

vi.mock("../../transcription/export.js", () => ({
  exportTranscription: vi.fn(),
}));

vi.mock("../../storage/index.js", () => ({
  getStorageProvider: vi.fn(),
}));

vi.mock("crypto", () => ({
  randomUUID: vi.fn().mockReturnValue("aaaabbbb-cccc-dddd-eeee-ffffffffffff"),
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import app, { captionsApp } from "./transcription.js";
import { db } from "../../db/index.js";
import { requireAuth } from "../auth-middleware.js";
import { verifyProjectAccess, verifyAccountMembership } from "../access-control.js";
import { enqueueTranscriptionJob } from "../../transcription/index.js";
import { exportTranscription } from "../../transcription/export.js";
import { getStorageProvider } from "../../storage/index.js";
import { randomUUID } from "crypto";
import { sendSingle, sendNoContent, formatDates } from "../response.js";

// ---------------------------------------------------------------------------
// Wrapper apps - mount sub-apps under parent with :fileId param so
// c.req.param("fileId") works correctly in route handlers.
// ---------------------------------------------------------------------------
const transcriptionTestApp = new Hono();
transcriptionTestApp.route("/files/:fileId/transcription", app);

const captionsTestApp = new Hono();
captionsTestApp.route("/files/:fileId/captions", captionsApp);

// Helper to make transcription requests (the sub-app has routes at /, /export, /words)
const transcriptionReq = (path: string, init?: RequestInit) => {
  const suffix = path === "/" ? "" : path;
  return transcriptionTestApp.request(`/files/file_001/transcription${suffix}`, init);
};

const captionsReq = (path: string, init?: RequestInit) => {
  const suffix = path === "/" ? "" : path;
  return captionsTestApp.request(`/files/file_001/captions${suffix}`, init);
};

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const SESSION = {
  userId: "usr_abc",
  currentAccountId: "acc_xyz",
  accountRole: "owner",
  sessionId: "ses_111",
};

const FILE_ROW = {
  id: "file_001",
  name: "interview.mp4",
  projectId: "proj_001",
  mimeType: "video/mp4",
  status: "ready",
  technicalMetadata: { duration: 120 },
};

const TRANSCRIPT_ROW = {
  id: "tr_001",
  fileId: "file_001",
  status: "completed",
  provider: "deepgram",
  language: "en",
  languageConfidence: 0.99,
  fullText: "Hello world this is a test",
  speakerCount: 2,
  speakerNames: { "0": "Alice", "1": "Bob" },
  durationSeconds: 120,
  isEdited: false,
  editedAt: null,
  editedByUserId: null,
  errorMessage: null,
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
};

const WORDS_ROWS = [
  {
    id: "tw_001",
    transcriptId: "tr_001",
    word: "Hello",
    originalWord: null,
    startMs: 0,
    endMs: 500,
    speaker: "0",
    confidence: 0.99,
    position: 0,
  },
  {
    id: "tw_002",
    transcriptId: "tr_001",
    word: "world",
    originalWord: null,
    startMs: 600,
    endMs: 1000,
    speaker: "0",
    confidence: 0.95,
    position: 1,
  },
];

const CAPTION_ROW = {
  id: "cap_001",
  fileId: "file_001",
  language: "en",
  format: "vtt",
  storageKey: "accounts/acc_xyz/projects/proj_001/captions/cap_001.vtt",
  label: "English",
  isDefault: false,
  createdByUserId: "usr_abc",
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// DB mock helpers
// ---------------------------------------------------------------------------

/**
 * Build a fluent select chain that resolves to `rows` at the terminal step.
 * The terminal is the last .limit() call or a plain .where() call.
 */
function makeSelectChain(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: vi.fn().mockResolvedValue(rows),
        orderBy: () => ({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
      orderBy: () => ({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never;
}

/**
 * Build a select chain where where() ends in orderBy() (no limit)
 */
function makeSelectChainOrderBy(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never;
}

/**
 * Mock db.select for multiple sequential calls, each returning different rows.
 */
function mockSelectSequence(...rowSets: unknown[][]) {
  let callCount = 0;
  vi.mocked(db.select).mockImplementation(() => {
    const rows = rowSets[callCount] ?? [];
    callCount++;
    return makeSelectChain(rows);
  });
}

/**
 * Mock db.select for multiple sequential calls where some use orderBy at end.
 */
function mockSelectSequenceWithOrderBy(calls: Array<{ rows: unknown[]; endsWithOrderBy?: boolean }>) {
  let callCount = 0;
  vi.mocked(db.select).mockImplementation(() => {
    const call = calls[callCount] ?? { rows: [] };
    callCount++;
    if (call.endsWithOrderBy) {
      return makeSelectChainOrderBy(call.rows);
    }
    return makeSelectChain(call.rows);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Transcription Routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Re-set default mock implementations after resetAllMocks
    vi.mocked(requireAuth).mockReturnValue(SESSION as never);
    vi.mocked(randomUUID).mockReturnValue("aaaabbbb-cccc-dddd-eeee-ffffffffffff" as never);
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);
    vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);
    vi.mocked(enqueueTranscriptionJob).mockResolvedValue(undefined as never);
    vi.mocked(exportTranscription).mockReturnValue("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello world");

    // Re-set response mocks (vi.resetAllMocks wipes implementations from vi.mock())
    vi.mocked(sendSingle).mockImplementation((c, data, type) =>
      (c as { json: (v: unknown) => unknown }).json({
        data: { id: (data as Record<string, unknown>).id, type, attributes: data },
      }) as any
    );
    vi.mocked(sendNoContent).mockImplementation((c) =>
      (c as { body: (b: null, s: number) => unknown }).body(null, 204) as any
    );
    vi.mocked(formatDates).mockImplementation((obj) => {
      const result: Record<string, unknown> = { ...(obj as object) };
      for (const key of Object.keys(result)) {
        if (result[key] instanceof Date) {
          result[key] = (result[key] as Date).toISOString();
        }
      }
      return result;
    });
  });

  // =========================================================================
  // GET / - Get transcription for a file
  // =========================================================================
  describe("GET / - get transcription for a file", () => {
    it("returns 200 with transcription data on success", async () => {
      mockSelectSequence([FILE_ROW], [TRANSCRIPT_ROW]);

      const res = await transcriptionReq("/", {
        method: "GET",
        headers: { "x-file-id": "file_001" },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;

      expect(body).toHaveProperty("data");
      expect(body.data.id).toBe("tr_001");
      expect(body.data.type).toBe("transcript");
      expect(body.data.attributes.attributes.status).toBe("completed");
      expect(body.data.attributes.attributes.file_id).toBe("file_001");
      expect(body.data.attributes.attributes.full_text).toBe("Hello world this is a test");
    });

    it("returns speaker_names as empty object when null", async () => {
      const transcriptNoSpeakers = { ...TRANSCRIPT_ROW, speakerNames: null };
      mockSelectSequence([FILE_ROW], [transcriptNoSpeakers]);

      const res = await transcriptionReq("/", { method: "GET" });
      const body = (await res.json()) as any;

      expect(body.data.attributes.attributes.speaker_names).toEqual({});
    });

    it("includes edited_by_user when editedByUserId is set", async () => {
      const USER_ROW = {
        id: "usr_abc",
        email: "alice@example.com",
        name: "Alice",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      };
      const editedTranscript = {
        ...TRANSCRIPT_ROW,
        editedByUserId: "usr_abc",
        editedAt: new Date("2024-01-20T10:00:00.000Z"),
        isEdited: true,
      };
      mockSelectSequence([FILE_ROW], [editedTranscript], [USER_ROW]);

      const res = await transcriptionReq("/", { method: "GET" });
      const body = (await res.json()) as any;

      expect(body.data.attributes.attributes.edited_by_user_id).toBe("usr_abc");
      expect(body.data.attributes.attributes.edited_by_user).not.toBeNull();
    });

    it("returns null for edited_by_user when editedByUserId is not set", async () => {
      mockSelectSequence([FILE_ROW], [TRANSCRIPT_ROW]);

      const res = await transcriptionReq("/", { method: "GET" });
      const body = (await res.json()) as any;

      expect(body.data.attributes.attributes.edited_by_user).toBeNull();
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSequence([]);

      const res = await transcriptionReq("/", { method: "GET" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);
      mockSelectSequence([FILE_ROW]);

      const res = await transcriptionReq("/", { method: "GET" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no account membership (no view access)", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);
      mockSelectSequence([FILE_ROW]);

      const res = await transcriptionReq("/", { method: "GET" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when transcription is not found", async () => {
      mockSelectSequence([FILE_ROW], []);

      const res = await transcriptionReq("/", { method: "GET" });
      expect(res.status).toBe(500);
    });

    it("calls requireAuth on each request", async () => {
      mockSelectSequence([FILE_ROW], [TRANSCRIPT_ROW]);

      await transcriptionReq("/", { method: "GET" });
      expect(vi.mocked(requireAuth)).toHaveBeenCalledTimes(1);
    });

    it("includes created_at and updated_at as ISO strings", async () => {
      mockSelectSequence([FILE_ROW], [TRANSCRIPT_ROW]);

      const res = await transcriptionReq("/", { method: "GET" });
      const body = (await res.json()) as any;

      expect(body.data.attributes.attributes.created_at).toBe("2024-01-15T10:00:00.000Z");
      expect(body.data.attributes.attributes.updated_at).toBe("2024-01-15T10:00:00.000Z");
    });
  });

  // =========================================================================
  // POST / - Generate/re-generate transcription
  // =========================================================================
  describe("POST / - generate transcription", () => {
    beforeEach(() => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);
      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);
    });

    it("returns 200 with pending transcription when no existing transcript", async () => {
      mockSelectSequence([FILE_ROW], []); // file found, no existing transcript

      const res = await transcriptionReq("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;

      expect(body.data.type).toBe("transcript");
      expect(body.data.attributes.attributes.status).toBe("pending");
      expect(body.data.attributes.attributes.file_id).toBe("file_001");
    });

    it("inserts new transcript record when none exists", async () => {
      mockSelectSequence([FILE_ROW], []);

      await transcriptionReq("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);
    });

    it("generates transcript ID using randomUUID", async () => {
      mockSelectSequence([FILE_ROW], []);

      const res = await transcriptionReq("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as any;

      expect(body.data.id).toMatch(/^tr_/);
    });

    it("updates existing transcript to pending when one already exists", async () => {
      mockSelectSequence([FILE_ROW], [TRANSCRIPT_ROW]);

      const res = await transcriptionReq("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
      const body = (await res.json()) as any;
      expect(body.data.attributes.attributes.status).toBe("pending");
    });

    it("calls enqueueTranscriptionJob with correct parameters", async () => {
      mockSelectSequence([FILE_ROW], []);

      await transcriptionReq("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "fr", speaker_identification: true }),
      });

      expect(vi.mocked(enqueueTranscriptionJob)).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: "file_001",
          accountId: "acc_xyz",
          projectId: "proj_001",
          mimeType: "video/mp4",
          durationSeconds: 120,
          language: "fr",
          speakerIdentification: true,
        })
      );
    });

    it("defaults language to 'auto' when not provided", async () => {
      mockSelectSequence([FILE_ROW], []);

      await transcriptionReq("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(vi.mocked(enqueueTranscriptionJob)).toHaveBeenCalledWith(
        expect.objectContaining({ language: "auto", speakerIdentification: false })
      );
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSequence([]);

      const res = await transcriptionReq("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);
      mockSelectSequence([FILE_ROW]);

      const res = await transcriptionReq("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no edit access", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);
      mockSelectSequence([FILE_ROW]);

      const res = await transcriptionReq("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not audio or video", async () => {
      const imageFile = { ...FILE_ROW, mimeType: "image/jpeg" };
      mockSelectSequence([imageFile]);

      const res = await transcriptionReq("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is still uploading", async () => {
      const uploadingFile = { ...FILE_ROW, status: "uploading" };
      mockSelectSequence([uploadingFile]);

      const res = await transcriptionReq("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is still processing", async () => {
      const processingFile = { ...FILE_ROW, status: "processing" };
      mockSelectSequence([processingFile]);

      const res = await transcriptionReq("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file has no duration in technical metadata", async () => {
      const noDurationFile = { ...FILE_ROW, technicalMetadata: {} };
      mockSelectSequence([noDurationFile]);

      const res = await transcriptionReq("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("accepts audio files for transcription", async () => {
      const audioFile = { ...FILE_ROW, mimeType: "audio/mp3" };
      mockSelectSequence([audioFile], []);

      const res = await transcriptionReq("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
    });

    it("builds correct storage key", async () => {
      mockSelectSequence([FILE_ROW], []);

      await transcriptionReq("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(vi.mocked(enqueueTranscriptionJob)).toHaveBeenCalledWith(
        expect.objectContaining({
          storageKey: "accounts/acc_xyz/projects/proj_001/assets/file_001/original/interview.mp4",
        })
      );
    });
  });

  // =========================================================================
  // PUT / - Update transcription
  // =========================================================================
  describe("PUT / - update transcription", () => {
    beforeEach(() => {
      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);
    });

    it("returns 200 with updated transcription on success", async () => {
      const updatedTranscript = { ...TRANSCRIPT_ROW, speakerNames: { "0": "Charlie" }, isEdited: true };
      mockSelectSequence([FILE_ROW], [TRANSCRIPT_ROW], [updatedTranscript]);

      const res = await transcriptionReq("/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker_names: { "0": "Charlie" } }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.type).toBe("transcript");
    });

    it("updates speaker_names when provided", async () => {
      const updatedTranscript = { ...TRANSCRIPT_ROW, speakerNames: { "0": "Charlie" }, isEdited: true };
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);
      mockSelectSequence([FILE_ROW], [TRANSCRIPT_ROW], [updatedTranscript]);

      await transcriptionReq("/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker_names: { "0": "Charlie" } }),
      });

      expect(setCalled).toHaveBeenCalledWith(
        expect.objectContaining({ speakerNames: { "0": "Charlie" }, isEdited: true })
      );
    });

    it("updates full_text directly when provided", async () => {
      const updatedTranscript = { ...TRANSCRIPT_ROW, fullText: "New full text", isEdited: true };
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);
      mockSelectSequence([FILE_ROW], [TRANSCRIPT_ROW], [updatedTranscript]);

      await transcriptionReq("/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_text: "New full text" }),
      });

      expect(setCalled).toHaveBeenCalledWith(
        expect.objectContaining({ fullText: "New full text", isEdited: true })
      );
    });

    it("updates individual words when words array is provided", async () => {
      const existingWord = { id: "tw_001", word: "Hello", originalWord: null, transcriptId: "tr_001" };
      const updatedTranscript = { ...TRANSCRIPT_ROW, isEdited: true };

      // File, transcript, existing word, all words for fullText rebuild, updated transcript
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSelectChain([FILE_ROW]);
        if (callCount === 2) return makeSelectChain([TRANSCRIPT_ROW]);
        if (callCount === 3) return makeSelectChain([existingWord]); // get existing word
        if (callCount === 4) return makeSelectChainOrderBy([...WORDS_ROWS]); // all words for fullText
        return makeSelectChain([updatedTranscript]); // final refetch
      });

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      const res = await transcriptionReq("/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: [{ id: "tw_001", word: "Hi" }] }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSequence([]);

      const res = await transcriptionReq("/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_text: "new text" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);
      mockSelectSequence([FILE_ROW]);

      const res = await transcriptionReq("/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_text: "new text" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no edit access", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);
      mockSelectSequence([FILE_ROW]);

      const res = await transcriptionReq("/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_text: "new text" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when transcription is not found", async () => {
      mockSelectSequence([FILE_ROW], []);

      const res = await transcriptionReq("/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_text: "new text" }),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when transcription is not in completed status", async () => {
      const pendingTranscript = { ...TRANSCRIPT_ROW, status: "pending" };
      mockSelectSequence([FILE_ROW], [pendingTranscript]);

      const res = await transcriptionReq("/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_text: "new text" }),
      });

      expect(res.status).toBe(500);
    });

    it("sets editedByUserId and editedAt in updates", async () => {
      const updatedTranscript = { ...TRANSCRIPT_ROW };
      const setCalled = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: (updates: Record<string, unknown>) => {
          setCalled(updates);
          return { where: vi.fn().mockResolvedValue(undefined) };
        },
      } as never);
      mockSelectSequence([FILE_ROW], [TRANSCRIPT_ROW], [updatedTranscript]);

      await transcriptionReq("/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_text: "new text" }),
      });

      const updates = setCalled.mock.calls[0][0] as Record<string, unknown>;
      expect(updates.editedByUserId).toBe(SESSION.userId);
      expect(updates.editedAt).toBeInstanceOf(Date);
    });
  });

  // =========================================================================
  // DELETE / - Delete transcription
  // =========================================================================
  describe("DELETE / - delete transcription", () => {
    beforeEach(() => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);
    });

    it("returns 204 No Content on successful deletion", async () => {
      mockSelectSequence([FILE_ROW], [TRANSCRIPT_ROW]);

      const res = await transcriptionReq("/", { method: "DELETE" });
      expect(res.status).toBe(204);
      expect(res.body).toBeNull();
    });

    it("calls db.delete twice (words then transcript)", async () => {
      mockSelectSequence([FILE_ROW], [TRANSCRIPT_ROW]);

      await transcriptionReq("/", { method: "DELETE" });

      expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(2);
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSequence([]);

      const res = await transcriptionReq("/", { method: "DELETE" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);
      mockSelectSequence([FILE_ROW]);

      const res = await transcriptionReq("/", { method: "DELETE" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no edit access", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);
      mockSelectSequence([FILE_ROW]);

      const res = await transcriptionReq("/", { method: "DELETE" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when transcription is not found", async () => {
      mockSelectSequence([FILE_ROW], []);

      const res = await transcriptionReq("/", { method: "DELETE" });
      expect(res.status).toBe(500);
    });

    it("does not call db.delete when transcription is not found", async () => {
      mockSelectSequence([FILE_ROW], []);

      await transcriptionReq("/", { method: "DELETE" });
      expect(vi.mocked(db.delete)).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // GET /export - Export transcription
  // =========================================================================
  describe("GET /export - export transcription", () => {
    it("returns 200 with VTT content by default", async () => {
      mockSelectSequenceWithOrderBy([
        { rows: [FILE_ROW] },
        { rows: [TRANSCRIPT_ROW] },
        { rows: WORDS_ROWS, endsWithOrderBy: true },
      ]);

      const res = await transcriptionReq("/export", { method: "GET" });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/vtt");
    });

    it("sets Content-Disposition header with correct filename", async () => {
      mockSelectSequenceWithOrderBy([
        { rows: [FILE_ROW] },
        { rows: [TRANSCRIPT_ROW] },
        { rows: WORDS_ROWS, endsWithOrderBy: true },
      ]);

      const res = await transcriptionReq("/export?format=vtt", { method: "GET" });

      expect(res.headers.get("Content-Disposition")).toContain("interview.vtt");
    });

    it("returns SRT content type when format=srt", async () => {
      vi.mocked(exportTranscription).mockReturnValue("1\n00:00:00,000 --> 00:00:01,000\nHello world\n\n");
      mockSelectSequenceWithOrderBy([
        { rows: [FILE_ROW] },
        { rows: [TRANSCRIPT_ROW] },
        { rows: WORDS_ROWS, endsWithOrderBy: true },
      ]);

      const res = await transcriptionReq("/export?format=srt", { method: "GET" });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/x-subrip");
    });

    it("returns text/plain when format=txt", async () => {
      vi.mocked(exportTranscription).mockReturnValue("Hello world");
      mockSelectSequenceWithOrderBy([
        { rows: [FILE_ROW] },
        { rows: [TRANSCRIPT_ROW] },
        { rows: WORDS_ROWS, endsWithOrderBy: true },
      ]);

      const res = await transcriptionReq("/export?format=txt", { method: "GET" });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/plain");
    });

    it("returns 500 when format is invalid", async () => {
      const res = await transcriptionReq("/export?format=pdf", { method: "GET" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSequence([]);

      const res = await transcriptionReq("/export?format=vtt", { method: "GET" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);
      mockSelectSequence([FILE_ROW]);

      const res = await transcriptionReq("/export?format=vtt", { method: "GET" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no share access", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);
      mockSelectSequence([FILE_ROW]);

      const res = await transcriptionReq("/export?format=vtt", { method: "GET" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when transcription not found or not completed", async () => {
      const pendingTranscript = { ...TRANSCRIPT_ROW, status: "pending" };
      mockSelectSequence([FILE_ROW], [pendingTranscript]);

      const res = await transcriptionReq("/export?format=vtt", { method: "GET" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when transcription has no words", async () => {
      mockSelectSequenceWithOrderBy([
        { rows: [FILE_ROW] },
        { rows: [TRANSCRIPT_ROW] },
        { rows: [], endsWithOrderBy: true },
      ]);

      const res = await transcriptionReq("/export?format=vtt", { method: "GET" });
      expect(res.status).toBe(500);
    });

    it("calls exportTranscription with correct words and format", async () => {
      mockSelectSequenceWithOrderBy([
        { rows: [FILE_ROW] },
        { rows: [TRANSCRIPT_ROW] },
        { rows: WORDS_ROWS, endsWithOrderBy: true },
      ]);

      await transcriptionReq("/export?format=vtt", { method: "GET" });

      expect(vi.mocked(exportTranscription)).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ word: "Hello", startMs: 0, endMs: 500 }),
        ]),
        "vtt",
        TRANSCRIPT_ROW.speakerNames
      );
    });

    it("strips file extension in the exported filename", async () => {
      mockSelectSequenceWithOrderBy([
        { rows: [FILE_ROW] },
        { rows: [TRANSCRIPT_ROW] },
        { rows: WORDS_ROWS, endsWithOrderBy: true },
      ]);

      const res = await transcriptionReq("/export?format=srt", { method: "GET" });
      const disposition = res.headers.get("Content-Disposition") || "";

      // filename should be "interview.srt" not "interview.mp4.srt"
      expect(disposition).toContain("interview.srt");
      expect(disposition).not.toContain("interview.mp4.srt");
    });
  });

  // =========================================================================
  // GET /words - Get words for time range
  // =========================================================================
  describe("GET /words - get transcript words", () => {
    it("returns 200 with words array on success", async () => {
      mockSelectSequenceWithOrderBy([
        { rows: [FILE_ROW] },
        { rows: [TRANSCRIPT_ROW] },
        { rows: WORDS_ROWS, endsWithOrderBy: true },
      ]);

      const res = await transcriptionReq("/words", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;

      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(2);
    });

    it("returns word attributes correctly formatted", async () => {
      mockSelectSequenceWithOrderBy([
        { rows: [FILE_ROW] },
        { rows: [TRANSCRIPT_ROW] },
        { rows: WORDS_ROWS, endsWithOrderBy: true },
      ]);

      const res = await transcriptionReq("/words", { method: "GET" });
      const body = (await res.json()) as any;
      const word = body.data[0];

      expect(word.id).toBe("tw_001");
      expect(word.type).toBe("transcript_word");
      expect(word.attributes.word).toBe("Hello");
      expect(word.attributes.start_ms).toBe(0);
      expect(word.attributes.end_ms).toBe(500);
      expect(word.attributes.speaker).toBe("0");
      expect(word.attributes.confidence).toBe(0.99);
      expect(word.attributes.position).toBe(0);
    });

    it("returns empty array when no words match", async () => {
      mockSelectSequenceWithOrderBy([
        { rows: [FILE_ROW] },
        { rows: [TRANSCRIPT_ROW] },
        { rows: [], endsWithOrderBy: true },
      ]);

      const res = await transcriptionReq("/words", { method: "GET" });
      const body = (await res.json()) as any;

      expect(body.data).toEqual([]);
    });

    it("accepts start_ms and end_ms query parameters", async () => {
      mockSelectSequenceWithOrderBy([
        { rows: [FILE_ROW] },
        { rows: [TRANSCRIPT_ROW] },
        { rows: [WORDS_ROWS[0]], endsWithOrderBy: true },
      ]);

      const res = await transcriptionReq("/words?start_ms=0&end_ms=500", { method: "GET" });
      expect(res.status).toBe(200);
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSequence([]);

      const res = await transcriptionReq("/words", { method: "GET" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);
      mockSelectSequence([FILE_ROW]);

      const res = await transcriptionReq("/words", { method: "GET" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no view access", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);
      mockSelectSequence([FILE_ROW]);

      const res = await transcriptionReq("/words", { method: "GET" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when transcription is not found", async () => {
      mockSelectSequence([FILE_ROW], []);

      const res = await transcriptionReq("/words", { method: "GET" });
      expect(res.status).toBe(500);
    });
  });
});

// ===========================================================================
// Captions Routes
// ===========================================================================
describe("Captions Routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Re-set default mock implementations after resetAllMocks
    vi.mocked(requireAuth).mockReturnValue(SESSION as never);
    vi.mocked(randomUUID).mockReturnValue("aaaabbbb-cccc-dddd-eeee-ffffffffffff" as never);
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);
    vi.mocked(verifyAccountMembership).mockResolvedValue("owner" as never);

    vi.mocked(getStorageProvider).mockReturnValue({
      putObject: vi.fn().mockResolvedValue(undefined),
      deleteObject: vi.fn().mockResolvedValue(undefined),
    } as never);

    // Re-set response mocks (vi.resetAllMocks wipes implementations from vi.mock())
    vi.mocked(sendSingle).mockImplementation((c, data, type) =>
      (c as { json: (v: unknown) => unknown }).json({
        data: { id: (data as Record<string, unknown>).id, type, attributes: data },
      }) as any
    );
    vi.mocked(sendNoContent).mockImplementation((c) =>
      (c as { body: (b: null, s: number) => unknown }).body(null, 204) as any
    );
    vi.mocked(formatDates).mockImplementation((obj) => {
      const result: Record<string, unknown> = { ...(obj as object) };
      for (const key of Object.keys(result)) {
        if (result[key] instanceof Date) {
          result[key] = (result[key] as Date).toISOString();
        }
      }
      return result;
    });
  });

  // =========================================================================
  // GET / - List captions
  // =========================================================================
  describe("GET / - list captions", () => {
    it("returns 200 with captions array on success", async () => {
      // file select, then captions select with orderBy
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSelectChain([FILE_ROW]);
        return makeSelectChainOrderBy([CAPTION_ROW]);
      });

      const res = await captionsReq("/", { method: "GET" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;

      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(1);
    });

    it("returns caption attributes correctly", async () => {
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSelectChain([FILE_ROW]);
        return makeSelectChainOrderBy([CAPTION_ROW]);
      });

      const res = await captionsReq("/", { method: "GET" });
      const body = (await res.json()) as any;
      const caption = body.data[0];

      expect(caption.id).toBe("cap_001");
      expect(caption.type).toBe("caption");
      expect(caption.attributes.language).toBe("en");
      expect(caption.attributes.format).toBe("vtt");
      expect(caption.attributes.label).toBe("English");
      expect(caption.attributes.is_default).toBe(false);
      expect(caption.attributes.created_at).toBe("2024-01-15T10:00:00.000Z");
    });

    it("returns empty array when no captions exist", async () => {
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSelectChain([FILE_ROW]);
        return makeSelectChainOrderBy([]);
      });

      const res = await captionsReq("/", { method: "GET" });
      const body = (await res.json()) as any;

      expect(body.data).toEqual([]);
    });

    it("returns 500 when file is not found", async () => {
      vi.mocked(db.select).mockImplementation(() => makeSelectChain([]));

      const res = await captionsReq("/", { method: "GET" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);
      vi.mocked(db.select).mockImplementation(() => makeSelectChain([FILE_ROW]));

      const res = await captionsReq("/", { method: "GET" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no view access", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);
      vi.mocked(db.select).mockImplementation(() => makeSelectChain([FILE_ROW]));

      const res = await captionsReq("/", { method: "GET" });
      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // POST / - Upload caption file
  // =========================================================================
  describe("POST / - upload caption file", () => {
    function makeFormData(fields: {
      fileContent?: string;
      fileName?: string;
      language?: string;
      label?: string;
      format?: string;
    }) {
      const formData = new FormData();
      if (fields.fileContent !== undefined) {
        const blob = new Blob([fields.fileContent], { type: "text/vtt" });
        formData.append("file", blob, fields.fileName ?? "captions.vtt");
      }
      if (fields.language) formData.append("language", fields.language);
      if (fields.label) formData.append("label", fields.label);
      if (fields.format) formData.append("format", fields.format);
      return formData;
    }

    beforeEach(() => {
      vi.mocked(db.select).mockImplementation(() => makeSelectChain([FILE_ROW]));
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);
    });

    it("returns 200 with created caption on success", async () => {
      const formData = makeFormData({
        fileContent: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello",
        fileName: "captions.vtt",
        language: "en",
        label: "English",
      });

      const res = await captionsReq("/", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.type).toBe("caption");
      expect(body.data.attributes.attributes.language).toBe("en");
    });

    it("uploads caption file to storage", async () => {
      const mockStorage = {
        putObject: vi.fn().mockResolvedValue(undefined),
        deleteObject: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(getStorageProvider).mockReturnValue(mockStorage as never);

      const formData = makeFormData({
        fileContent: "WEBVTT",
        fileName: "captions.vtt",
        language: "en",
      });

      await captionsReq("/", {
        method: "POST",
        body: formData,
      });

      expect(mockStorage.putObject).toHaveBeenCalledTimes(1);
    });

    it("inserts caption record into database", async () => {
      const formData = makeFormData({
        fileContent: "WEBVTT",
        fileName: "captions.vtt",
        language: "en",
      });

      await captionsReq("/", {
        method: "POST",
        body: formData,
      });

      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);
    });

    it("detects VTT format from file extension", async () => {
      const formData = makeFormData({
        fileContent: "WEBVTT",
        fileName: "captions.vtt",
        language: "en",
      });

      const res = await captionsReq("/", {
        method: "POST",
        body: formData,
      });
      const body = (await res.json()) as any;

      expect(body.data.attributes.attributes.format).toBe("vtt");
    });

    it("detects SRT format from file extension", async () => {
      const formData = makeFormData({
        fileContent: "1\n00:00:00,000 --> 00:00:01,000\nHello",
        fileName: "captions.srt",
        language: "en",
      });

      const res = await captionsReq("/", {
        method: "POST",
        body: formData,
      });
      const body = (await res.json()) as any;

      expect(body.data.attributes.attributes.format).toBe("srt");
    });

    it("uses label as fallback to language when label not provided", async () => {
      const formData = makeFormData({
        fileContent: "WEBVTT",
        fileName: "captions.vtt",
        language: "fr",
      });

      const res = await captionsReq("/", {
        method: "POST",
        body: formData,
      });
      const body = (await res.json()) as any;

      expect(body.data.attributes.attributes.label).toBe("fr");
    });

    it("generates caption ID using randomUUID", async () => {
      const formData = makeFormData({
        fileContent: "WEBVTT",
        fileName: "captions.vtt",
        language: "en",
      });

      const res = await captionsReq("/", {
        method: "POST",
        body: formData,
      });
      const body = (await res.json()) as any;

      expect(body.data.id).toMatch(/^cap_/);
    });

    it("returns 500 when Content-Type is not multipart/form-data", async () => {
      const res = await captionsReq("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is missing from form", async () => {
      const formData = new FormData();
      formData.append("language", "en");

      const res = await captionsReq("/", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when language is missing from form", async () => {
      const formData = new FormData();
      const blob = new Blob(["WEBVTT"], { type: "text/vtt" });
      formData.append("file", blob, "captions.vtt");

      const res = await captionsReq("/", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when file is not found", async () => {
      vi.mocked(db.select).mockImplementation(() => makeSelectChain([]));

      const formData = makeFormData({
        fileContent: "WEBVTT",
        fileName: "captions.vtt",
        language: "en",
      });

      const res = await captionsReq("/", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

      const formData = makeFormData({
        fileContent: "WEBVTT",
        fileName: "captions.vtt",
        language: "en",
      });

      const res = await captionsReq("/", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no edit access", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);

      const formData = makeFormData({
        fileContent: "WEBVTT",
        fileName: "captions.vtt",
        language: "en",
      });

      const res = await captionsReq("/", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(500);
    });
  });

  // =========================================================================
  // DELETE /:captionId - Delete caption track
  // =========================================================================
  describe("DELETE /:captionId - delete caption", () => {
    beforeEach(() => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);
    });

    it("returns 204 No Content on successful deletion", async () => {
      mockSelectSequence([FILE_ROW], [CAPTION_ROW]);

      const res = await captionsReq("/cap_001", { method: "DELETE" });
      expect(res.status).toBe(204);
      expect(res.body).toBeNull();
    });

    it("calls storage.deleteObject with caption storageKey", async () => {
      const mockStorage = {
        putObject: vi.fn().mockResolvedValue(undefined),
        deleteObject: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(getStorageProvider).mockReturnValue(mockStorage as never);
      mockSelectSequence([FILE_ROW], [CAPTION_ROW]);

      await captionsReq("/cap_001", { method: "DELETE" });

      expect(mockStorage.deleteObject).toHaveBeenCalledWith(CAPTION_ROW.storageKey);
    });

    it("calls db.delete once for caption", async () => {
      mockSelectSequence([FILE_ROW], [CAPTION_ROW]);

      await captionsReq("/cap_001", { method: "DELETE" });

      expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when file is not found", async () => {
      mockSelectSequence([]);

      const res = await captionsReq("/cap_001", { method: "DELETE" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when project access is denied", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);
      mockSelectSequence([FILE_ROW]);

      const res = await captionsReq("/cap_001", { method: "DELETE" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when user has no edit access", async () => {
      vi.mocked(verifyAccountMembership).mockResolvedValue(null as never);
      mockSelectSequence([FILE_ROW]);

      const res = await captionsReq("/cap_001", { method: "DELETE" });
      expect(res.status).toBe(500);
    });

    it("returns 500 when caption is not found", async () => {
      mockSelectSequence([FILE_ROW], []);

      const res = await captionsReq("/cap_missing", { method: "DELETE" });
      expect(res.status).toBe(500);
    });

    it("does not call db.delete when caption is not found", async () => {
      mockSelectSequence([FILE_ROW], []);

      await captionsReq("/cap_missing", { method: "DELETE" });
      expect(vi.mocked(db.delete)).not.toHaveBeenCalled();
    });

    it("silently ignores storage deletion errors", async () => {
      const mockStorage = {
        putObject: vi.fn().mockResolvedValue(undefined),
        deleteObject: vi.fn().mockRejectedValue(new Error("S3 unavailable")),
      };
      vi.mocked(getStorageProvider).mockReturnValue(mockStorage as never);
      mockSelectSequence([FILE_ROW], [CAPTION_ROW]);

      // Should not throw, should still return 204
      const res = await captionsReq("/cap_001", { method: "DELETE" });
      expect(res.status).toBe(204);
    });
  });
});
