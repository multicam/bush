/**
 * Bush Platform - Permission System Tests
 *
 * Tests for permission types, hierarchy, and service operations.
 */
import { describe, it, expect } from "vitest";
import {
  PERMISSION_HIERARCHY,
  getPermissionIndex,
  comparePermissions,
  isPermissionAtLeast,
  maxPermission,
  minPermission,
  canPerformAction,
  ACTION_PERMISSIONS,
  GUEST_CONSTRAINTS,
} from "./types.js";

describe("Permission Types", () => {
  describe("PERMISSION_HIERARCHY", () => {
    it("should have permissions ordered from least to most permissive", () => {
      expect(PERMISSION_HIERARCHY).toEqual([
        "view_only",
        "comment_only",
        "edit",
        "edit_and_share",
        "full_access",
      ]);
    });

    it("should have 5 permission levels", () => {
      expect(PERMISSION_HIERARCHY.length).toBe(5);
    });
  });

  describe("getPermissionIndex", () => {
    it("should return correct index for each permission level", () => {
      expect(getPermissionIndex("view_only")).toBe(0);
      expect(getPermissionIndex("comment_only")).toBe(1);
      expect(getPermissionIndex("edit")).toBe(2);
      expect(getPermissionIndex("edit_and_share")).toBe(3);
      expect(getPermissionIndex("full_access")).toBe(4);
    });
  });

  describe("comparePermissions", () => {
    it("should return positive when first permission is higher", () => {
      expect(comparePermissions("edit", "view_only")).toBeGreaterThan(0);
    });

    it("should return negative when first permission is lower", () => {
      expect(comparePermissions("view_only", "edit")).toBeLessThan(0);
    });

    it("should return zero when permissions are equal", () => {
      expect(comparePermissions("edit", "edit")).toBe(0);
    });
  });

  describe("isPermissionAtLeast", () => {
    it("should return true when permission is higher", () => {
      expect(isPermissionAtLeast("edit", "view_only")).toBe(true);
    });

    it("should return true when permissions are equal", () => {
      expect(isPermissionAtLeast("edit", "edit")).toBe(true);
    });

    it("should return false when permission is lower", () => {
      expect(isPermissionAtLeast("view_only", "edit")).toBe(false);
    });

    it("should validate full_access is at least any other permission", () => {
      expect(isPermissionAtLeast("full_access", "edit_and_share")).toBe(true);
      expect(isPermissionAtLeast("full_access", "edit")).toBe(true);
      expect(isPermissionAtLeast("full_access", "comment_only")).toBe(true);
      expect(isPermissionAtLeast("full_access", "view_only")).toBe(true);
    });

    it("should validate view_only is not at least any other permission", () => {
      expect(isPermissionAtLeast("view_only", "edit_and_share")).toBe(false);
      expect(isPermissionAtLeast("view_only", "edit")).toBe(false);
      expect(isPermissionAtLeast("view_only", "comment_only")).toBe(false);
    });
  });

  describe("maxPermission", () => {
    it("should return the more permissive permission", () => {
      expect(maxPermission("view_only", "edit")).toBe("edit");
      expect(maxPermission("edit", "view_only")).toBe("edit");
      expect(maxPermission("full_access", "view_only")).toBe("full_access");
    });

    it("should return either when permissions are equal", () => {
      expect(maxPermission("edit", "edit")).toBe("edit");
    });
  });

  describe("minPermission", () => {
    it("should return the less permissive permission", () => {
      expect(minPermission("view_only", "edit")).toBe("view_only");
      expect(minPermission("edit", "view_only")).toBe("view_only");
      expect(minPermission("full_access", "view_only")).toBe("view_only");
    });

    it("should return either when permissions are equal", () => {
      expect(minPermission("edit", "edit")).toBe("edit");
    });
  });
});

describe("Permission Actions", () => {
  describe("ACTION_PERMISSIONS", () => {
    it("should define required permissions for all actions", () => {
      const actions = [
        "view",
        "comment",
        "download",
        "share",
        "edit",
        "delete",
        "manage_permissions",
        "create_project",
        "create_restricted_project",
        "add_members",
        "delete_workspace",
      ];

      for (const action of actions) {
        expect(ACTION_PERMISSIONS[action as keyof typeof ACTION_PERMISSIONS]).toBeDefined();
      }
    });

    it("should require view_only for view action", () => {
      expect(ACTION_PERMISSIONS.view).toBe("view_only");
    });

    it("should require comment_only for comment action", () => {
      expect(ACTION_PERMISSIONS.comment).toBe("comment_only");
    });

    it("should require edit_and_share for download and share actions", () => {
      expect(ACTION_PERMISSIONS.download).toBe("edit_and_share");
      expect(ACTION_PERMISSIONS.share).toBe("edit_and_share");
    });

    it("should require full_access for delete and manage actions", () => {
      expect(ACTION_PERMISSIONS.delete).toBe("full_access");
      expect(ACTION_PERMISSIONS.manage_permissions).toBe("full_access");
      expect(ACTION_PERMISSIONS.delete_workspace).toBe("full_access");
      expect(ACTION_PERMISSIONS.create_restricted_project).toBe("full_access");
    });
  });

  describe("canPerformAction", () => {
    it("should allow view_only to view", () => {
      expect(canPerformAction("view_only", "view")).toBe(true);
    });

    it("should not allow view_only to comment", () => {
      expect(canPerformAction("view_only", "comment")).toBe(false);
    });

    it("should allow comment_only to view and comment", () => {
      expect(canPerformAction("comment_only", "view")).toBe(true);
      expect(canPerformAction("comment_only", "comment")).toBe(true);
    });

    it("should not allow comment_only to download or share", () => {
      expect(canPerformAction("comment_only", "download")).toBe(false);
      expect(canPerformAction("comment_only", "share")).toBe(false);
    });

    it("should allow edit to edit but not share", () => {
      expect(canPerformAction("edit", "edit")).toBe(true);
      expect(canPerformAction("edit", "share")).toBe(false);
    });

    it("should allow edit_and_share to share and download", () => {
      expect(canPerformAction("edit_and_share", "share")).toBe(true);
      expect(canPerformAction("edit_and_share", "download")).toBe(true);
    });

    it("should not allow edit_and_share to delete", () => {
      expect(canPerformAction("edit_and_share", "delete")).toBe(false);
    });

    it("should allow full_access to all actions", () => {
      const actions: Array<keyof typeof ACTION_PERMISSIONS> = [
        "view",
        "comment",
        "download",
        "share",
        "edit",
        "delete",
        "manage_permissions",
        "create_project",
        "create_restricted_project",
        "add_members",
        "delete_workspace",
      ];

      for (const action of actions) {
        expect(canPerformAction("full_access", action)).toBe(true);
      }
    });
  });
});

describe("Guest Constraints", () => {
  it("should define max projects as 1", () => {
    expect(GUEST_CONSTRAINTS.MAX_PROJECTS).toBe(1);
  });

  it("should not allow guests to invite", () => {
    expect(GUEST_CONSTRAINTS.CAN_INVITE).toBe(false);
  });

  it("should not allow guests to delete", () => {
    expect(GUEST_CONSTRAINTS.CAN_DELETE).toBe(false);
  });

  it("should have all required constraint fields", () => {
    expect(GUEST_CONSTRAINTS).toHaveProperty("MAX_PROJECTS");
    expect(GUEST_CONSTRAINTS).toHaveProperty("CAN_INVITE");
    expect(GUEST_CONSTRAINTS).toHaveProperty("CAN_DELETE");
  });
});

describe("Permission Edge Cases", () => {
  describe("maxPermission edge cases", () => {
    it("should handle full_access with any permission", () => {
      expect(maxPermission("full_access", "view_only")).toBe("full_access");
      expect(maxPermission("full_access", "comment_only")).toBe("full_access");
      expect(maxPermission("full_access", "edit")).toBe("full_access");
      expect(maxPermission("full_access", "edit_and_share")).toBe("full_access");
    });

    it("should work in both directions", () => {
      expect(maxPermission("view_only", "full_access")).toBe("full_access");
      expect(maxPermission("edit", "full_access")).toBe("full_access");
    });
  });

  describe("minPermission edge cases", () => {
    it("should handle view_only with any permission", () => {
      expect(minPermission("view_only", "full_access")).toBe("view_only");
      expect(minPermission("view_only", "edit")).toBe("view_only");
    });

    it("should work in both directions", () => {
      expect(minPermission("full_access", "view_only")).toBe("view_only");
      expect(minPermission("edit", "view_only")).toBe("view_only");
    });
  });

  describe("canPerformAction edge cases", () => {
    it("should allow edit to view and comment", () => {
      expect(canPerformAction("edit", "view")).toBe(true);
      expect(canPerformAction("edit", "comment")).toBe(true);
    });

    it("should allow edit_and_share to edit", () => {
      expect(canPerformAction("edit_and_share", "edit")).toBe(true);
    });

    it("should not allow view_only to edit", () => {
      expect(canPerformAction("view_only", "edit")).toBe(false);
    });

    it("should allow full_access to create_project", () => {
      expect(canPerformAction("full_access", "create_project")).toBe(true);
    });

    it("should allow edit_and_share to create_project", () => {
      expect(canPerformAction("edit_and_share", "create_project")).toBe(true);
    });

    it("should not allow edit to create_restricted_project", () => {
      expect(canPerformAction("edit", "create_restricted_project")).toBe(false);
    });
  });
});
