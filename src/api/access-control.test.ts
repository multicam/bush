/**
 * Bush Platform - Access Control Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before imports
vi.mock("../db/index.js", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Mock auth service for verifyAccountMembership
vi.mock("../auth/service.js", () => ({
  authService: {
    getUserRole: vi.fn(),
  },
}));

import { verifyAccountMembership } from "./access-control.js";

describe("verifyAccountMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null when user is not a member", async () => {
    // Mock DB to return empty results
    const { db } = await import("../db/index.js");
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never);

    const result = await verifyAccountMembership("usr_123", "acc_456");
    expect(result).toBeNull();
  });

  it("should return role when user is a member with sufficient role", async () => {
    const { db } = await import("../db/index.js");
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([{ role: "owner" }]),
        }),
      }),
    } as never);

    const result = await verifyAccountMembership("usr_123", "acc_456", "content_admin");
    expect(result).toBe("owner");
  });

  it("should return null when user has insufficient role", async () => {
    const { db } = await import("../db/index.js");
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([{ role: "member" }]),
        }),
      }),
    } as never);

    const result = await verifyAccountMembership("usr_123", "acc_456", "content_admin");
    expect(result).toBeNull();
  });
});
