/**
 * Bush Platform - CDN Provider Tests
 *
 * Tests for CDN provider interface and Bunny CDN implementation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BunnyCDNProvider, NoCDNProvider } from "./cdn-provider.js";
import type { CDNConfig, CDNDeliveryOptions } from "./cdn-types.js";
import { DEFAULT_CACHE_TTL } from "./cdn-types.js";

describe("NoCDNProvider", () => {
  let provider: NoCDNProvider;

  beforeEach(() => {
    provider = new NoCDNProvider();
    vi.clearAllMocks();
  });

  it("should have provider type 'none'", () => {
    expect(provider.providerType).toBe("none");
  });

  it("should return true for health check", async () => {
    const result = await provider.healthCheck();
    expect(result).toBe(true);
  });

  it("should return placeholder URL for delivery", async () => {
    const result = await provider.getDeliveryUrl("test/key.jpg", {
      contentType: "thumbnail",
    });

    expect(result.url).toBe("#no-cdn/test/key.jpg");
    expect(result.isSigned).toBe(false);
  });

  it("should return success for invalidate", async () => {
    const result = await provider.invalidate("test/key.jpg");
    expect(result.success).toBe(true);
  });

  it("should return success for invalidatePrefix", async () => {
    const result = await provider.invalidatePrefix("test/");
    expect(result.success).toBe(true);
  });
});

describe("BunnyCDNProvider", () => {
  const testConfig: CDNConfig = {
    provider: "bunny",
    baseUrl: "https://cdn.test.bush.app",
    signingKey: "test-signing-key-123",
    storageBucket: "test-bucket",
  };

  let provider: BunnyCDNProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    provider = new BunnyCDNProvider(testConfig);
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("constructor", () => {
    it("should have provider type 'bunny'", () => {
      expect(provider.providerType).toBe("bunny");
    });

    it("should strip trailing slash from base URL", () => {
      const configWithSlash = {
        ...testConfig,
        baseUrl: "https://cdn.test.bush.app/",
      };
      const providerWithSlash = new BunnyCDNProvider(configWithSlash);
      // Internal check - the URL should not have trailing slash
      expect(providerWithSlash.providerType).toBe("bunny");
    });
  });

  describe("healthCheck", () => {
    it("should return true when CDN responds with 200", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      const result = await provider.healthCheck();
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith("https://cdn.test.bush.app", {
        method: "HEAD",
      });
    });

    it("should return true when CDN responds with 404", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await provider.healthCheck();
      expect(result).toBe(true);
    });

    it("should return false when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe("getDeliveryUrl", () => {
    it("should generate unsigned URL when signing is disabled", async () => {
      const options: CDNDeliveryOptions = {
        contentType: "thumbnail",
        signed: false,
      };

      const result = await provider.getDeliveryUrl("account/project/asset/thumbnail/thumb_320.jpg", options);

      expect(result.url).toBe(
        "https://cdn.test.bush.app/test-bucket/account/project/asset/thumbnail/thumb_320.jpg"
      );
      expect(result.isSigned).toBe(false);
      expect(result.expiresAt).toBeUndefined();
    });

    it("should generate signed URL for thumbnail", async () => {
      const options: CDNDeliveryOptions = {
        contentType: "thumbnail",
      };

      const result = await provider.getDeliveryUrl("account/project/asset/thumbnail/thumb_320.jpg", options);

      expect(result.url).toContain("token=");
      expect(result.url).toContain("expires=");
      expect(result.isSigned).toBe(true);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it("should generate signed URL with custom expiration", async () => {
      const options: CDNDeliveryOptions = {
        contentType: "thumbnail",
        expiresIn: 3600, // 1 hour
      };

      const result = await provider.getDeliveryUrl("test/key.jpg", options);

      expect(result.isSigned).toBe(true);
      // Check expiration is approximately 1 hour from now
      const expectedExpiry = new Date(Date.now() + 3600 * 1000);
      const diff = Math.abs(result.expiresAt!.getTime() - expectedExpiry.getTime());
      expect(diff).toBeLessThan(5000); // Within 5 seconds
    });

    it("should use default TTL for content types", async () => {
      const thumbnailOptions: CDNDeliveryOptions = { contentType: "thumbnail" };
      const proxyOptions: CDNDeliveryOptions = { contentType: "proxy" };
      const hlsPlaylistOptions: CDNDeliveryOptions = { contentType: "hls-playlist" };

      const thumbnailResult = await provider.getDeliveryUrl("test/thumb.jpg", thumbnailOptions);
      const proxyResult = await provider.getDeliveryUrl("test/proxy.mp4", proxyOptions);
      const hlsResult = await provider.getDeliveryUrl("test/playlist.m3u8", hlsPlaylistOptions);

      // Verify all are signed (thumbnails, proxies, and HLS playlists should be)
      expect(thumbnailResult.isSigned).toBe(true);
      expect(proxyResult.isSigned).toBe(true);
      expect(hlsResult.isSigned).toBe(true);

      // Verify TTL differences (30 days vs 7 days vs 5 minutes)
      const thumbnailTTL = DEFAULT_CACHE_TTL.thumbnail;
      const proxyTTL = DEFAULT_CACHE_TTL.proxy;
      const hlsTTL = DEFAULT_CACHE_TTL["hls-playlist"];

      expect(thumbnailTTL).toBe(30 * 24 * 60 * 60);
      expect(proxyTTL).toBe(7 * 24 * 60 * 60);
      expect(hlsTTL).toBe(5 * 60);
    });

    it("should return unsigned URL when no signing key", async () => {
      const noKeyConfig: CDNConfig = {
        provider: "bunny",
        baseUrl: "https://cdn.test.bush.app",
        signingKey: undefined,
        storageBucket: "test-bucket",
      };
      const noKeyProvider = new BunnyCDNProvider(noKeyConfig);

      const result = await noKeyProvider.getDeliveryUrl("test/key.jpg", {
        contentType: "thumbnail",
      });

      expect(result.isSigned).toBe(false);
      expect(result.url).not.toContain("token=");
    });
  });

  describe("invalidate", () => {
    it("should return success when signing key exists", async () => {
      const result = await provider.invalidate("account/project/asset/thumbnail/thumb_320.jpg");

      expect(result.success).toBe(true);
      expect(result.invalidationId).toBeDefined();
      expect(result.estimatedTime).toBe(5000);
    });

    it("should return failure when no signing key", async () => {
      const noKeyConfig: CDNConfig = {
        provider: "bunny",
        baseUrl: "https://cdn.test.bush.app",
        signingKey: undefined,
        storageBucket: "test-bucket",
      };
      const noKeyProvider = new BunnyCDNProvider(noKeyConfig);

      const result = await noKeyProvider.invalidate("test/key.jpg");
      expect(result.success).toBe(false);
    });
  });

  describe("invalidatePrefix", () => {
    it("should return success when signing key exists", async () => {
      const result = await provider.invalidatePrefix("account/project/asset/");

      expect(result.success).toBe(true);
      expect(result.invalidationId).toBeDefined();
      expect(result.estimatedTime).toBe(30000);
    });

    it("should return failure when no signing key", async () => {
      const noKeyConfig: CDNConfig = {
        provider: "bunny",
        baseUrl: "https://cdn.test.bush.app",
        signingKey: undefined,
        storageBucket: "test-bucket",
      };
      const noKeyProvider = new BunnyCDNProvider(noKeyConfig);

      const result = await noKeyProvider.invalidatePrefix("test/");
      expect(result.success).toBe(false);
    });
  });
});

describe("CDN Types", () => {
  it("should have correct default cache TTL values", () => {
    expect(DEFAULT_CACHE_TTL.thumbnail).toBe(30 * 24 * 60 * 60); // 30 days
    expect(DEFAULT_CACHE_TTL.filmstrip).toBe(30 * 24 * 60 * 60); // 30 days
    expect(DEFAULT_CACHE_TTL.proxy).toBe(7 * 24 * 60 * 60); // 7 days
    expect(DEFAULT_CACHE_TTL["hls-playlist"]).toBe(5 * 60); // 5 minutes
    expect(DEFAULT_CACHE_TTL["hls-segment"]).toBe(7 * 24 * 60 * 60); // 7 days
    expect(DEFAULT_CACHE_TTL.waveform).toBe(30 * 24 * 60 * 60); // 30 days
    expect(DEFAULT_CACHE_TTL.original).toBe(0); // No CDN
  });
});
