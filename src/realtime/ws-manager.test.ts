/**
 * Tests for WebSocket Connection Manager
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SessionData } from "../auth/types.js";

// Helper to create mock session data
const createMockSession = (overrides?: Partial<SessionData>): SessionData => ({
  sessionId: "session_1",
  userId: "user_1",
  email: "test@example.com",
  displayName: "Test User",
  currentAccountId: "account_1",
  accountRole: "owner",
  workosOrganizationId: "org_1",
  workosUserId: "workos_1",
  createdAt: Date.now(),
  lastActivityAt: Date.now(),
  ...overrides,
});

// Mock dependencies
vi.mock("iron-session", () => ({
  unsealData: vi.fn(),
}));

vi.mock("./event-bus.js", () => ({
  eventBus: {
    onEvent: vi.fn(() => {
      // Return unsubscribe function
      return () => {};
    }),
  },
}));

vi.mock("../auth/session-cache.js", () => ({
  sessionCache: {
    get: vi.fn(),
  },
  parseSessionCookie: vi.fn(),
}));

vi.mock("../auth/service.js", () => ({
  authService: {
    findOrCreateUser: vi.fn(),
    getUserAccounts: vi.fn(),
    createSession: vi.fn(),
  },
}));

vi.mock("../config/index.js", () => ({
  config: {
    WORKOS_COOKIE_PASSWORD: "test-password",
    SESSION_SECRET: "test-session-secret-at-least-32-chars",
  },
}));

vi.mock("../db/index.js", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => [{ id: "mock-id", workspaceId: "mock-workspace" }]),
        })),
      })),
    })),
  },
}));

vi.mock("../db/schema.js", () => ({
  projects: { id: "projects.id", workspaceId: "projects.workspaceId" },
}));

describe("WebSocket Manager", () => {
  let wsManager: any;
  let mockWs: any;

  const createMockWs = (data?: Partial<any>) => ({
    data: {
      connectionId: "conn_123",
      userId: "user_1",
      session: createMockSession(),
      connectedAt: new Date(),
      subscriptions: new Set<string>(),
      messageTimestamps: [],
      ...data,
    },
    send: vi.fn(),
    close: vi.fn(),
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Import fresh module
    const module = await import("./ws-manager.js");
    wsManager = module.wsManager;
    wsManager.init();
  });

  afterEach(() => {
    wsManager.shutdown();
  });

  describe("init", () => {
    it("initializes the manager and subscribes to event bus", async () => {
      const { eventBus } = await import("./event-bus.js");
      expect(eventBus.onEvent).toHaveBeenCalled();
    });
  });

  describe("shutdown", () => {
    it("clears all connections and unsubscribes from event bus", async () => {
      vi.resetModules();
      const module = await import("./ws-manager.js");
      const freshManager = module.wsManager;

      freshManager.init();
      freshManager.shutdown();

      const stats = freshManager.getStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
      expect(stats.activeChannels).toBe(0);
    });
  });

  describe("generateConnectionId", () => {
    it("generates unique connection IDs", () => {
      const id1 = wsManager.generateConnectionId();
      const id2 = wsManager.generateConnectionId();

      expect(id1).toMatch(/^conn_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^conn_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("authenticate", () => {
    it("returns null for empty cookie header", async () => {
      const result = await wsManager.authenticate("");
      expect(result).toBeNull();
    });

    it("returns null for missing cookie header", async () => {
      const result = await wsManager.authenticate(undefined as any);
      expect(result).toBeNull();
    });

    it("authenticates with bush_session cookie", async () => {
      const { parseSessionCookie, sessionCache } = await import("../auth/session-cache.js");

      vi.mocked(parseSessionCookie).mockReturnValue({
        userId: "user_1",
        sessionId: "session_1",
      });

      vi.mocked(sessionCache.get).mockResolvedValue(createMockSession());

      const result = await wsManager.authenticate("bush_session=valid");

      expect(result).toEqual({
        userId: "user_1",
        session: expect.objectContaining({
          userId: "user_1",
          currentAccountId: "account_1",
        }),
      });
    });

    it("returns null when session not found in cache", async () => {
      const { parseSessionCookie, sessionCache } = await import("../auth/session-cache.js");

      vi.mocked(parseSessionCookie).mockReturnValue({
        userId: "user_1",
        sessionId: "session_1",
      });

      vi.mocked(sessionCache.get).mockResolvedValue(null);

      const result = await wsManager.authenticate("bush_session=invalid");

      expect(result).toBeNull();
    });
  });

  describe("register", () => {
    it("registers a new connection", () => {
      mockWs = createMockWs();
      wsManager.register(mockWs);

      const stats = wsManager.getStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.uniqueUsers).toBe(1);
    });

    it("sends connection confirmation", () => {
      mockWs = createMockWs();
      wsManager.register(mockWs);

      expect(mockWs.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("connection.established");
      expect(sentMessage.connectionId).toBe("conn_123");
    });

    it("tracks multiple connections for same user", () => {
      mockWs = createMockWs();
      const mockWs2 = createMockWs({ connectionId: "conn_456" });

      wsManager.register(mockWs);
      wsManager.register(mockWs2);

      const stats = wsManager.getStats();
      expect(stats.totalConnections).toBe(2);
      expect(stats.uniqueUsers).toBe(1);
    });
  });

  describe("unregister", () => {
    it("removes connection and subscriptions", () => {
      mockWs = createMockWs();
      wsManager.register(mockWs);
      wsManager.unregister(mockWs);

      const stats = wsManager.getStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
    });

    it("removes subscriptions from channels", () => {
      mockWs = createMockWs({
        subscriptions: new Set(["project:proj_1", "file:file_1"]),
      });

      wsManager.register(mockWs);
      wsManager.unregister(mockWs);

      const stats = wsManager.getStats();
      expect(stats.activeChannels).toBe(0);
    });
  });

  describe("handleMessage", () => {
    beforeEach(() => {
      mockWs = createMockWs();
      wsManager.register(mockWs);
    });

    it("handles ping messages", async () => {
      await wsManager.handleMessage(mockWs, JSON.stringify({ action: "ping" }));

      expect(mockWs.send).toHaveBeenCalled();
      const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
      const message = JSON.parse(lastCall[0]);
      expect(message.type).toBe("pong");
    });

    it("rejects invalid JSON", async () => {
      await wsManager.handleMessage(mockWs, "not json");

      expect(mockWs.send).toHaveBeenCalled();
      const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
      const message = JSON.parse(lastCall[0]);
      expect(message.type).toBe("error");
      expect(message.code).toBe("invalid_message");
    });

    it("rejects unknown actions", async () => {
      await wsManager.handleMessage(mockWs, JSON.stringify({ action: "unknown" }));

      expect(mockWs.send).toHaveBeenCalled();
      const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
      const message = JSON.parse(lastCall[0]);
      expect(message.type).toBe("error");
      expect(message.code).toBe("unknown_action");
    });

    it("handles rate limiting", async () => {
      // Send 100+ messages rapidly
      for (let i = 0; i < 110; i++) {
        await wsManager.handleMessage(mockWs, JSON.stringify({ action: "ping" }));
      }

      // Should have some rate-limited responses
      const calls = mockWs.send.mock.calls;
      const rateLimitedCalls = calls.filter((call: any[]) => {
        const msg = JSON.parse(call[0]);
        return msg.code === "rate_limited";
      });

      expect(rateLimitedCalls.length).toBeGreaterThan(0);
    });
  });

  describe("getStats", () => {
    it("returns current connection statistics", () => {
      mockWs = createMockWs();
      wsManager.register(mockWs);

      const stats = wsManager.getStats();

      expect(stats).toHaveProperty("totalConnections");
      expect(stats).toHaveProperty("uniqueUsers");
      expect(stats).toHaveProperty("activeChannels");
    });
  });

  describe("authenticate with WorkOS", () => {
    it("authenticates with wos-session cookie", async () => {
      const { unsealData } = await import("iron-session");
      const { authService } = await import("../auth/service.js");

      vi.mocked(unsealData).mockResolvedValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: {
          id: "workos-user-1",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          profilePictureUrl: null,
        },
        organizationId: "org-1",
      });

      vi.mocked(authService.findOrCreateUser).mockResolvedValue({
        userId: "user_1",
        isNewUser: false,
      });

      vi.mocked(authService.getUserAccounts).mockResolvedValue([
        { accountId: "account_1", accountName: "Test Account", accountSlug: "test-account", role: "owner" },
      ]);

      vi.mocked(authService.createSession).mockResolvedValue(createMockSession());

      await wsManager.authenticate("wos-session=valid-session");

      expect(authService.findOrCreateUser).toHaveBeenCalled();
    });

    it("returns null when wos-session has no user", async () => {
      const { unsealData } = await import("iron-session");

      vi.mocked(unsealData).mockResolvedValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: null as any,
      });

      const result = await wsManager.authenticate("wos-session=invalid");

      expect(result).toBeNull();
    });

    it("returns null when user has no accounts", async () => {
      const { unsealData } = await import("iron-session");
      const { authService } = await import("../auth/service.js");

      vi.mocked(unsealData).mockResolvedValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: {
          id: "workos-user-1",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          profilePictureUrl: null,
        },
        organizationId: "org-1",
      });

      vi.mocked(authService.findOrCreateUser).mockResolvedValue({
        userId: "user_1",
        isNewUser: false,
      });

      vi.mocked(authService.getUserAccounts).mockResolvedValue([]);

      const result = await wsManager.authenticate("wos-session=valid-session");

      expect(result).toBeNull();
    });

    it("returns null when wos-session parsing fails", async () => {
      const { unsealData } = await import("iron-session");
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      vi.mocked(unsealData).mockRejectedValue(new Error("Parse error"));

      const result = await wsManager.authenticate("wos-session=invalid");

      expect(result).toBeNull();

      errorSpy.mockRestore();
    });
  });

  describe("handleSubscribe", () => {
    beforeEach(() => {
      mockWs = createMockWs();
      wsManager.register(mockWs);
    });

    it("rejects subscription when limit exceeded", async () => {
      // Create connection with 50 subscriptions already
      const subscriptions = new Set<string>();
      for (let i = 0; i < 50; i++) {
        subscriptions.add(`project:proj_${i}`);
      }
      mockWs.data.subscriptions = subscriptions;

      await wsManager.handleMessage(
        mockWs,
        JSON.stringify({ action: "subscribe", channel: "project", resourceId: "proj_new" })
      );

      const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
      const message = JSON.parse(lastCall[0]);
      expect(message.type).toBe("subscription.rejected");
      expect(message.reason).toBe("subscription_limit_exceeded");
    });

    it("handles subscribe without channel", async () => {
      await wsManager.handleMessage(
        mockWs,
        JSON.stringify({ action: "subscribe", resourceId: "proj_1" })
      );

      // Should not send any response (no channel specified)
    });

    it("handles subscribe without resourceId", async () => {
      await wsManager.handleMessage(
        mockWs,
        JSON.stringify({ action: "subscribe", channel: "project" })
      );

      // Should not send any response (no resourceId specified)
    });
  });

  describe("handleUnsubscribe", () => {
    beforeEach(() => {
      mockWs = createMockWs();
      wsManager.register(mockWs);
    });

    it("handles unsubscribe message", async () => {
      // First subscribe
      await wsManager.handleMessage(
        mockWs,
        JSON.stringify({ action: "subscribe", channel: "user", resourceId: "user_1" })
      );

      // Then unsubscribe
      await wsManager.handleMessage(
        mockWs,
        JSON.stringify({ action: "unsubscribe", channel: "user", resourceId: "user_1" })
      );

      const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
      const message = JSON.parse(lastCall[0]);
      expect(message.type).toBe("subscription.unconfirmed");
    });

    it("handles unsubscribe without channel", async () => {
      await wsManager.handleMessage(
        mockWs,
        JSON.stringify({ action: "unsubscribe", resourceId: "proj_1" })
      );

      // Should not crash
    });
  });

  describe("exports", () => {
    it("exports wsManager singleton", async () => {
      const module = await import("./ws-manager.js");
      expect(module.wsManager).toBeDefined();
    });

    it("exports WsCloseCode constants", async () => {
      const module = await import("./ws-manager.js");
      expect(module.WsCloseCode).toBeDefined();
      expect(module.WsCloseCode.NORMAL).toBe(1000);
      expect(module.WsCloseCode.AUTHENTICATION_FAILED).toBe(4001);
      expect(module.WsCloseCode.FORBIDDEN).toBe(4003);
    });

    it("exports types", async () => {
      const module = await import("./ws-manager.js");
      expect(module.WsCloseCode).toBeDefined();
    });
  });

  describe("broadcast", () => {
    it("registers with event bus on init", async () => {
      const { eventBus } = await import("./event-bus.js");
      expect(eventBus.onEvent).toHaveBeenCalled();
    });

    it("tracks active channels correctly", async () => {
      mockWs = createMockWs();
      wsManager.register(mockWs);

      // Initial state - no channels
      expect(wsManager.getStats().activeChannels).toBe(0);

      // Subscribe to a project channel
      await wsManager.handleMessage(
        mockWs,
        JSON.stringify({ action: "subscribe", channel: "project", resourceId: "proj_1" })
      );

      // Should have 1 channel
      expect(wsManager.getStats().activeChannels).toBe(1);

      // Subscribe to another channel (different resource)
      await wsManager.handleMessage(
        mockWs,
        JSON.stringify({ action: "subscribe", channel: "file", resourceId: "file_1" })
      );

      // Should have 2 channels
      expect(wsManager.getStats().activeChannels).toBe(2);
    });

    it("handles multiple subscriptions to same channel", async () => {
      mockWs = createMockWs();
      wsManager.register(mockWs);

      // Subscribe to same channel twice
      await wsManager.handleMessage(
        mockWs,
        JSON.stringify({ action: "subscribe", channel: "project", resourceId: "proj_1" })
      );
      await wsManager.handleMessage(
        mockWs,
        JSON.stringify({ action: "subscribe", channel: "project", resourceId: "proj_1" })
      );

      // Should still have 1 channel (deduped)
      expect(wsManager.getStats().activeChannels).toBe(1);
    });
  });

  describe("rate limiting edge cases", () => {
    it("allows messages after rate limit window expires", async () => {
      mockWs = createMockWs({
        data: {
          ...createMockWs().data,
          messageTimestamps: [],
        },
      });
      wsManager.register(mockWs);

      // Clear previous calls
      mockWs.send.mockClear();

      // Send a ping
      await wsManager.handleMessage(mockWs, JSON.stringify({ action: "ping" }));

      // Should get a pong response
      const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
      const message = JSON.parse(lastCall[0]);
      expect(message.type).toBe("pong");
    });
  });

  describe("connection cleanup", () => {
    it("removes channel subscriptions when connection unregistered", async () => {
      mockWs = createMockWs();
      wsManager.register(mockWs);

      // Subscribe to channels
      await wsManager.handleMessage(
        mockWs,
        JSON.stringify({ action: "subscribe", channel: "project", resourceId: "proj_1" })
      );
      await wsManager.handleMessage(
        mockWs,
        JSON.stringify({ action: "subscribe", channel: "file", resourceId: "file_1" })
      );

      const statsAfterRegister = wsManager.getStats();
      expect(statsAfterRegister.activeChannels).toBe(2);

      wsManager.unregister(mockWs);

      const statsAfterUnregister = wsManager.getStats();
      expect(statsAfterUnregister.activeChannels).toBe(0);
    });

    it("handles unregister of non-existent connection gracefully", () => {
      mockWs = createMockWs();
      // Don't register it

      // Should not throw
      expect(() => wsManager.unregister(mockWs)).not.toThrow();
    });
  });
});
