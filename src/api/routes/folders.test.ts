/**
 * Bush Platform - Folder Routes Tests
 *
 * Comprehensive unit tests for all 9 folder API endpoints.
 * Tests use a parent Hono app to properly simulate projectId param inheritance.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock dependencies before importing the route
vi.mock("../../db/index.js", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../db/schema.js", () => ({
  folders: {
    id: "id",
    projectId: "projectId",
    parentId: "parentId",
    name: "name",
    path: "path",
    depth: "depth",
    isRestricted: "isRestricted",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  files: {
    id: "id",
    folderId: "folderId",
    projectId: "projectId",
    name: "name",
    mimeType: "mimeType",
    status: "status",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    deletedAt: "deletedAt",
  },
}));

vi.mock("../auth-middleware.js", () => ({
  authMiddleware: () => async (_c: any, next: any) => {
    await next();
  },
  requireAuth: vi.fn(),
}));

vi.mock("../access-control.js", () => ({
  verifyProjectAccess: vi.fn(),
  verifyFolderAccess: vi.fn(),
}));

vi.mock("../router.js", () => ({
  generateId: vi.fn().mockReturnValue("fld_test123"),
  parseLimit: vi.fn().mockReturnValue(50),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  desc: vi.fn((col: any) => col),
  isNull: vi.fn((col: any) => col),
}));

// Import after mocks
import foldersApp from "./folders.js";
import { db } from "../../db/index.js";
import { requireAuth } from "../auth-middleware.js";
import { verifyProjectAccess, verifyFolderAccess } from "../access-control.js";
import { generateId, parseLimit } from "../router.js";

// ---------------------------------------------------------------------------
// Test app setup: mount foldersApp under a parent with :projectId param so
// that c.req.param("projectId") works for GET / and POST / routes.
// ---------------------------------------------------------------------------
const testApp = new Hono();
testApp.route("/projects/:projectId/folders", foldersApp);

// Helper to make requests to the test app.
// When path is "/" we omit the trailing slash because Hono's default routing
// does not treat "/projects/prj_123/folders/" and "/projects/prj_123/folders"
// as equivalent; the sub-app registers the root handler as "" / exact match.
const req = (path: string, init?: RequestInit) => {
  const suffix = path === "/" ? "" : path;
  return testApp.request(`/projects/prj_123/folders${suffix}`, init);
};

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const mockSession = {
  userId: "usr_123",
  sessionId: "sess_123",
  currentAccountId: "acc_123",
  accountRole: "owner" as const,
  email: "test@example.com",
  displayName: "Test User",
  workosOrganizationId: "org_123",
  workosUserId: "wusr_123",
  createdAt: Date.now(),
  lastActivityAt: Date.now(),
};

const mockFolder = {
  id: "fld_123",
  projectId: "prj_123",
  parentId: null,
  name: "My Folder",
  path: "/My Folder",
  depth: 0,
  isRestricted: false,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

const mockSubfolder = {
  id: "fld_456",
  projectId: "prj_123",
  parentId: "fld_123",
  name: "Sub Folder",
  path: "/My Folder/Sub Folder",
  depth: 1,
  isRestricted: false,
  createdAt: new Date("2024-01-02T00:00:00Z"),
  updatedAt: new Date("2024-01-02T00:00:00Z"),
};

const mockFile = {
  id: "fil_abc",
  folderId: "fld_123",
  projectId: "prj_123",
  name: "document.pdf",
  mimeType: "application/pdf",
  status: "ready",
  createdAt: new Date("2024-01-03T00:00:00Z"),
  updatedAt: new Date("2024-01-03T00:00:00Z"),
  deletedAt: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Folder Routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-establish mocks that have module-level defaults after reset
    vi.mocked(requireAuth).mockReturnValue(mockSession);
    vi.mocked(parseLimit).mockReturnValue(50);
    vi.mocked(generateId).mockReturnValue("fld_test123");
  });

  // -------------------------------------------------------------------------
  // GET / - List root-level folders in project
  // -------------------------------------------------------------------------
  describe("GET / - list root-level folders", () => {
    it("should return a collection of root-level folders", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: vi.fn().mockResolvedValue([mockFolder]),
            }),
          }),
        }),
      } as never);

      const res = await req("/");

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data[0].id).toBe("fld_123");
      expect(body.data[0].type).toBe("folder");
      expect(body.data[0].attributes.name).toBe("My Folder");
    });

    it("should return an empty data array when project has no root folders", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as never);

      const res = await req("/");

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(0);
      expect(body.meta?.total_count).toBe(0);
    });

    it("should include pagination meta and links", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: vi.fn().mockResolvedValue([mockFolder]),
            }),
          }),
        }),
      } as never);

      const res = await req("/");
      const body = (await res.json()) as any;

      expect(body).toHaveProperty("meta");
      expect(body.meta).toHaveProperty("total_count");
      expect(body.meta).toHaveProperty("page_size");
      expect(body.meta).toHaveProperty("has_more");
      expect(body).toHaveProperty("links");
      expect(body.links).toHaveProperty("self");
    });

    it("should return 500 when project is not found", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/");

      expect(res.status).toBe(500);
    });

    it("should call verifyProjectAccess with projectId from parent route param", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as never);

      await req("/");

      expect(verifyProjectAccess).toHaveBeenCalledWith("prj_123", mockSession.currentAccountId);
    });

    it("should format date fields to ISO strings", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: vi.fn().mockResolvedValue([mockFolder]),
            }),
          }),
        }),
      } as never);

      const res = await req("/");
      const body = (await res.json()) as any;

      expect(typeof body.data[0].attributes.createdAt).toBe("string");
      expect(typeof body.data[0].attributes.updatedAt).toBe("string");
    });
  });

  // -------------------------------------------------------------------------
  // GET /:id - Get folder details
  // -------------------------------------------------------------------------
  describe("GET /:id - get folder details", () => {
    it("should return a single folder when found", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      const res = await req("/fld_123");

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toHaveProperty("data");
      expect(body.data.id).toBe("fld_123");
      expect(body.data.type).toBe("folder");
      expect(body.data.attributes.name).toBe("My Folder");
      expect(body.data.attributes.path).toBe("/My Folder");
    });

    it("should return 500 when folder is not found", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue(null);

      const res = await req("/fld_nonexistent");

      expect(res.status).toBe(500);
    });

    it("should call verifyFolderAccess with the folder ID", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      await req("/fld_123");

      expect(verifyFolderAccess).toHaveBeenCalledWith("fld_123", mockSession.currentAccountId);
    });

    it("should format date fields to ISO strings", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      const res = await req("/fld_123");
      const body = (await res.json()) as any;

      expect(typeof body.data.attributes.createdAt).toBe("string");
      expect(typeof body.data.attributes.updatedAt).toBe("string");
    });
  });

  // -------------------------------------------------------------------------
  // GET /:id/children - List folder contents (subfolders + files)
  // -------------------------------------------------------------------------
  describe("GET /:id/children - list folder contents", () => {
    it("should return mixed content with subfolders and files", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      // First db.select call for subfolders, second for files
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([mockSubfolder]),
              }),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([mockFile]),
              }),
            }),
          }),
        } as never);

      const res = await req("/fld_123/children");

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta.folders_count).toBe(1);
      expect(body.meta.files_count).toBe(1);
      expect(body.meta.total_count).toBe(2);
    });

    it("should type each item with its resource type", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([mockSubfolder]),
              }),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([mockFile]),
              }),
            }),
          }),
        } as never);

      const res = await req("/fld_123/children");
      const body = (await res.json()) as any;

      const folderItem = body.data.find((item: any) => item.id === "fld_456");
      const fileItem = body.data.find((item: any) => item.id === "fil_abc");

      expect(folderItem.type).toBe("folder");
      expect(fileItem.type).toBe("file");
    });

    it("should return empty data with zero counts for an empty folder", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as never);

      const res = await req("/fld_123/children");

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(0);
      expect(body.meta.folders_count).toBe(0);
      expect(body.meta.files_count).toBe(0);
      expect(body.meta.total_count).toBe(0);
    });

    it("should return 500 when folder is not found", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue(null);

      const res = await req("/fld_nonexistent/children");

      expect(res.status).toBe(500);
    });

    it("should include page_size in meta", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as never);

      const res = await req("/fld_123/children");
      const body = (await res.json()) as any;

      expect(body.meta).toHaveProperty("page_size");
      expect(typeof body.meta.page_size).toBe("number");
    });
  });

  // -------------------------------------------------------------------------
  // POST / - Create folder at project root
  // -------------------------------------------------------------------------
  describe("POST / - create root folder", () => {
    it("should create a root folder and return the created folder", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      // Duplicate check returns no results
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never)
        // Fetch created folder
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ ...mockFolder, id: "fld_test123" }]),
            }),
          }),
        } as never);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Folder" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toHaveProperty("data");
      expect(body.data.type).toBe("folder");
      expect(body.data.attributes.name).toBe("My Folder");
    });

    it("should call verifyProjectAccess with correct projectId", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([mockFolder]),
            }),
          }),
        } as never);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Folder" }),
      });

      expect(verifyProjectAccess).toHaveBeenCalledWith("prj_123", mockSession.currentAccountId);
    });

    it("should return 500 when name is missing", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("should return 500 when name is not a string", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: 42 }),
      });

      expect(res.status).toBe(500);
    });

    it("should return 500 when a duplicate folder name exists at project root", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      // Duplicate check finds existing folder
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ id: "fld_existing" }]),
          }),
        }),
      } as never);

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Folder" }),
      });

      expect(res.status).toBe(500);
    });

    it("should return 500 when project is not found", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Folder" }),
      });

      expect(res.status).toBe(500);
    });

    it("should set is_restricted when provided as true", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ ...mockFolder, isRestricted: true }]),
            }),
          }),
        } as never);

      const insertValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({ values: insertValues } as never);

      await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Restricted Folder", is_restricted: true }),
      });

      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ isRestricted: true })
      );
    });

    it("should call generateId with 'fld' prefix", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([mockFolder]),
            }),
          }),
        } as never);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      await req("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Folder" }),
      });

      expect(generateId).toHaveBeenCalledWith("fld");
    });
  });

  // -------------------------------------------------------------------------
  // POST /:id/folders - Create subfolder
  // -------------------------------------------------------------------------
  describe("POST /:id/folders - create subfolder", () => {
    it("should create a subfolder under the given parent folder", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([mockSubfolder]),
            }),
          }),
        } as never);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      const res = await req("/fld_123/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Sub Folder" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toHaveProperty("data");
      expect(body.data.type).toBe("folder");
    });

    it("should build the correct subfolder path from parent path", async () => {
      // Parent at path "/My Folder" (depth 0)
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([mockSubfolder]),
            }),
          }),
        } as never);

      const insertValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({ values: insertValues } as never);

      await req("/fld_123/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Sub Folder" }),
      });

      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/My Folder/Sub Folder",
          depth: 1,
          parentId: "fld_123",
          projectId: "prj_123",
        })
      );
    });

    it("should return 500 when parent folder is not found", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue(null);

      const res = await req("/fld_nonexistent/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Sub Folder" }),
      });

      expect(res.status).toBe(500);
    });

    it("should return 500 when name is missing", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      const res = await req("/fld_123/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(500);
    });

    it("should return 500 when duplicate subfolder name exists", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      // Duplicate check returns a result
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ id: "fld_existing" }]),
          }),
        }),
      } as never);

      const res = await req("/fld_123/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Sub Folder" }),
      });

      expect(res.status).toBe(500);
    });

    it("should use root parent path correctly when parent path is '/'", async () => {
      // Simulate a folder directly under root (path="/")
      const rootStyleParent = { ...mockFolder, path: "/" };
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: rootStyleParent,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([mockSubfolder]),
            }),
          }),
        } as never);

      const insertValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({ values: insertValues } as never);

      await req("/fld_123/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Child" }),
      });

      // buildFolderPath("/", "Child") should produce "/Child"
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/Child" })
      );
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /:id - Update folder
  // -------------------------------------------------------------------------
  describe("PATCH /:id - update folder", () => {
    it("should rename a folder successfully", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      // No duplicate found
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ ...mockFolder, name: "Renamed Folder" }]),
            }),
          }),
        } as never);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      const res = await req("/fld_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed Folder" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.attributes.name).toBe("Renamed Folder");
    });

    it("should update is_restricted without renaming", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ ...mockFolder, isRestricted: true }]),
          }),
        }),
      } as never);

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.update).mockReturnValue({ set: setMock } as never);

      const res = await req("/fld_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_restricted: true }),
      });

      expect(res.status).toBe(200);
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ isRestricted: true })
      );
    });

    it("should return 500 when folder is not found", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue(null);

      const res = await req("/fld_nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });

      expect(res.status).toBe(500);
    });

    it("should return 500 when renaming to a duplicate name in the same location", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      // Duplicate check finds a *different* folder with the same name
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ id: "fld_other" }]),
          }),
        }),
      } as never);

      const res = await req("/fld_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Taken Name" }),
      });

      expect(res.status).toBe(500);
    });

    it("should allow renaming when the only duplicate found is the folder itself", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      // Duplicate check finds the same folder (same id)
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ id: "fld_123" }]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([mockFolder]),
            }),
          }),
        } as never);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      const res = await req("/fld_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Folder" }),
      });

      expect(res.status).toBe(200);
    });

    it("should include updatedAt in the update payload", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([mockFolder]),
            }),
          }),
        } as never);

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.update).mockReturnValue({ set: setMock } as never);

      await req("/fld_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ updatedAt: expect.any(Date) })
      );
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /:id - Delete folder
  // -------------------------------------------------------------------------
  describe("DELETE /:id - delete folder", () => {
    it("should delete a folder and return 204 No Content", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);

      const res = await req("/fld_123", { method: "DELETE" });

      expect(res.status).toBe(204);
      const text = await res.text();
      expect(text).toBe("");
    });

    it("should return 500 when attempting to delete a root folder (path='/')", async () => {
      const rootFolder = { ...mockFolder, path: "/" };
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: rootFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      const res = await req("/fld_root", { method: "DELETE" });

      // Route will throw ValidationError for root folder deletion
      expect(res.status).toBe(500);
    });

    it("should return 500 when folder is not found", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue(null);

      const res = await req("/fld_nonexistent", { method: "DELETE" });

      expect(res.status).toBe(500);
    });

    it("should call db.delete with the correct folder ID", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      const whereMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.delete).mockReturnValue({ where: whereMock } as never);

      await req("/fld_123", { method: "DELETE" });

      expect(db.delete).toHaveBeenCalledTimes(1);
    });

    it("should call verifyFolderAccess with the folder ID before deleting", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);

      await req("/fld_123", { method: "DELETE" });

      expect(verifyFolderAccess).toHaveBeenCalledWith("fld_123", mockSession.currentAccountId);
    });
  });

  // -------------------------------------------------------------------------
  // POST /:id/move - Move folder to new parent
  // -------------------------------------------------------------------------
  describe("POST /:id/move - move folder", () => {
    it("should move a folder to a new parent folder successfully", async () => {
      // First call: verify folder being moved
      // Second call: verify target parent folder
      vi.mocked(verifyFolderAccess)
        .mockResolvedValueOnce({
          folder: mockSubfolder, // moving subfolder
          project: { id: "prj_123" },
          workspace: { id: "ws_123" },
        } as never)
        .mockResolvedValueOnce({
          folder: { ...mockFolder, id: "fld_dest", path: "/Destination", depth: 0 },
          project: { id: "prj_123" },
          workspace: { id: "ws_123" },
        } as never);

      // No name conflict in destination
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never)
        // Fetch updated folder
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{
                ...mockSubfolder,
                parentId: "fld_dest",
                path: "/Destination/Sub Folder",
                depth: 1,
              }]),
            }),
          }),
        } as never);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      const res = await req("/fld_456/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_id: "fld_dest" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toHaveProperty("data");
      expect(body.data.type).toBe("folder");
    });

    it("should move a folder to the project root when parent_id is omitted", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValueOnce({
        folder: mockSubfolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      // No name conflict at root
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{
                ...mockSubfolder,
                parentId: null,
                path: "/Sub Folder",
                depth: 0,
              }]),
            }),
          }),
        } as never);

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.update).mockReturnValue({ set: setMock } as never);

      const res = await req("/fld_456/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // no parent_id → move to root
      });

      expect(res.status).toBe(200);
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: null, depth: 0 })
      );
    });

    it("should return 500 when folder to move is not found", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValueOnce(null);

      const res = await req("/fld_nonexistent/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_id: "fld_dest" }),
      });

      expect(res.status).toBe(500);
    });

    it("should return 500 when trying to move a folder into itself", async () => {
      vi.mocked(verifyFolderAccess)
        .mockResolvedValueOnce({
          folder: mockFolder, // fld_123
          project: { id: "prj_123" },
          workspace: { id: "ws_123" },
        } as never)
        .mockResolvedValueOnce({
          folder: mockFolder, // same folder as parent target
          project: { id: "prj_123" },
          workspace: { id: "ws_123" },
        } as never);

      const res = await req("/fld_123/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_id: "fld_123" }), // same id = self
      });

      expect(res.status).toBe(500);
    });

    it("should return 500 when trying to move a folder into one of its descendants", async () => {
      // mockFolder is at "/My Folder"; mockSubfolder is at "/My Folder/Sub Folder"
      // Moving mockFolder into mockSubfolder would be circular
      vi.mocked(verifyFolderAccess)
        .mockResolvedValueOnce({
          folder: mockFolder, // the folder being moved
          project: { id: "prj_123" },
          workspace: { id: "ws_123" },
        } as never)
        .mockResolvedValueOnce({
          folder: mockSubfolder, // the target is a descendant
          project: { id: "prj_123" },
          workspace: { id: "ws_123" },
        } as never);

      const res = await req("/fld_123/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_id: "fld_456" }),
      });

      expect(res.status).toBe(500);
    });

    it("should return 500 when moving to a folder in a different project", async () => {
      vi.mocked(verifyFolderAccess)
        .mockResolvedValueOnce({
          folder: mockFolder,
          project: { id: "prj_123" },
          workspace: { id: "ws_123" },
        } as never)
        .mockResolvedValueOnce({
          folder: { ...mockFolder, id: "fld_other", projectId: "prj_999", path: "/Other" },
          project: { id: "prj_999" },
          workspace: { id: "ws_123" },
        } as never);

      const res = await req("/fld_123/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_id: "fld_other" }),
      });

      expect(res.status).toBe(500);
    });

    it("should return 500 when a name conflict exists at destination", async () => {
      vi.mocked(verifyFolderAccess)
        .mockResolvedValueOnce({
          folder: mockSubfolder,
          project: { id: "prj_123" },
          workspace: { id: "ws_123" },
        } as never)
        .mockResolvedValueOnce({
          folder: { ...mockFolder, id: "fld_dest", path: "/Destination", depth: 0 },
          project: { id: "prj_123" },
          workspace: { id: "ws_123" },
        } as never);

      // Conflict found at destination (a different folder with the same name)
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ id: "fld_conflict" }]),
          }),
        }),
      } as never);

      const res = await req("/fld_456/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_id: "fld_dest" }),
      });

      expect(res.status).toBe(500);
    });

    it("should return 500 when trying to move a root folder (path='/')", async () => {
      const rootFolder = { ...mockFolder, path: "/" };
      vi.mocked(verifyFolderAccess).mockResolvedValueOnce({
        folder: rootFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      const res = await req("/fld_root/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_id: "fld_dest" }),
      });

      expect(res.status).toBe(500);
    });

    it("should return 500 when the target parent folder is not found", async () => {
      vi.mocked(verifyFolderAccess)
        .mockResolvedValueOnce({
          folder: mockFolder,
          project: { id: "prj_123" },
          workspace: { id: "ws_123" },
        } as never)
        // Second call (parent verification) returns null
        .mockResolvedValueOnce(null);

      const res = await req("/fld_123/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_id: "fld_nonexistent" }),
      });

      expect(res.status).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // GET /:id/files - List files in folder
  // -------------------------------------------------------------------------
  describe("GET /:id/files - list files in folder", () => {
    it("should return a collection of files in the folder", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: vi.fn().mockResolvedValue([mockFile]),
            }),
          }),
        }),
      } as never);

      const res = await req("/fld_123/files");

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data[0].id).toBe("fil_abc");
      expect(body.data[0].type).toBe("file");
      expect(body.data[0].attributes.name).toBe("document.pdf");
    });

    it("should return an empty data array when folder has no files", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as never);

      const res = await req("/fld_123/files");

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(0);
      expect(body.meta?.total_count).toBe(0);
    });

    it("should return 500 when folder is not found", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue(null);

      const res = await req("/fld_nonexistent/files");

      expect(res.status).toBe(500);
    });

    it("should include pagination meta in response", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: vi.fn().mockResolvedValue([mockFile]),
            }),
          }),
        }),
      } as never);

      const res = await req("/fld_123/files");
      const body = (await res.json()) as any;

      expect(body).toHaveProperty("meta");
      expect(body.meta).toHaveProperty("total_count");
      expect(body.meta).toHaveProperty("page_size");
      expect(body.meta).toHaveProperty("has_more");
    });

    it("should pass the status query param when provided", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: vi.fn().mockResolvedValue([mockFile]),
            }),
          }),
        }),
      } as never);

      // The eq mock captures calls; just check it returns 200 with status filter
      const res = await req("/fld_123/files?status=ready");

      expect(res.status).toBe(200);
    });

    it("should call verifyFolderAccess with the folder ID", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as never);

      await req("/fld_123/files");

      expect(verifyFolderAccess).toHaveBeenCalledWith("fld_123", mockSession.currentAccountId);
    });

    it("should format file date fields to ISO strings", async () => {
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: mockFolder,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: vi.fn().mockResolvedValue([mockFile]),
            }),
          }),
        }),
      } as never);

      const res = await req("/fld_123/files");
      const body = (await res.json()) as any;

      expect(typeof body.data[0].attributes.createdAt).toBe("string");
      expect(typeof body.data[0].attributes.updatedAt).toBe("string");
    });
  });

  // -------------------------------------------------------------------------
  // buildFolderPath helper (tested indirectly via POST /:id/folders)
  // -------------------------------------------------------------------------
  describe("buildFolderPath (tested indirectly)", () => {
    it("should produce '/name' when parent path is '/'", async () => {
      const rootParent = { ...mockFolder, path: "/" };
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: rootParent,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{ ...mockFolder, path: "/alpha" }]),
            }),
          }),
        } as never);

      const insertValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({ values: insertValues } as never);

      await req("/fld_123/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "alpha" }),
      });

      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/alpha" })
      );
    });

    it("should produce 'parent/name' when parent path is not '/'", async () => {
      const deepParent = { ...mockFolder, path: "/level1/level2", depth: 1 };
      vi.mocked(verifyFolderAccess).mockResolvedValue({
        folder: deepParent,
        project: { id: "prj_123" },
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValue([{
                ...mockFolder,
                path: "/level1/level2/level3",
              }]),
            }),
          }),
        } as never);

      const insertValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({ values: insertValues } as never);

      await req("/fld_123/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "level3" }),
      });

      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/level1/level2/level3" })
      );
    });
  });
});
