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

      const data = await res.json();
      expect(data).toHaveProperty("name", "Bush API");
      expect(data).toHaveProperty("version", "v4");
      expect(data).toHaveProperty("specification", "JSON:API 1.0");
    });

    it("should include authentication methods", async () => {
      const res = await app.request("/docs");
      const data = await res.json();

      expect(data).toHaveProperty("authentication");
      expect(data.authentication).toHaveProperty("methods");
      expect(data.authentication.methods).toBeInstanceOf(Array);
      expect(data.authentication.methods.length).toBeGreaterThan(0);
    });

    it("should include endpoints documentation", async () => {
      const res = await app.request("/docs");
      const data = await res.json();

      expect(data).toHaveProperty("endpoints");
      expect(data.endpoints).toHaveProperty("auth");
      expect(data.endpoints).toHaveProperty("accounts");
      expect(data.endpoints).toHaveProperty("projects");
      expect(data.endpoints).toHaveProperty("files");
    });

    it("should include response format documentation", async () => {
      const res = await app.request("/docs");
      const data = await res.json();

      expect(data).toHaveProperty("response_format");
      expect(data.response_format).toHaveProperty("type", "JSON:API 1.0");
      expect(data.response_format).toHaveProperty("pagination");
    });

    it("should include rate limit information", async () => {
      const res = await app.request("/docs");
      const data = await res.json();

      expect(data).toHaveProperty("rate_limits");
      expect(data.rate_limits).toHaveProperty("default");
    });

    it("should include realtime websocket information", async () => {
      const res = await app.request("/docs");
      const data = await res.json();

      expect(data).toHaveProperty("realtime");
      expect(data.realtime).toHaveProperty("websocket", "/ws");
      expect(data.realtime).toHaveProperty("events");
      expect(data.realtime.events).toBeInstanceOf(Array);
    });

    it("should include useful links", async () => {
      const res = await app.request("/docs");
      const data = await res.json();

      expect(data).toHaveProperty("links");
      expect(data.links).toHaveProperty("self", "/docs");
      expect(data.links).toHaveProperty("api_root", "/");
      expect(data.links).toHaveProperty("health", "/health");
    });
  });
});
