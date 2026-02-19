/**
 * Tests for permissions module index exports
 */
import { describe, it, expect } from "vitest";
import { permissionService } from "./index.js";
import * as permTypes from "./types.js";

describe("permissions index exports", () => {
  describe("permissionService", () => {
    it("exports permissionService object", () => {
      expect(permissionService).toBeDefined();
    });

    it("has getWorkspacePermission method", () => {
      expect(typeof permissionService.getWorkspacePermission).toBe("function");
    });

    it("has getProjectPermission method", () => {
      expect(typeof permissionService.getProjectPermission).toBe("function");
    });

    it("has getFolderPermission method", () => {
      expect(typeof permissionService.getFolderPermission).toBe("function");
    });

    it("has canPerformAction method", () => {
      expect(typeof permissionService.canPerformAction).toBe("function");
    });

    it("has getAccountRole method", () => {
      expect(typeof permissionService.getAccountRole).toBe("function");
    });

    it("has isAccountAdmin method", () => {
      expect(typeof permissionService.isAccountAdmin).toBe("function");
    });

    it("has grantWorkspacePermission method", () => {
      expect(typeof permissionService.grantWorkspacePermission).toBe("function");
    });

    it("has grantProjectPermission method", () => {
      expect(typeof permissionService.grantProjectPermission).toBe("function");
    });

    it("has grantFolderPermission method", () => {
      expect(typeof permissionService.grantFolderPermission).toBe("function");
    });

    it("has revokeWorkspacePermission method", () => {
      expect(typeof permissionService.revokeWorkspacePermission).toBe("function");
    });

    it("has revokeProjectPermission method", () => {
      expect(typeof permissionService.revokeProjectPermission).toBe("function");
    });

    it("has revokeFolderPermission method", () => {
      expect(typeof permissionService.revokeFolderPermission).toBe("function");
    });

    it("has hasGuestReachedProjectLimit method", () => {
      expect(typeof permissionService.hasGuestReachedProjectLimit).toBe("function");
    });

    it("has getUserProjectCount method", () => {
      expect(typeof permissionService.getUserProjectCount).toBe("function");
    });

    it("has validatePermissionChange method", () => {
      expect(typeof permissionService.validatePermissionChange).toBe("function");
    });
  });

  describe("type exports", () => {
    it("re-exports PERMISSION_HIERARCHY from types.js", () => {
      expect(permTypes.PERMISSION_HIERARCHY).toBeDefined();
    });

    it("exports PERMISSION_HIERARCHY array", () => {
      expect(Array.isArray(permTypes.PERMISSION_HIERARCHY)).toBe(true);
      expect(permTypes.PERMISSION_HIERARCHY).toContain("view_only");
      expect(permTypes.PERMISSION_HIERARCHY).toContain("full_access");
    });

    it("exports permission helper functions", () => {
      expect(typeof permTypes.getPermissionIndex).toBe("function");
      expect(typeof permTypes.comparePermissions).toBe("function");
      expect(typeof permTypes.isPermissionAtLeast).toBe("function");
      expect(typeof permTypes.maxPermission).toBe("function");
      expect(typeof permTypes.minPermission).toBe("function");
    });

    it("exports ACTION_PERMISSIONS constant", () => {
      expect(permTypes.ACTION_PERMISSIONS).toBeDefined();
      expect(typeof permTypes.ACTION_PERMISSIONS).toBe("object");
    });

    it("exports GUEST_CONSTRAINTS constant", () => {
      expect(permTypes.GUEST_CONSTRAINTS).toBeDefined();
      expect(permTypes.GUEST_CONSTRAINTS.MAX_PROJECTS).toBe(1);
    });

    it("exports canPerformAction function", () => {
      expect(typeof permTypes.canPerformAction).toBe("function");
    });

    it("PermissionLevel type is valid", () => {
      const level: permTypes.PermissionLevel = "edit";
      expect(level).toBe("edit");
    });

    it("ResourceAction type is valid", () => {
      const action: permTypes.ResourceAction = "view";
      expect(action).toBe("view");
    });

    it("getPermissionIndex returns correct indices", () => {
      expect(permTypes.getPermissionIndex("view_only")).toBe(0);
      expect(permTypes.getPermissionIndex("full_access")).toBe(4);
    });

    it("isPermissionAtLeast works correctly", () => {
      expect(permTypes.isPermissionAtLeast("edit", "view_only")).toBe(true);
      expect(permTypes.isPermissionAtLeast("view_only", "edit")).toBe(false);
    });
  });
});
