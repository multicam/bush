/**
 * Tests for API Documentation Route
 */
import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import docsRoutes from "./docs.js";

describe("Docs Route", () => {
  const app = new Hono();
  app.route("/docs", docsRoutes);

  describe("GET /docs", () => {
    it("should return API documentation", async () => {
      const res = await app.request("/docs");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/json");

      const data = (await res.json()) as Record<string, unknown>;
      expect(data).toHaveProperty("name", "Bush API");
      expect(data).toHaveProperty("version", "v4");
      expect(data).toHaveProperty("specification", "JSON:API 1.0");
    });

    it("should include authentication methods", async () => {
      const res = await app.request("/docs");
      const data = (await res.json()) as Record<string, unknown>;

      expect(data).toHaveProperty("authentication");
      expect((data.authentication as Record<string, unknown>).methods).toBeInstanceOf(Array);
      expect(((data.authentication as Record<string, unknown>).methods as unknown[]).length).toBeGreaterThan(0);
    });

    it("should include endpoints documentation", async () => {
      const res = await app.request("/docs");
      const data = (await res.json()) as Record<string, unknown>;

      expect(data).toHaveProperty("endpoints");
      expect((data.endpoints as Record<string, unknown>)).toHaveProperty("auth");
      expect((data.endpoints as Record<string, unknown>)).toHaveProperty("accounts");
      expect((data.endpoints as Record<string, unknown>)).toHaveProperty("projects");
      expect((data.endpoints as Record<string, unknown>)).toHaveProperty("files");
    });

    it("should include response format documentation", async () => {
      const res = await app.request("/docs");
      const data = (await res.json()) as Record<string, unknown>;

      expect(data).toHaveProperty("response_format");
      expect((data.response_format as Record<string, unknown>).type).toBe("JSON:API 1.0");
      expect((data.response_format as Record<string, unknown>)).toHaveProperty("pagination");
    });

    it("should include rate limit information", async () => {
      const res = await app.request("/docs");
      const data = (await res.json()) as Record<string, unknown>;

      expect(data).toHaveProperty("rate_limits");
      expect((data.rate_limits as Record<string, unknown>)).toHaveProperty("default");
    });

    it("should include realtime websocket information", async () => {
      const res = await app.request("/docs");
      const data = (await res.json()) as Record<string, unknown>;

      expect(data).toHaveProperty("realtime");
      expect((data.realtime as Record<string, unknown>).websocket).toBe("/ws");
      expect((data.realtime as Record<string, unknown>)).toHaveProperty("events");
      expect(((data.realtime as Record<string, unknown>).events as unknown[])).toBeInstanceOf(Array);
    });

    it("should include useful links", async () => {
      const res = await app.request("/docs");
      const data = (await res.json()) as Record<string, unknown>;

      expect(data).toHaveProperty("links");
      expect((data.links as Record<string, unknown>).self).toBe("/docs");
      expect((data.links as Record<string, unknown>).api_root).toBe("/");
      expect((data.links as Record<string, unknown>).health).toBe("/health");
    });
  });
});
