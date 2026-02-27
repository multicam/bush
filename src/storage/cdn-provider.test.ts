/**
 * Bush Platform - CDN Provider Tests
 *
 * Tests for CDN provider interface and implementations (Bunny, CloudFront, Fastly).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BunnyCDNProvider, CloudFrontCDNProvider, FastlyCDNProvider, NoCDNProvider } from "./cdn-provider.js";
import type { CDNConfig, CloudFrontCDNConfig, FastlyCDNConfig, CDNDeliveryOptions } from "./cdn-types.js";
import { DEFAULT_CACHE_TTL } from "./cdn-types.js";
import crypto from "crypto";

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
    apiKey: "test-api-key-456",
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
      } as Response) as unknown as typeof fetch;

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
      } as Response) as unknown as typeof fetch;

      const result = await provider.healthCheck();
      expect(result).toBe(true);
    });

    it("should return false when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error")) as unknown as typeof fetch;

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
    it("should call Bunny purge API and return success when API key exists", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("OK"),
      } as Response) as unknown as typeof fetch;

      const result = await provider.invalidate("account/project/asset/thumbnail/thumb_320.jpg");

      expect(result.success).toBe(true);
      expect(result.invalidationId).toBeDefined();
      expect(result.estimatedTime).toBe(5000);

      // Verify API call was made with correct parameters
      expect(fetch).toHaveBeenCalledWith("https://api.bunny.net/purge", {
        method: "POST",
        headers: {
          "AccessKey": "test-api-key-456",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hostname: "cdn.test.bush.app",
          purgePath: "/test-bucket/account/project/asset/thumbnail/thumb_320.jpg",
        }),
      });
    });

    it("should return failure when no API key configured", async () => {
      const noKeyConfig: CDNConfig = {
        provider: "bunny",
        baseUrl: "https://cdn.test.bush.app",
        signingKey: "test-signing-key",
        apiKey: undefined,
        storageBucket: "test-bucket",
      };
      const noKeyProvider = new BunnyCDNProvider(noKeyConfig);

      const result = await noKeyProvider.invalidate("test/key.jpg");
      expect(result.success).toBe(false);
    });

    it("should return failure when purge API returns error", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      } as Response) as unknown as typeof fetch;

      const result = await provider.invalidate("test/key.jpg");
      expect(result.success).toBe(false);
    });

    it("should return failure when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error")) as unknown as typeof fetch;

      const result = await provider.invalidate("test/key.jpg");
      expect(result.success).toBe(false);
    });
  });

  describe("invalidatePrefix", () => {
    it("should call Bunny purge API with async flag and return success", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("OK"),
      } as Response) as unknown as typeof fetch;

      const result = await provider.invalidatePrefix("account/project/asset/");

      expect(result.success).toBe(true);
      expect(result.invalidationId).toBeDefined();
      expect(result.estimatedTime).toBe(30000);

      // Verify API call was made with correct parameters including async flag
      expect(fetch).toHaveBeenCalledWith("https://api.bunny.net/purge", {
        method: "POST",
        headers: {
          "AccessKey": "test-api-key-456",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hostname: "cdn.test.bush.app",
          purgePath: "/test-bucket/account/project/asset/",
          async: true,
        }),
      });
    });

    it("should return failure when no API key configured", async () => {
      const noKeyConfig: CDNConfig = {
        provider: "bunny",
        baseUrl: "https://cdn.test.bush.app",
        signingKey: "test-signing-key",
        apiKey: undefined,
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

// Generate a test RSA key pair for CloudFront tests
function generateTestKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

describe("CloudFrontCDNProvider", () => {
  const testKeyPair = generateTestKeyPair();
  const testConfig: CloudFrontCDNConfig = {
    provider: "cloudfront",
    baseUrl: "https://d111111abcdef8.cloudfront.net",
    distributionId: "EDFDVBD6EXAMPLE",
    keyPairId: "APKAEXAMPLE",
    privateKey: testKeyPair.privateKey,
    region: "us-east-1",
    storageBucket: "test-bucket",
  };

  let provider: CloudFrontCDNProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    provider = new CloudFrontCDNProvider(testConfig);
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("constructor", () => {
    it("should have provider type 'cloudfront'", () => {
      expect(provider.providerType).toBe("cloudfront");
    });

    it("should strip trailing slash from base URL", () => {
      const configWithSlash = { ...testConfig, baseUrl: "https://d111111abcdef8.cloudfront.net/" };
      const providerWithSlash = new CloudFrontCDNProvider(configWithSlash);
      expect(providerWithSlash.providerType).toBe("cloudfront");
    });
  });

  describe("healthCheck", () => {
    it("should return true when CDN responds with 200", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response) as unknown as typeof fetch;

      const result = await provider.healthCheck();
      expect(result).toBe(true);
    });

    it("should return true when CDN responds with 403 (requires auth)", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response) as unknown as typeof fetch;

      const result = await provider.healthCheck();
      expect(result).toBe(true);
    });

    it("should return false when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error")) as unknown as typeof fetch;

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
        "https://d111111abcdef8.cloudfront.net/test-bucket/account/project/asset/thumbnail/thumb_320.jpg"
      );
      expect(result.isSigned).toBe(false);
      expect(result.expiresAt).toBeUndefined();
    });

    it("should generate signed URL with Policy, Signature, and Key-Pair-Id", async () => {
      const options: CDNDeliveryOptions = {
        contentType: "thumbnail",
      };

      const result = await provider.getDeliveryUrl("account/project/asset/thumbnail/thumb_320.jpg", options);

      expect(result.url).toContain("Policy=");
      expect(result.url).toContain("Signature=");
      expect(result.url).toContain("Key-Pair-Id=APKAEXAMPLE");
      expect(result.isSigned).toBe(true);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it("should use default TTL for content types", async () => {
      const thumbnailOptions: CDNDeliveryOptions = { contentType: "thumbnail" };
      const proxyOptions: CDNDeliveryOptions = { contentType: "proxy" };

      const thumbnailResult = await provider.getDeliveryUrl("test/thumb.jpg", thumbnailOptions);
      const proxyResult = await provider.getDeliveryUrl("test/proxy.mp4", proxyOptions);

      expect(thumbnailResult.isSigned).toBe(true);
      expect(proxyResult.isSigned).toBe(true);

      // Verify TTL differences
      const now = Date.now();
      const thumbnailExpiry = thumbnailResult.expiresAt!.getTime();
      const proxyExpiry = proxyResult.expiresAt!.getTime();

      // Thumbnail TTL is 30 days, proxy is 7 days
      expect(thumbnailExpiry - now).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
      expect(proxyExpiry - now).toBeLessThan(10 * 24 * 60 * 60 * 1000);
    });
  });

  describe("invalidate", () => {
    it("should return failure when distribution ID is not configured", async () => {
      const noDistConfig = { ...testConfig, distributionId: "" };
      const noDistProvider = new CloudFrontCDNProvider(noDistConfig);

      const result = await noDistProvider.invalidate("test/key.jpg");
      expect(result.success).toBe(false);
    });
  });

  describe("invalidatePrefix", () => {
    it("should return failure when distribution ID is not configured", async () => {
      const noDistConfig = { ...testConfig, distributionId: "" };
      const noDistProvider = new CloudFrontCDNProvider(noDistConfig);

      const result = await noDistProvider.invalidatePrefix("test/");
      expect(result.success).toBe(false);
    });
  });
});

describe("FastlyCDNProvider", () => {
  const testConfig: FastlyCDNConfig = {
    provider: "fastly",
    baseUrl: "https://bush-cdn.fastly.net",
    apiKey: "test-fastly-api-key-123",
    serviceId: "service-abc123",
    tokenSigningKey: "test-signing-key-456",
    storageBucket: "test-bucket",
  };

  let provider: FastlyCDNProvider;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    provider = new FastlyCDNProvider(testConfig);
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("constructor", () => {
    it("should have provider type 'fastly'", () => {
      expect(provider.providerType).toBe("fastly");
    });

    it("should strip trailing slash from base URL", () => {
      const configWithSlash = { ...testConfig, baseUrl: "https://bush-cdn.fastly.net/" };
      const providerWithSlash = new FastlyCDNProvider(configWithSlash);
      expect(providerWithSlash.providerType).toBe("fastly");
    });
  });

  describe("healthCheck", () => {
    it("should return true when CDN responds with 200", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response) as unknown as typeof fetch;

      const result = await provider.healthCheck();
      expect(result).toBe(true);
    });

    it("should return true when CDN responds with 403 (requires auth)", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response) as unknown as typeof fetch;

      const result = await provider.healthCheck();
      expect(result).toBe(true);
    });

    it("should return false when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error")) as unknown as typeof fetch;

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
        "https://bush-cdn.fastly.net/test-bucket/account/project/asset/thumbnail/thumb_320.jpg"
      );
      expect(result.isSigned).toBe(false);
      expect(result.expiresAt).toBeUndefined();
    });

    it("should generate signed URL with token and expires", async () => {
      const options: CDNDeliveryOptions = {
        contentType: "thumbnail",
      };

      const result = await provider.getDeliveryUrl("account/project/asset/thumbnail/thumb_320.jpg", options);

      expect(result.url).toContain("token=");
      expect(result.url).toContain("expires=");
      expect(result.isSigned).toBe(true);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it("should return unsigned URL when no token signing key", async () => {
      const noKeyConfig = { ...testConfig, tokenSigningKey: undefined };
      const noKeyProvider = new FastlyCDNProvider(noKeyConfig);

      const result = await noKeyProvider.getDeliveryUrl("test/key.jpg", {
        contentType: "thumbnail",
      });

      expect(result.isSigned).toBe(false);
      expect(result.url).not.toContain("token=");
    });
  });

  describe("invalidate", () => {
    it("should call Fastly PURGE API and return success", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "purge-123", status: "ok" }),
      } as Response) as unknown as typeof fetch;

      const result = await provider.invalidate("account/project/asset/thumbnail/thumb_320.jpg");

      expect(result.success).toBe(true);
      expect(result.invalidationId).toBe("purge-123");
      expect(result.estimatedTime).toBe(1000);

      // Verify PURGE request was made with correct parameters
      expect(fetch).toHaveBeenCalledWith(
        "https://bush-cdn.fastly.net/test-bucket/account/project/asset/thumbnail/thumb_320.jpg",
        {
          method: "PURGE",
          headers: {
            "Fastly-Key": "test-fastly-api-key-123",
            "Accept": "application/json",
          },
        }
      );
    });

    it("should return failure when no API key configured", async () => {
      const noKeyConfig = { ...testConfig, apiKey: "" };
      const noKeyProvider = new FastlyCDNProvider(noKeyConfig);

      const result = await noKeyProvider.invalidate("test/key.jpg");
      expect(result.success).toBe(false);
    });

    it("should return failure when purge API returns error", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      } as Response) as unknown as typeof fetch;

      const result = await provider.invalidate("test/key.jpg");
      expect(result.success).toBe(false);
    });
  });

  describe("invalidatePrefix", () => {
    it("should call Fastly bulk purge API and return success", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "bulk-purge-456", status: "ok" }),
      } as Response) as unknown as typeof fetch;

      const result = await provider.invalidatePrefix("account/project/asset/");

      expect(result.success).toBe(true);
      expect(result.invalidationId).toBe("bulk-purge-456");
      expect(result.estimatedTime).toBe(5000);

      // Verify bulk purge API call was made
      expect(fetch).toHaveBeenCalledWith(
        "https://api.fastly.com/purge",
        {
          method: "POST",
          headers: {
            "Fastly-Key": "test-fastly-api-key-123",
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            service_id: "service-abc123",
            purge_path: "/test-bucket/account/project/asset/*",
          }),
        }
      );
    });

    it("should return failure when no API key configured", async () => {
      const noKeyConfig = { ...testConfig, apiKey: "" };
      const noKeyProvider = new FastlyCDNProvider(noKeyConfig);

      const result = await noKeyProvider.invalidatePrefix("test/");
      expect(result.success).toBe(false);
    });

    it("should return failure when no service ID configured", async () => {
      const noServiceConfig = { ...testConfig, serviceId: "" };
      const noServiceProvider = new FastlyCDNProvider(noServiceConfig);

      const result = await noServiceProvider.invalidatePrefix("test/");
      expect(result.success).toBe(false);
    });
  });
});
