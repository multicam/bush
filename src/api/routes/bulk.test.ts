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
  verifyAccountMembership: vi.fn(),
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
    customMetadata: "customMetadata",
    rating: "rating",
    assetStatus: "assetStatus",
    keywords: "keywords",
    notes: "notes",
    assigneeId: "assigneeId",
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
  customFields: {
    id: "id",
    accountId: "accountId",
    name: "name",
    type: "type",
    options: "options",
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
import { verifyProjectAccess, verifyAccountMembership } from "../access-control.js";
import { storage, storageKeys } from "../../storage/index.js";
import { generateId } from "../router.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const SESSION = {
  sessionId: "ses_111",
  userId: "usr_abc",
  email: "test@example.com",
  displayName: "Test User",
  currentAccountId: "acc_xyz",
  accountRole: "owner" as const,
  workosOrganizationId: "org_123",
  workosUserId: "wusr_123",
  createdAt: Date.now(),
  lastActivityAt: Date.now(),
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
 * Set up db.select for bulk operations with new query order:
 * 1. Account query (with limit) - returns accountArray
 * 2. Files batch query (no limit) - returns filesArray
 */
function mockSelectBulkOrder(filesArray: unknown[], accountArray: unknown[]) {
  let callCount = 0;
  vi.mocked(db.select).mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // First call: account query (with .limit())
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(accountArray),
          }),
        }),
      } as never;
    } else {
      // Second call: files batch query (resolves without .limit())
      return {
        from: () => ({
          where: vi.fn().mockResolvedValue(filesArray),
        }),
      } as never;
    }
  });
}

/**
 * Set up db.select for bulk move operations (files batch query only, no account).
 * The move endpoint only queries files without .limit().
 */
function mockSelectBulkMove(filesArray: unknown[]) {
  vi.mocked(db.select).mockImplementation(() => ({
    from: () => ({
      where: vi.fn().mockResolvedValue(filesArray),
    }),
  }) as never);
}

/**
 * Set up db.select for bulk move with folder destination:
 * 1. Folder lookup (with limit)
 * 2. Files batch query (no limit)
 */
function mockSelectBulkMoveWithFolder(folderArray: unknown[], filesArray: unknown[]) {
  let callCount = 0;
  vi.mocked(db.select).mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // First call: folder lookup (with .limit())
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue(folderArray),
          }),
        }),
      } as never;
    } else {
      // Second call: files batch query (no .limit())
      return {
        from: () => ({
          where: vi.fn().mockResolvedValue(filesArray),
        }),
      } as never;
    }
  });
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
    // dest project access check, then files batch query
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);
    mockSelectBulkMove([FILE_ROW]); // files batch query

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
    // First select call = dest folder lookup; second = files batch query
    mockSelectBulkMoveWithFolder([DEST_FOLDER_ROW], [FILE_ROW]);
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
    mockSelectBulkMove([FILE_ROW]);
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
    mockSelectBulkMoveWithFolder([], [FILE_ROW]); // empty folder = not found
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
    // dest project access: granted; files batch query: not found
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_002" } as never);
    mockSelectBulkMove([]); // files not found

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

    mockSelectBulkMove([FILE_ROW]);

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
    mockSelectBulkMove([FILE_ROW]);

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
    mockSelectBulkMove([FILE_ROW]);
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
    mockSelectBulkOrder([FILE_ROW], [ACCOUNT_ROW]);
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
    mockSelectBulkOrder([FILE_ROW], [ACCOUNT_ROW]);

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
    mockSelectBulkOrder([FILE_ROW], [ACCOUNT_ROW]); // status: "ready"
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
    mockSelectBulkOrder([pendingFile], [ACCOUNT_ROW]);
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
    mockSelectBulkOrder([bigFile], [ACCOUNT_ROW]);

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
    // No files found in batch query
    mockSelectBulkOrder([], [ACCOUNT_ROW]);

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
    mockSelectBulkOrder([FILE_ROW], [ACCOUNT_ROW]);

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
    mockSelectBulkOrder([FILE_ROW], [ACCOUNT_ROW]);
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
    mockSelectBulkOrder([FILE_ROW], [ACCOUNT_ROW]);
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
    mockSelectBulkOrder([FILE_ROW], [ACCOUNT_ROW]);
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

// ---------------------------------------------------------------------------
// POST /files/metadata - Update metadata on multiple files
// ---------------------------------------------------------------------------
describe("POST /files/metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockReturnValue(SESSION);
    vi.mocked(verifyProjectAccess).mockResolvedValue({ id: "proj_001" } as never);
    vi.mocked(verifyAccountMembership).mockResolvedValue("owner");
  });

  it("returns 200 with succeeded list when updating rating", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([FILE_ROW]),
        }),
      }),
    } as never);

    vi.mocked(db.update).mockReturnValue({
      set: () => ({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: { rating: 5 },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toContain("file_001");
    expect(body.data.failed).toHaveLength(0);
  });

  it("returns 200 with succeeded list when updating status", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([FILE_ROW]),
        }),
      }),
    } as never);

    vi.mocked(db.update).mockReturnValue({
      set: () => ({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: { status: "approved" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toContain("file_001");
  });

  it("returns 200 with succeeded list when updating keywords", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([FILE_ROW]),
        }),
      }),
    } as never);

    vi.mocked(db.update).mockReturnValue({
      set: () => ({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: { keywords: ["nature", "sunset"] },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toContain("file_001");
  });

  it("returns 200 with succeeded list when updating notes", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([FILE_ROW]),
        }),
      }),
    } as never);

    vi.mocked(db.update).mockReturnValue({
      set: () => ({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: { notes: "Updated notes" },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toContain("file_001");
  });

  it("returns 200 with succeeded list when updating assignee_id", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([FILE_ROW]),
        }),
      }),
    } as never);

    vi.mocked(db.update).mockReturnValue({
      set: () => ({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: { assignee_id: "usr_123" },
      }),
    });

    expect(res.status).toBe(200);
    expect(verifyAccountMembership).toHaveBeenCalledWith("usr_123", "acc_xyz");
  });

  it("returns 500 when file_ids is missing", async () => {
    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metadata: { rating: 5 },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when file_ids is empty array", async () => {
    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: [],
        metadata: { rating: 5 },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when more than 100 file_ids are provided", async () => {
    const fileIds = Array.from({ length: 101 }, (_, i) => `file_${i}`);
    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: fileIds,
        metadata: { rating: 5 },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when metadata is missing", async () => {
    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
      }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when rating is out of range (less than 1)", async () => {
    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: { rating: 0 },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when rating is out of range (greater than 5)", async () => {
    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: { rating: 6 },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when keywords is not an array of strings", async () => {
    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: { keywords: [1, 2, 3] },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 500 when assignee is not a member of the account", async () => {
    vi.mocked(verifyAccountMembership).mockResolvedValue(null);

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: { assignee_id: "usr_nonmember" },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("adds file to failed list when file is not found", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never);

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_nonexistent"],
        metadata: { rating: 5 },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toHaveLength(0);
    expect(body.data.failed[0].id).toBe("file_nonexistent");
    expect(body.data.failed[0].error).toBe("File not found");
  });

  it("adds file to failed list when project access is denied", async () => {
    vi.mocked(verifyProjectAccess).mockResolvedValueOnce(null);
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([FILE_ROW]),
        }),
      }),
    } as never);

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: { rating: 5 },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.failed[0].id).toBe("file_001");
    expect(body.data.failed[0].error).toBe("Access denied");
  });

  it("returns 500 when custom field does not exist", async () => {
    // First call: custom fields query
    // Second call: file lookup
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // Custom fields query - return empty
        return {
          from: () => ({
            where: () => [], // Return array directly (no limit)
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_nonexistent: "value",
          },
        },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("returns 200 merging custom metadata with existing values", async () => {
    const fileWithMetadata = {
      ...FILE_ROW,
      customMetadata: { cf_existing: "old_value" },
    };

    // First call: custom fields query
    // Second call: file lookup
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // Custom fields query
        return {
          from: () => ({
            where: () => [{ id: "cf_text", type: "text", options: null }],
          }),
        } as never;
      }
      // File lookup
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([fileWithMetadata]),
          }),
        }),
      } as never;
    });

    vi.mocked(db.update).mockReturnValue({
      set: () => ({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_text: "new_value",
          },
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.succeeded).toContain("file_001");
  });

  it("clears custom field when value is null", async () => {
    const fileWithMetadata = {
      ...FILE_ROW,
      customMetadata: { cf_text: "existing_value" },
    };

    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_text", type: "text", options: null }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([fileWithMetadata]),
          }),
        }),
      } as never;
    });

    const setMock = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(db.update).mockReturnValue({ set: setMock } as never);

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_text: null,
          },
        },
      }),
    });

    expect(res.status).toBe(200);
    // Verify customMetadata was updated without the cleared field
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customMetadata: {},
      })
    );
  });

  it("validates number field rejects non-number", async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_number", type: "number", options: null }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_number: "not a number",
          },
        },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("validates date field accepts ISO 8601 string", async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_date", type: "date", options: null }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    vi.mocked(db.update).mockReturnValue({
      set: () => ({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_date: "2024-01-15T10:00:00Z",
          },
        },
      }),
    });

    expect(res.status).toBe(200);
  });

  it("validates date field rejects invalid date string", async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_date", type: "date", options: null }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_date: "not-a-date",
          },
        },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("validates single_select against options", async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_select", type: "single_select", options: ["option1", "option2"] }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    vi.mocked(db.update).mockReturnValue({
      set: () => ({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_select: "option1",
          },
        },
      }),
    });

    expect(res.status).toBe(200);
  });

  it("validates single_select rejects value not in options", async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_select", type: "single_select", options: ["option1", "option2"] }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_select: "invalid_option",
          },
        },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("validates multi_select array against options", async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_multi", type: "multi_select", options: ["a", "b", "c"] }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    vi.mocked(db.update).mockReturnValue({
      set: () => ({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_multi: ["a", "b"],
          },
        },
      }),
    });

    expect(res.status).toBe(200);
  });

  it("validates multi_select rejects value not in options", async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_multi", type: "multi_select", options: ["a", "b", "c"] }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_multi: ["a", "invalid"],
          },
        },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("validates multi_select rejects non-string array", async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_multi", type: "multi_select", options: ["a", "b"] }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_multi: [1, 2, 3],
          },
        },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("validates checkbox is boolean", async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_checkbox", type: "checkbox", options: null }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    vi.mocked(db.update).mockReturnValue({
      set: () => ({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_checkbox: true,
          },
        },
      }),
    });

    expect(res.status).toBe(200);
  });

  it("validates checkbox rejects non-boolean", async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_checkbox", type: "checkbox", options: null }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_checkbox: "yes",
          },
        },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("validates user field accepts string", async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_user", type: "user", options: null }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    vi.mocked(db.update).mockReturnValue({
      set: () => ({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_user: "usr_123",
          },
        },
      }),
    });

    expect(res.status).toBe(200);
  });

  it("validates user field rejects non-string", async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_user", type: "user", options: null }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_user: 123,
          },
        },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("validates rating field accepts integer 1-5", async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_rating", type: "rating", options: null }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    vi.mocked(db.update).mockReturnValue({
      set: () => ({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_rating: 4,
          },
        },
      }),
    });

    expect(res.status).toBe(200);
  });

  it("validates rating field rejects non-integer", async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_rating", type: "rating", options: null }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_rating: 3.5,
          },
        },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("validates rating field rejects out of range", async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_rating", type: "rating", options: null }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_rating: 6,
          },
        },
      }),
    });

    expect(res.status).toBe(500);
  });

  it("validates url field accepts valid URL", async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_url", type: "url", options: null }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    vi.mocked(db.update).mockReturnValue({
      set: () => ({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_url: "https://example.com",
          },
        },
      }),
    });

    expect(res.status).toBe(200);
  });

  it("validates url field rejects invalid URL", async () => {
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: () => ({
            where: () => [{ id: "cf_url", type: "url", options: null }],
          }),
        } as never;
      }
      return {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([FILE_ROW]),
          }),
        }),
      } as never;
    });

    const res = await app.request("/files/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_ids: ["file_001"],
        metadata: {
          custom: {
            cf_url: "not-a-url",
          },
        },
      }),
    });

    expect(res.status).toBe(500);
  });
});
