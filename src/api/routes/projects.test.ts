/**
 * Bush Platform - Project Routes Tests
 *
 * Unit tests for project API endpoints.
 * Tests all 5 endpoints: GET /, GET /:id, POST /, PATCH /:id, DELETE /:id
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the route
vi.mock("../../db/index.js", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../db/schema.js", () => ({
  projects: {
    id: "id",
    workspaceId: "workspaceId",
    name: "name",
    description: "description",
    isRestricted: "isRestricted",
    archivedAt: "archivedAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  projectPermissions: {
    id: "id",
    projectId: "projectId",
    userId: "userId",
    permission: "permission",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
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
}));

vi.mock("../auth-middleware.js", () => ({
  authMiddleware: () => async (_c: any, next: any) => {
    await next();
  },
  requireAuth: vi.fn(),
}));

vi.mock("../access-control.js", () => ({
  verifyWorkspaceAccess: vi.fn(),
  verifyProjectAccess: vi.fn(),
}));

vi.mock("../router.js", () => ({
  generateId: vi.fn().mockReturnValue("prj_test123"),
  parseLimit: vi.fn().mockReturnValue(50),
}));

// Import after mocks
import app from "./projects.js";
import { db } from "../../db/index.js";
import { requireAuth } from "../auth-middleware.js";
import { verifyWorkspaceAccess, verifyProjectAccess } from "../access-control.js";
import { generateId, parseLimit } from "../router.js";

// Mock session returned by requireAuth
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

// Representative project record returned by the database
const mockProject = {
  id: "prj_123",
  workspaceId: "ws_123",
  name: "Test Project",
  description: "A test project",
  isRestricted: false,
  archivedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("Project Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: requireAuth always returns the mock session
    vi.mocked(requireAuth).mockReturnValue(mockSession);
  });

  // ---------------------------------------------------------------------------
  // GET / - List projects for a workspace
  // ---------------------------------------------------------------------------
  describe("GET / - list projects", () => {
    it("should return a collection of projects for a valid workspace_id", async () => {
      vi.mocked(verifyWorkspaceAccess).mockResolvedValue({
        id: "ws_123",
        name: "Test Workspace",
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: vi.fn().mockResolvedValue([mockProject]),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/?workspace_id=ws_123");

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data[0].id).toBe("prj_123");
      expect(body.data[0].type).toBe("project");
      expect(body.data[0].attributes.name).toBe("Test Project");
    });

    it("should return 200 with empty data array when workspace has no projects", async () => {
      vi.mocked(verifyWorkspaceAccess).mockResolvedValue({
        id: "ws_123",
        name: "Test Workspace",
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

      const res = await app.request("/?workspace_id=ws_123");

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(0);
      expect(body.meta?.total_count).toBe(0);
    });

    it("should include pagination metadata in the response", async () => {
      vi.mocked(verifyWorkspaceAccess).mockResolvedValue({
        id: "ws_123",
        name: "Test Workspace",
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: vi.fn().mockResolvedValue([mockProject]),
            }),
          }),
        }),
      } as never);

      const res = await app.request("/?workspace_id=ws_123");
      const body = (await res.json()) as any;

      expect(body).toHaveProperty("meta");
      expect(body.meta).toHaveProperty("total_count");
      expect(body.meta).toHaveProperty("page_size");
      expect(body.meta).toHaveProperty("has_more");
      expect(body).toHaveProperty("links");
      expect(body.links).toHaveProperty("self");
    });

    it("should return 500 when workspace_id query param is missing", async () => {
      const res = await app.request("/");

      expect(res.status).toBe(500);
    });

    it("should return 500 when workspace is not found", async () => {
      vi.mocked(verifyWorkspaceAccess).mockResolvedValue(null);

      const res = await app.request("/?workspace_id=ws_nonexistent");

      expect(res.status).toBe(500);
    });

    it("should call verifyWorkspaceAccess with the correct arguments", async () => {
      vi.mocked(verifyWorkspaceAccess).mockResolvedValue({
        id: "ws_123",
        name: "Test Workspace",
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

      await app.request("/?workspace_id=ws_123");

      expect(verifyWorkspaceAccess).toHaveBeenCalledWith("ws_123", mockSession.currentAccountId);
    });

    it("should call parseLimit with the limit query parameter", async () => {
      vi.mocked(verifyWorkspaceAccess).mockResolvedValue({
        id: "ws_123",
        name: "Test Workspace",
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

      await app.request("/?workspace_id=ws_123&limit=25");

      expect(parseLimit).toHaveBeenCalledWith("25");
    });
  });

  // ---------------------------------------------------------------------------
  // GET /:id - Get project by ID
  // ---------------------------------------------------------------------------
  describe("GET /:id - get project by ID", () => {
    it("should return a single project when found", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: mockProject,
        workspace: { id: "ws_123" },
      } as never);

      const res = await app.request("/prj_123");

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toHaveProperty("data");
      expect(body.data.id).toBe("prj_123");
      expect(body.data.type).toBe("project");
      expect(body.data.attributes.name).toBe("Test Project");
    });

    it("should return 500 when project is not found", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await app.request("/prj_nonexistent");

      expect(res.status).toBe(500);
    });

    it("should call verifyProjectAccess with the project ID and current account ID", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: mockProject,
        workspace: { id: "ws_123" },
      } as never);

      await app.request("/prj_123");

      expect(verifyProjectAccess).toHaveBeenCalledWith("prj_123", mockSession.currentAccountId);
    });

    it("should format date fields to ISO strings in the response", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: mockProject,
        workspace: { id: "ws_123" },
      } as never);

      const res = await app.request("/prj_123");
      const body = (await res.json()) as any;

      expect(typeof body.data.attributes.createdAt).toBe("string");
      expect(typeof body.data.attributes.updatedAt).toBe("string");
    });
  });

  // ---------------------------------------------------------------------------
  // POST / - Create project
  // ---------------------------------------------------------------------------
  describe("POST / - create project", () => {
    it("should create a project with root folder and permission, returning 200", async () => {
      vi.mocked(generateId)
        .mockReturnValueOnce("prj_test1")
        .mockReturnValueOnce("fld_test1")
        .mockReturnValueOnce("pp_test1");

      vi.mocked(verifyWorkspaceAccess).mockResolvedValue({
        id: "ws_123",
        name: "Test Workspace",
      } as never);

      vi.mocked(db.insert)
        .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never)
        .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never)
        .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never);

      // Final select to fetch the created project
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ ...mockProject, id: "prj_test1" }]),
          }),
        }),
      } as never);

      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Project",
          workspace_id: "ws_123",
          description: "A brand new project",
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body).toHaveProperty("data");
      expect(body.data.id).toBe("prj_test1");
      expect(body.data.type).toBe("project");
    });

    it("should call generateId three times (project, folder, permission)", async () => {
      vi.mocked(generateId)
        .mockReturnValueOnce("prj_test1")
        .mockReturnValueOnce("fld_test1")
        .mockReturnValueOnce("pp_test1");

      vi.mocked(verifyWorkspaceAccess).mockResolvedValue({
        id: "ws_123",
        name: "Test Workspace",
      } as never);

      vi.mocked(db.insert)
        .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never)
        .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never)
        .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ ...mockProject, id: "prj_test1" }]),
          }),
        }),
      } as never);

      await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Project", workspace_id: "ws_123" }),
      });

      expect(generateId).toHaveBeenCalledTimes(3);
      expect(generateId).toHaveBeenNthCalledWith(1, "prj");
      expect(generateId).toHaveBeenNthCalledWith(2, "fld");
      expect(generateId).toHaveBeenNthCalledWith(3, "pp");
    });

    it("should call db.insert three times (project, folder, permission)", async () => {
      vi.mocked(generateId)
        .mockReturnValueOnce("prj_test1")
        .mockReturnValueOnce("fld_test1")
        .mockReturnValueOnce("pp_test1");

      vi.mocked(verifyWorkspaceAccess).mockResolvedValue({
        id: "ws_123",
        name: "Test Workspace",
      } as never);

      const insertMock1 = { values: vi.fn().mockResolvedValue(undefined) };
      const insertMock2 = { values: vi.fn().mockResolvedValue(undefined) };
      const insertMock3 = { values: vi.fn().mockResolvedValue(undefined) };

      vi.mocked(db.insert)
        .mockReturnValueOnce(insertMock1 as never)
        .mockReturnValueOnce(insertMock2 as never)
        .mockReturnValueOnce(insertMock3 as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ ...mockProject, id: "prj_test1" }]),
          }),
        }),
      } as never);

      await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Project", workspace_id: "ws_123" }),
      });

      expect(db.insert).toHaveBeenCalledTimes(3);
      expect(insertMock1.values).toHaveBeenCalledTimes(1);
      expect(insertMock2.values).toHaveBeenCalledTimes(1);
      expect(insertMock3.values).toHaveBeenCalledTimes(1);
    });

    it("should create a project without an optional description", async () => {
      vi.mocked(generateId)
        .mockReturnValueOnce("prj_test1")
        .mockReturnValueOnce("fld_test1")
        .mockReturnValueOnce("pp_test1");

      vi.mocked(verifyWorkspaceAccess).mockResolvedValue({
        id: "ws_123",
        name: "Test Workspace",
      } as never);

      vi.mocked(db.insert)
        .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never)
        .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never)
        .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ ...mockProject, id: "prj_test1", description: null }]),
          }),
        }),
      } as never);

      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "No Description Project", workspace_id: "ws_123" }),
      });

      expect(res.status).toBe(200);
    });

    it("should return 500 when name is missing", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: "ws_123" }),
      });

      expect(res.status).toBe(500);
    });

    it("should return 500 when name is not a string", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: 42, workspace_id: "ws_123" }),
      });

      expect(res.status).toBe(500);
    });

    it("should return 500 when workspace_id is missing", async () => {
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Valid Name" }),
      });

      expect(res.status).toBe(500);
    });

    it("should return 500 when workspace is not found", async () => {
      vi.mocked(verifyWorkspaceAccess).mockResolvedValue(null);

      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Project", workspace_id: "ws_nonexistent" }),
      });

      expect(res.status).toBe(500);
    });

    it("should grant full_access permission to the creator", async () => {
      vi.mocked(generateId)
        .mockReturnValueOnce("prj_test1")
        .mockReturnValueOnce("fld_test1")
        .mockReturnValueOnce("pp_test1");

      vi.mocked(verifyWorkspaceAccess).mockResolvedValue({
        id: "ws_123",
        name: "Test Workspace",
      } as never);

      const permissionInsertValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert)
        .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never)
        .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never)
        .mockReturnValueOnce({ values: permissionInsertValues } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{ ...mockProject, id: "prj_test1" }]),
          }),
        }),
      } as never);

      await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Project", workspace_id: "ws_123" }),
      });

      expect(permissionInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "pp_test1",
          projectId: "prj_test1",
          userId: "usr_123",
          permission: "full_access",
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /:id - Update project
  // ---------------------------------------------------------------------------
  describe("PATCH /:id - update project", () => {
    it("should update project name successfully", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: mockProject,
        workspace: { id: "ws_123" },
      } as never);

      const updatedProject = { ...mockProject, name: "Updated Name" };

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([updatedProject]),
          }),
        }),
      } as never);

      const res = await app.request("/prj_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.attributes.name).toBe("Updated Name");
    });

    it("should update project description successfully", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: mockProject,
        workspace: { id: "ws_123" },
      } as never);

      const updatedProject = { ...mockProject, description: "Updated description" };

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([updatedProject]),
          }),
        }),
      } as never);

      const res = await app.request("/prj_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Updated description" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.attributes.description).toBe("Updated description");
    });

    it("should update is_restricted successfully", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: mockProject,
        workspace: { id: "ws_123" },
      } as never);

      const updatedProject = { ...mockProject, isRestricted: true };

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([updatedProject]),
          }),
        }),
      } as never);

      const res = await app.request("/prj_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_restricted: true }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.attributes.isRestricted).toBe(true);
    });

    it("should archive a project when archived is set to true", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: mockProject,
        workspace: { id: "ws_123" },
      } as never);

      const archivedProject = {
        ...mockProject,
        archivedAt: new Date("2026-02-01T00:00:00Z"),
      };

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(db.update).mockReturnValue({ set: setMock } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([archivedProject]),
          }),
        }),
      } as never);

      const res = await app.request("/prj_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });

      expect(res.status).toBe(200);
      // The set call should include archivedAt as a Date
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ archivedAt: expect.any(Date) })
      );
    });

    it("should unarchive a project when archived is set to false", async () => {
      const archivedProject = {
        ...mockProject,
        archivedAt: new Date("2026-02-01T00:00:00Z"),
      };

      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: archivedProject,
        workspace: { id: "ws_123" },
      } as never);

      const unarchivedProject = { ...archivedProject, archivedAt: null };

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(db.update).mockReturnValue({ set: setMock } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([unarchivedProject]),
          }),
        }),
      } as never);

      const res = await app.request("/prj_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });

      expect(res.status).toBe(200);
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ archivedAt: null })
      );
    });

    it("should return 500 when project is not found", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await app.request("/prj_nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      expect(res.status).toBe(500);
    });

    it("should call verifyProjectAccess with the correct project ID", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: mockProject,
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([mockProject]),
          }),
        }),
      } as never);

      await app.request("/prj_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      expect(verifyProjectAccess).toHaveBeenCalledWith("prj_123", mockSession.currentAccountId);
    });

    it("should include updatedAt in the update payload", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: mockProject,
        workspace: { id: "ws_123" },
      } as never);

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(db.update).mockReturnValue({ set: setMock } as never);

      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([mockProject]),
          }),
        }),
      } as never);

      await app.request("/prj_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ updatedAt: expect.any(Date) })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /:id - Archive project (soft delete)
  // ---------------------------------------------------------------------------
  describe("DELETE /:id - archive project", () => {
    it("should soft delete (archive) a project and return 204", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: mockProject,
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      const res = await app.request("/prj_123", { method: "DELETE" });

      expect(res.status).toBe(204);
    });

    it("should set archivedAt and updatedAt on the project record", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: mockProject,
        workspace: { id: "ws_123" },
      } as never);

      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(db.update).mockReturnValue({ set: setMock } as never);

      await app.request("/prj_123", { method: "DELETE" });

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          archivedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it("should return 500 when project is not found", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue(null);

      const res = await app.request("/prj_nonexistent", { method: "DELETE" });

      expect(res.status).toBe(500);
    });

    it("should call verifyProjectAccess with the correct project ID", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: mockProject,
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      await app.request("/prj_123", { method: "DELETE" });

      expect(verifyProjectAccess).toHaveBeenCalledWith("prj_123", mockSession.currentAccountId);
    });

    it("should not return a body in the 204 response", async () => {
      vi.mocked(verifyProjectAccess).mockResolvedValue({
        project: mockProject,
        workspace: { id: "ws_123" },
      } as never);

      vi.mocked(db.update).mockReturnValue({
        set: () => ({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      const res = await app.request("/prj_123", { method: "DELETE" });

      expect(res.status).toBe(204);
      const text = await res.text();
      expect(text).toBe("");
    });
  });
});
