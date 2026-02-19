/**
 * Bush Platform - Bulk Operations Routes Tests
 *
 * Comprehensive unit tests for bulk file and folder operation API routes.
 */

// Mock all dependencies BEFORE any imports (vitest hoists vi.mock calls)
vi.mock("../../db/index.js", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
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
}));

vi.mock("../../db/schema.js", () => ({
  files: {
    id: "id",
    projectId: "projectId",
    folderId: "folderId",
    versionStackId: "versionStackId",
    name: "name",
    originalName: "originalName",
    mimeType: "mimeType",
    fileSizeBytes: "fileSizeBytes",
    checksum: "checksum",
    status: "status",
    deletedAt: "deletedAt",
    expiresAt: "expiresAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  folders: {
    id: "id",
    projectId: "projectId",
    parentId: "parentId",
    name: "name",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  accounts: {
    id: "id",
    storageUsedBytes: "storageUsedBytes",
    storageQuotaBytes: "storageQuotaBytes",
    updatedAt: "updatedAt",
  },
}));

vi.mock("../router.js", () => ({
  generateId: vi.fn().mockReturnValue("file_new123"),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, val) => ({ type: "eq", field, val })),
  and: vi.fn((...args) => ({ type: "and", args })),
  desc: vi.fn((field) => ({ type: "desc", field })),
  lt: vi.fn((field, val) => ({ type: "lt", field, val })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ type: "sql", strings, values })),
    {
      raw: vi.fn((s: string) => ({ type: "sql_raw", s })),
    }
  ),
  isNull: vi.fn((field) => ({ type: "isNull", field })),
  inArray: vi.fn((field, vals) => ({ type: "inArray", field, vals })),
}));

vi.mock("../../storage/index.js", () => ({
  storage: {
    copyObject: vi.fn(),
    getDownloadUrl: vi.fn(),
  },
  storageKeys: {
    original: vi.fn((ctx, name) => `${ctx.accountId}/${ctx.projectId}/${ctx.assetId}/${name}`),
  },
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "./bulk.js";
import { db } from "../../db/index.js";
import { requireAuth } from "../auth-middleware.js";
import { verifyProjectAccess } from "../access-control.js";
import { storage, storageKeys } from "../../storage/index.js";
import { generateId } from "../router.js";

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
  projectId: "proj_001",
  folderId: null,
  versionStackId: null,
  name: "photo.jpg",
  originalName: "photo.jpg",
  mimeType: "image/jpeg",
  fileSizeBytes: 1024 * 1024, // 1 MB
  checksum: "abc123",
  status: "ready",
  deletedAt: null,
  expiresAt: null,
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
};

const FOLDER_ROW = {
  id: "folder_001",
  projectId: "proj_001",
  parentId: null,
  name: "My Folder",
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
};

const DEST_FOLDER_ROW = {
  id: "folder_dest",
  projectId: "proj_002",
  parentId: null,
  name: "Destination Folder",
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
};

const ACCOUNT_ROW = {
  id: "acc_xyz",
  storageUsedBytes: 10 * 1024 * 1024, // 10 MB used
  storageQuotaBytes: 100 * 1024 * 1024, // 100 MB quota
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Set up db.select to return different results across sequential calls.
 * Each element in `resultsByCall` is the array returned for that call index.
 */
function mockSelectSequence(...resultsByCall: unknown[][]) {
  let callCount = 0;
  vi.mocked(db.select).mockImplementation(() => {
    const results = resultsByCall[callCount] ?? [];
    callCount++;
    return {
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue(results),
        }),
      }),
    } as never;
  });
}

/**
 * Set up db.select to always return the same result list.
 */
function mockSelectAlways(results: unknown[]) {
  vi.mocked(db.select).mockImplementation(() => ({
    from: () => ({
      where: () => ({
        limit: vi.fn().mockResolvedValue(results),
      }),
    }),
  } as never));
}

/**
 * Set up db.update to succeed (resolves undefined).
 */
function mockUpdateSuccess() {
  vi.mocked(db.update).mockReturnValue({
    set: () => ({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as never);
}

/**
 * Set up db.insert to succeed (resolves undefined).
 */
function mockInsertSuccess() {
  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  } as never);
}

/**
 * Set up db.delete to succeed (resolves undefined).
 */
function mockDeleteSuccess() {
  vi.mocked(db.delete).mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  } as never);
}

/**
 * Set up db.transaction to call the callback with a mock tx object.
 */
function mockTransactionSuccess() {
  (vi.mocked(db.transaction) as any).mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
    const tx = {
      update: () => ({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };
    await cb(tx);
  });
}

/**
 * Set up db.transaction to throw an error.
 */
function mockTransactionFailure(message = "Transaction failed") {
  vi.mocked(db.transaction).mockRejectedValue(new Error(message));
}

// ---------------------------------------------------------------------------
// POST /files/move
// ---------------------------------------------------------------------------

describe("POST /files/move", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireAuth).mockReturnValue(SESSION as never);
    vi.mocked(generateId).mockReturnValue("file_new123");
  });

  it("returns 200 with succeeded list when moving files to a project", async () => {
    // dest project access check, then file lookup (per file)
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);
    mockSelectSequence([FILE_ROW]); // file lookup for file_001

    mockUpdateSuccess();

    const res = await app.request("/files/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "project", project_id: "proj_002" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toContain("file_001");
    expect(body.data.failed).toHaveLength(0);
  });

  it("returns 200 moving files to a folder destination", async () => {
    // First select call = dest folder lookup; subsequent = file lookup
    mockSelectSequence([DEST_FOLDER_ROW], [FILE_ROW]);
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);
    mockUpdateSuccess();

    const res = await app.request("/files/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "folder", id: "folder_dest" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toContain("file_001");
    expect(body.data.failed).toHaveLength(0);
  });

  it("returns 200 moving files to a root destination", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);
    mockSelectAlways([FILE_ROW]);
    mockUpdateSuccess();

    const res = await app.request("/files/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "root", project_id: "proj_002" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toContain("file_001");
  });

  it("returns 500 when file_ids is missing", async () => {
    const res = await app.request("/files/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: { type: "project", project_id: "proj_002" } }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when file_ids is empty array", async () => {
    const res = await app.request("/files/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: [], destination: { type: "project", project_id: "proj_002" } }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when more than 100 file_ids are provided", async () => {
    const fileIds = Array.from({ length: 101 }, (_, i) => `file_${i}`);

    const res = await app.request("/files/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: fileIds, destination: { type: "project", project_id: "proj_002" } }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when destination is missing", async () => {
    const res = await app.request("/files/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: ["file_001"] }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when destination type is invalid", async () => {
    const res = await app.request("/files/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "invalid_type", project_id: "proj_002" },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when destination folder does not exist", async () => {
    mockSelectSequence([]); // empty = folder not found
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);

    const res = await app.request("/files/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "folder", id: "folder_missing" },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when destination project access is denied", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

    const res = await app.request("/files/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "project", project_id: "proj_noaccess" },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("adds file to failed list when file is not found", async () => {
    // dest project access: granted; file lookup: not found
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);
    mockSelectAlways([]); // file not found

    const res = await app.request("/files/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_missing"],
        destination: { type: "project", project_id: "proj_002" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toHaveLength(0);
    expect(body.data.failed).toHaveLength(1);
    expect(body.data.failed[0].id).toBe("file_missing");
    expect(body.data.failed[0].error).toBe("File not found");
  });

  it("adds file to failed list when source project access is denied", async () => {
    // dest access ok, then src access denied
    vi.mocked(verifyProjectAccess)
      .mockResolvedValueOnce({ id: "proj_002" } as never) // dest
      .mockResolvedValueOnce(null as never); // src

    mockSelectAlways([FILE_ROW]);

    const res = await app.request("/files/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "project", project_id: "proj_002" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.failed[0].error).toBe("Access denied to source project");
  });

  it("processes multiple files and tracks succeeded/failed separately", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);
    // file_001 found, file_002 not found
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      const result = selectCallCount === 0 ? [FILE_ROW] : [];
      selectCallCount++;
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(result),
          }),
        }),
      } as never;
    });

    mockUpdateSuccess();

    const res = await app.request("/files/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001", "file_002"],
        destination: { type: "project", project_id: "proj_002" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toContain("file_001");
    expect(body.data.failed[0].id).toBe("file_002");
  });

  it("calls db.update to move the file", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);
    mockSelectAlways([FILE_ROW]);
    mockUpdateSuccess();

    await app.request("/files/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "project", project_id: "proj_002" },
      }),
    });

    expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// POST /files/copy
// ---------------------------------------------------------------------------

describe("POST /files/copy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireAuth).mockReturnValue(SESSION as never);
    vi.mocked(generateId).mockReturnValue("file_new123");
    vi.mocked(storage.copyObject).mockResolvedValue(undefined as never);
  });

  it("returns 200 with succeeded list on successful copy to project", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);
    // select: account, file
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      const results = callCount === 0 ? [ACCOUNT_ROW] : [FILE_ROW];
      callCount++;
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(results),
          }),
        }),
      } as never;
    });
    mockInsertSuccess();
    mockUpdateSuccess();

    const res = await app.request("/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "project", project_id: "proj_002" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toContain("file_001");
    expect(body.data.failed).toHaveLength(0);
    expect(body.data.copies).toHaveLength(1);
    expect(body.data.copies[0].original).toBe("file_001");
  });

  it("includes 'Copy of' prefix in copied file name", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      const results = callCount === 0 ? [ACCOUNT_ROW] : [FILE_ROW];
      callCount++;
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(results),
          }),
        }),
      } as never;
    });

    const insertValuesSpy = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: insertValuesSpy } as never);
    mockUpdateSuccess();

    await app.request("/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "project", project_id: "proj_002" },
      }),
    });

    expect(insertValuesSpy).toHaveBeenCalled();
    const insertArg = insertValuesSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.name).toBe("Copy of photo.jpg");
  });

  it("calls storage.copyObject for ready files", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      const results = callCount === 0 ? [ACCOUNT_ROW] : [FILE_ROW]; // status: "ready"
      callCount++;
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(results),
          }),
        }),
      } as never;
    });
    mockInsertSuccess();
    mockUpdateSuccess();

    await app.request("/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "project", project_id: "proj_002" },
      }),
    });

    expect(vi.mocked(storage.copyObject)).toHaveBeenCalledTimes(1);
  });

  it("does not call storage.copyObject for non-ready files", async () => {
    const pendingFile = { ...FILE_ROW, status: "pending" };
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      const results = callCount === 0 ? [ACCOUNT_ROW] : [pendingFile];
      callCount++;
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(results),
          }),
        }),
      } as never;
    });
    mockInsertSuccess();
    mockUpdateSuccess();

    await app.request("/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "project", project_id: "proj_002" },
      }),
    });

    expect(vi.mocked(storage.copyObject)).not.toHaveBeenCalled();
  });

  it("returns 500 when file_ids is empty array", async () => {
    const res = await app.request("/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: [], destination: { type: "project", project_id: "proj_002" } }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when more than 100 file_ids are provided", async () => {
    const fileIds = Array.from({ length: 101 }, (_, i) => `file_${i}`);

    const res = await app.request("/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: fileIds, destination: { type: "project", project_id: "proj_002" } }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when destination is missing", async () => {
    const res = await app.request("/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: ["file_001"] }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when destination folder does not exist", async () => {
    mockSelectSequence([]); // empty = folder not found
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);

    const res = await app.request("/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "folder", id: "folder_missing" },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when destination project access is denied", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

    const res = await app.request("/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "project", project_id: "proj_noaccess" },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when account is not found", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);
    mockSelectAlways([]); // account not found

    const res = await app.request("/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "project", project_id: "proj_002" },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("fails all files when storage quota is exceeded", async () => {
    const bigFile = { ...FILE_ROW, fileSizeBytes: 200 * 1024 * 1024 }; // 200 MB > 90 MB remaining
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      const results = callCount === 0 ? [ACCOUNT_ROW] : [bigFile];
      callCount++;
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(results),
          }),
        }),
      } as never;
    });

    const res = await app.request("/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "project", project_id: "proj_002" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toHaveLength(0);
    expect(body.data.failed[0].error).toBe("Insufficient storage quota");
  });

  it("adds file to failed list when file is not found", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      // account first, then no file
      const results = callCount === 0 ? [ACCOUNT_ROW] : [];
      callCount++;
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(results),
          }),
        }),
      } as never;
    });

    const res = await app.request("/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_missing"],
        destination: { type: "project", project_id: "proj_002" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.failed[0].error).toBe("File not found");
  });

  it("adds file to failed list when source project access is denied", async () => {
    vi.mocked(verifyProjectAccess)
      .mockResolvedValueOnce({ id: "proj_002" } as never) // dest
      .mockResolvedValueOnce(null as never); // src file

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      const results = callCount === 0 ? [ACCOUNT_ROW] : [FILE_ROW];
      callCount++;
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(results),
          }),
        }),
      } as never;
    });

    const res = await app.request("/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "project", project_id: "proj_002" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.failed[0].error).toBe("Access denied to source project");
  });

  it("updates storage used bytes after successful copy", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      const results = callCount === 0 ? [ACCOUNT_ROW] : [FILE_ROW];
      callCount++;
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(results),
          }),
        }),
      } as never;
    });
    mockInsertSuccess();
    mockUpdateSuccess();

    await app.request("/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "project", project_id: "proj_002" },
      }),
    });

    expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
  });

  it("still succeeds even if storage.copyObject fails", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);
    vi.mocked(storage.copyObject).mockRejectedValue(new Error("S3 error"));

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      const results = callCount === 0 ? [ACCOUNT_ROW] : [FILE_ROW];
      callCount++;
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(results),
          }),
        }),
      } as never;
    });
    mockInsertSuccess();
    mockUpdateSuccess();

    const res = await app.request("/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "project", project_id: "proj_002" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    // Should still succeed because storage errors don't fail the record creation
    expect(body.data.succeeded).toContain("file_001");
  });

  it("uses generateId to create a new file ID for each copy", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      const results = callCount === 0 ? [ACCOUNT_ROW] : [FILE_ROW];
      callCount++;
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(results),
          }),
        }),
      } as never;
    });
    mockInsertSuccess();
    mockUpdateSuccess();

    await app.request("/files/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        destination: { type: "project", project_id: "proj_002" },
      }),
    });

    expect(vi.mocked(generateId)).toHaveBeenCalledWith("file");
  });
});

// ---------------------------------------------------------------------------
// POST /files/delete
// ---------------------------------------------------------------------------

describe("POST /files/delete", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireAuth).mockReturnValue(SESSION as never);
    vi.mocked(generateId).mockReturnValue("file_new123");
  });

  it("returns 200 with succeeded list on successful soft delete", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);
    mockSelectAlways([FILE_ROW]);
    mockTransactionSuccess();

    const res = await app.request("/files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: ["file_001"] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toContain("file_001");
    expect(body.data.failed).toHaveLength(0);
  });

  it("returns 500 when file_ids is empty array", async () => {
    const res = await app.request("/files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: [] }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when file_ids is missing", async () => {
    const res = await app.request("/files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when more than 100 file_ids are provided", async () => {
    const fileIds = Array.from({ length: 101 }, (_, i) => `file_${i}`);

    const res = await app.request("/files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: fileIds }),
    });

    expect(res.status).toBe(500);
  });

  it("adds file to failed list when file is not found", async () => {
    mockSelectAlways([]); // file not found

    const res = await app.request("/files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: ["file_missing"] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.failed[0].error).toBe("File not found or already deleted");
    expect(body.data.succeeded).toHaveLength(0);
  });

  it("adds file to failed list when project access is denied", async () => {
    mockSelectAlways([FILE_ROW]);
    vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

    const res = await app.request("/files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: ["file_001"] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.failed[0].error).toBe("Access denied");
  });

  it("marks all files as failed when transaction throws", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);
    mockSelectAlways([FILE_ROW]);
    mockTransactionFailure("DB error");

    const res = await app.request("/files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: ["file_001"] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toHaveLength(0);
    expect(body.data.failed[0].error).toBe("DB error");
  });

  it("does not call transaction when no files pass validation", async () => {
    mockSelectAlways([]); // all files not found

    await app.request("/files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: ["file_missing_1", "file_missing_2"] }),
    });

    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled();
  });

  it("calls db.transaction for atomic soft delete", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);
    mockSelectAlways([FILE_ROW]);
    mockTransactionSuccess();

    await app.request("/files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: ["file_001"] }),
    });

    expect(vi.mocked(db.transaction)).toHaveBeenCalledTimes(1);
  });

  it("processes mix of found and not-found files", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      const result = callCount === 0 ? [FILE_ROW] : [];
      callCount++;
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(result),
          }),
        }),
      } as never;
    });
    mockTransactionSuccess();

    const res = await app.request("/files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: ["file_001", "file_missing"] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toContain("file_001");
    expect(body.data.failed[0].id).toBe("file_missing");
  });
});

// ---------------------------------------------------------------------------
// POST /files/download
// ---------------------------------------------------------------------------

describe("POST /files/download", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireAuth).mockReturnValue(SESSION as never);
    vi.mocked(generateId).mockReturnValue("file_new123");
    vi.mocked(storage.getDownloadUrl).mockResolvedValue({
      url: "https://example.com/download/photo.jpg",
      expiresAt: new Date("2024-01-15T11:00:00.000Z"),
    } as never);
    // Re-set storageKeys.original since resetAllMocks clears implementations
    vi.mocked(storageKeys.original).mockImplementation(
      (ctx: { accountId: string; projectId: string; assetId: string }, name: string) =>
        `${ctx.accountId}/${ctx.projectId}/${ctx.assetId}/${name}`
    );
  });

  it("returns 200 with download URLs for ready files", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);
    mockSelectAlways([FILE_ROW]);

    const res = await app.request("/files/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: ["file_001"] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toHaveLength(1);
    expect(body.data.succeeded[0].id).toBe("file_001");
    expect(body.data.succeeded[0].download_url).toBe("https://example.com/download/photo.jpg");
    expect(body.data.succeeded[0].expires_at).toBe("2024-01-15T11:00:00.000Z");
    expect(body.data.failed).toHaveLength(0);
  });

  it("returns 500 when file_ids is empty array", async () => {
    const res = await app.request("/files/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: [] }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when file_ids is missing", async () => {
    const res = await app.request("/files/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when more than 100 file_ids are provided", async () => {
    const fileIds = Array.from({ length: 101 }, (_, i) => `file_${i}`);

    const res = await app.request("/files/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: fileIds }),
    });

    expect(res.status).toBe(500);
  });

  it("adds file to failed list when file is not found", async () => {
    mockSelectAlways([]);

    const res = await app.request("/files/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: ["file_missing"] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.failed[0].error).toBe("File not found");
  });

  it("adds file to failed list when project access is denied", async () => {
    mockSelectAlways([FILE_ROW]);
    vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

    const res = await app.request("/files/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: ["file_001"] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.failed[0].error).toBe("Access denied");
  });

  it("adds file to failed list when file is not ready", async () => {
    const processingFile = { ...FILE_ROW, status: "processing" };
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);
    mockSelectAlways([processingFile]);

    const res = await app.request("/files/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: ["file_001"] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.failed[0].error).toContain("File not ready");
    expect(body.data.failed[0].error).toContain("processing");
  });

  it("calls storage.getDownloadUrl with 3600 second expiry", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);
    mockSelectAlways([FILE_ROW]);

    await app.request("/files/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: ["file_001"] }),
    });

    expect(vi.mocked(storage.getDownloadUrl)).toHaveBeenCalledWith(
      expect.any(String),
      3600
    );
  });

  it("adds file to failed when getDownloadUrl throws", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);
    mockSelectAlways([FILE_ROW]);
    vi.mocked(storage.getDownloadUrl).mockRejectedValue(new Error("Storage failure"));

    const res = await app.request("/files/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: ["file_001"] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.failed[0].error).toBe("Storage failure");
  });
});

// ---------------------------------------------------------------------------
// POST /folders/move
// ---------------------------------------------------------------------------

describe("POST /folders/move", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireAuth).mockReturnValue(SESSION as never);
    vi.mocked(generateId).mockReturnValue("file_new123");
  });

  it("returns 200 moving folders to a root destination", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);
    mockSelectAlways([FOLDER_ROW]);
    mockUpdateSuccess();

    const res = await app.request("/folders/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder_ids: ["folder_001"],
        destination: { type: "root", project_id: "proj_002" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toContain("folder_001");
    expect(body.data.failed).toHaveLength(0);
  });

  it("returns 200 moving folders to a folder destination", async () => {
    // First select = dest folder, second = source folder
    mockSelectSequence([DEST_FOLDER_ROW], [FOLDER_ROW]);
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);
    mockUpdateSuccess();

    const res = await app.request("/folders/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder_ids: ["folder_001"],
        destination: { type: "folder", id: "folder_dest" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toContain("folder_001");
  });

  it("returns 500 when folder_ids is empty array", async () => {
    const res = await app.request("/folders/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_ids: [], destination: { type: "root", project_id: "proj_002" } }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when more than 100 folder_ids are provided", async () => {
    const folderIds = Array.from({ length: 101 }, (_, i) => `folder_${i}`);

    const res = await app.request("/folders/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_ids: folderIds, destination: { type: "root", project_id: "proj_002" } }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when destination is missing", async () => {
    const res = await app.request("/folders/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_ids: ["folder_001"] }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when destination type is invalid", async () => {
    const res = await app.request("/folders/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder_ids: ["folder_001"],
        destination: { type: "project", project_id: "proj_002" }, // 'project' not valid for folder move
      }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when destination folder does not exist", async () => {
    mockSelectSequence([]); // empty = dest folder not found
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);

    const res = await app.request("/folders/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder_ids: ["folder_001"],
        destination: { type: "folder", id: "folder_missing" },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when destination project access is denied", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

    const res = await app.request("/folders/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder_ids: ["folder_001"],
        destination: { type: "root", project_id: "proj_noaccess" },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("adds folder to failed list when folder is not found", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);
    mockSelectAlways([]);

    const res = await app.request("/folders/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder_ids: ["folder_missing"],
        destination: { type: "root", project_id: "proj_002" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.failed[0].error).toBe("Folder not found");
  });

  it("adds folder to failed list when source project access is denied", async () => {
    vi.mocked(verifyProjectAccess)
      .mockResolvedValueOnce({ id: "proj_002" } as never) // dest
      .mockResolvedValueOnce(null as never); // src

    mockSelectAlways([FOLDER_ROW]);

    const res = await app.request("/folders/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder_ids: ["folder_001"],
        destination: { type: "root", project_id: "proj_002" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.failed[0].error).toBe("Access denied to source project");
  });

  it("prevents moving a folder into itself", async () => {
    // dest folder id matches folder being moved
    const selfFolder = { ...FOLDER_ROW, id: "folder_self" };
    const destFolder = { ...DEST_FOLDER_ROW, id: "folder_self" };
    mockSelectSequence([destFolder], [selfFolder]);
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);

    const res = await app.request("/folders/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder_ids: ["folder_self"],
        destination: { type: "folder", id: "folder_self" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.failed[0].error).toBe("Cannot move folder into itself");
  });

  it("calls db.update to update folder parentId", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);
    mockSelectAlways([FOLDER_ROW]);
    mockUpdateSuccess();

    await app.request("/folders/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder_ids: ["folder_001"],
        destination: { type: "root", project_id: "proj_002" },
      }),
    });

    expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// POST /folders/delete
// ---------------------------------------------------------------------------

describe("POST /folders/delete", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireAuth).mockReturnValue(SESSION as never);
    vi.mocked(generateId).mockReturnValue("file_new123");
  });

  it("returns 200 with succeeded list on successful folder deletion", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);
    mockSelectAlways([FOLDER_ROW]);
    mockUpdateSuccess();
    mockDeleteSuccess();

    const res = await app.request("/folders/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_ids: ["folder_001"] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toContain("folder_001");
    expect(body.data.failed).toHaveLength(0);
  });

  it("returns 500 when folder_ids is empty array", async () => {
    const res = await app.request("/folders/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_ids: [] }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when folder_ids is missing", async () => {
    const res = await app.request("/folders/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when more than 100 folder_ids are provided", async () => {
    const folderIds = Array.from({ length: 101 }, (_, i) => `folder_${i}`);

    const res = await app.request("/folders/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_ids: folderIds }),
    });

    expect(res.status).toBe(500);
  });

  it("adds folder to failed list when folder is not found", async () => {
    mockSelectAlways([]);

    const res = await app.request("/folders/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_ids: ["folder_missing"] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.failed[0].error).toBe("Folder not found");
  });

  it("adds folder to failed list when project access is denied", async () => {
    mockSelectAlways([FOLDER_ROW]);
    vi.mocked(verifyProjectAccess).mockResolvedValue(null as never);

    const res = await app.request("/folders/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_ids: ["folder_001"] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.failed[0].error).toBe("Access denied");
  });

  it("soft deletes files in the folder before deleting the folder", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);
    mockSelectAlways([FOLDER_ROW]);
    mockUpdateSuccess();
    mockDeleteSuccess();

    await app.request("/folders/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_ids: ["folder_001"] }),
    });

    // db.update for files, then db.delete for folder
    expect(vi.mocked(db.update)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1);
  });

  it("calls db.delete to hard delete the folder", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);
    mockSelectAlways([FOLDER_ROW]);
    mockUpdateSuccess();
    mockDeleteSuccess();

    await app.request("/folders/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_ids: ["folder_001"] }),
    });

    expect(vi.mocked(db.delete)).toHaveBeenCalledTimes(1);
  });

  it("adds folder to failed list when db.delete throws", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);
    mockSelectAlways([FOLDER_ROW]);
    mockUpdateSuccess();
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockRejectedValue(new Error("DB delete error")),
    } as never);

    const res = await app.request("/folders/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_ids: ["folder_001"] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.failed[0].error).toBe("DB delete error");
  });

  it("processes multiple folders independently (one failure does not block others)", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);

    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      const result = selectCallCount === 0 ? [FOLDER_ROW] : [];
      selectCallCount++;
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(result),
          }),
        }),
      } as never;
    });

    mockUpdateSuccess();
    mockDeleteSuccess();

    const res = await app.request("/folders/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_ids: ["folder_001", "folder_missing"] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toContain("folder_001");
    expect(body.data.failed[0].id).toBe("folder_missing");
  });
});
