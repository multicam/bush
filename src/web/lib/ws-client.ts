/**
 * Bush Platform - Browser WebSocket Client
 *
 * Client for connecting to the Bush real-time WebSocket server.
 * Handles connection management, reconnection, and subscription management.
 * Reference: specs/14-realtime-collaboration.md Section 11
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Connection state
 */
export type ConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

/**
 * Channel types (must match server)
 */
export type ChannelType = "project" | "file" | "user" | "share";

/**
 * Subscription info
 */
interface Subscription {
  channel: ChannelType;
  resourceId: string;
  handlers: Set<(event: RealtimeEventMessage) => void>;
}

/**
 * Client-to-server message
 */
interface ClientMessage {
  action: "subscribe" | "unsubscribe" | "ping";
  channel?: ChannelType;
  resourceId?: string;
  projectId?: string;
}

/**
 * Server-to-client event message
 */
export interface RealtimeEventMessage {
  channel: ChannelType;
  resourceId: string;
  event: string;
  eventId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Server-to-client control message
 */
interface ControlMessage {
  type: string;
  connectionId?: string;
  serverTime?: string;
  channel?: ChannelType;
  resourceId?: string;
  reason?: string;
  timestamp?: string;
  code?: string;
  message?: string;
}

/**
 * Event handler type
 */
export type EventHandler = (event: RealtimeEventMessage) => void;

/**
 * Connection state handler type
 */
export type ConnectionStateHandler = (state: ConnectionState) => void;

// ============================================================================
// WebSocket Client
// ============================================================================

/**
 * Backoff delays for reconnection (in milliseconds)
 */
const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

/**
 * Maximum backoff delay (reserved for future use)
 */
const _MAX_BACKOFF = 30000;

/**
 * BushSocket client for real-time updates
 */
export class BushSocket {
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = "disconnected";
  private connectionId: string | null = null;
  private subscriptions = new Map<string, Subscription>();
  private stateHandlers = new Set<ConnectionStateHandler>();
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private intentionalClose = false;

  /**
   * Get the current connection state
   */
  get state(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get the connection ID (null if not connected)
   */
  get id(): string | null {
    return this.connectionId;
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.intentionalClose = false;
      this.setState("connecting");

      // Determine WebSocket URL based on current location
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log("[BushSocket] Connected to", wsUrl);
          this.reconnectAttempts = 0;
          this.setState("connected");
          this.startPingInterval();
          this.resubscribeAll();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          console.log("[BushSocket] Connection closed:", event.code, event.reason);
          this.cleanup();
          if (!this.intentionalClose) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error("[BushSocket] Error:", error);
          reject(new Error("WebSocket connection failed"));
        };
      } catch (error) {
        this.setState("disconnected");
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.intentionalClose = true;
    this.cleanup();

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.connectionId = null;
    this.setState("disconnected");
  }

  /**
   * Subscribe to a channel
   */
  subscribe(
    channel: ChannelType,
    resourceId: string,
    handler: EventHandler
  ): () => void {
    const key = this.getChannelKey(channel, resourceId);

    // Add handler to existing subscription or create new one
    let subscription = this.subscriptions.get(key);
    if (!subscription) {
      subscription = {
        channel,
        resourceId,
        handlers: new Set(),
      };
      this.subscriptions.set(key, subscription);

      // Send subscribe message if connected
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ action: "subscribe", channel, resourceId });
      }
    }

    subscription.handlers.add(handler);

    // Return unsubscribe function
    return () => {
      if (subscription) {
        subscription.handlers.delete(handler);

        // If no more handlers, unsubscribe from server
        if (subscription.handlers.size === 0) {
          this.subscriptions.delete(key);
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({ action: "unsubscribe", channel, resourceId });
          }
        }
      }
    };
  }

  /**
   * Subscribe to connection state changes
   */
  onStateChange(handler: ConnectionStateHandler): () => void {
    this.stateHandlers.add(handler);
    // Immediately call with current state
    handler(this.connectionState);

    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  /**
   * Get subscription key
   */
  private getChannelKey(channel: ChannelType, resourceId: string): string {
    return `${channel}:${resourceId}`;
  }

  /**
   * Set connection state and notify handlers
   */
  private setState(state: ConnectionState): void {
    this.connectionState = state;
    this.stateHandlers.forEach((handler) => {
      try {
        handler(state);
      } catch (error) {
        console.error("[BushSocket] State handler error:", error);
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as RealtimeEventMessage | ControlMessage;

      // Check if it's a control message or event message
      if ("type" in message) {
        this.handleControlMessage(message as ControlMessage);
      } else {
        this.handleEventMessage(message as RealtimeEventMessage);
      }
    } catch (error) {
      console.error("[BushSocket] Failed to parse message:", error);
    }
  }

  /**
   * Handle control messages from server
   */
  private handleControlMessage(message: ControlMessage): void {
    switch (message.type) {
      case "connection.established":
        this.connectionId = message.connectionId || null;
        console.log("[BushSocket] Connection established:", this.connectionId);
        break;

      case "subscription.confirmed":
        console.log(`[BushSocket] Subscribed to ${message.channel}:${message.resourceId}`);
        break;

      case "subscription.rejected":
        console.warn(`[BushSocket] Subscription rejected: ${message.reason}`);
        break;

      case "subscription.unconfirmed":
        console.log(`[BushSocket] Unsubscribed from ${message.channel}:${message.resourceId}`);
        break;

      case "pong":
        // Pong received, connection is alive
        break;

      case "error":
        console.error(`[BushSocket] Server error: ${message.code} - ${message.message}`);
        break;

      default:
        console.log("[BushSocket] Unknown control message:", message);
    }
  }

  /**
   * Handle event messages from server
   */
  private handleEventMessage(message: RealtimeEventMessage): void {
    const key = this.getChannelKey(message.channel, message.resourceId);
    const subscription = this.subscriptions.get(key);

    if (subscription) {
      subscription.handlers.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          console.error("[BushSocket] Event handler error:", error);
        }
      });
    }
  }

  /**
   * Send a message to the server
   */
  private send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Resubscribe to all channels after reconnection
   */
  private resubscribeAll(): void {
    this.subscriptions.forEach((subscription) => {
      this.send({
        action: "subscribe",
        channel: subscription.channel,
        resourceId: subscription.resourceId,
      });
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = BACKOFF_DELAYS[Math.min(this.reconnectAttempts, BACKOFF_DELAYS.length - 1)];
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter

    this.setState("reconnecting");
    this.reconnectAttempts++;

    console.log(`[BushSocket] Reconnecting in ${delay + jitter}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch((error) => {
        console.error("[BushSocket] Reconnection failed:", error);
      });
    }, delay + jitter);
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.stopPingInterval();

    // Send ping every 45 seconds (server expects at least every 60 seconds)
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ action: "ping" });
      }
    }, 45000);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.stopPingInterval();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

/**
 * Singleton instance for shared usage across components
 */
let sharedInstance: BushSocket | null = null;

/**
 * Track if we've set up page lifecycle listeners
 */
let lifecycleListenersSetUp = false;

/**
 * Set up page lifecycle listeners to disconnect on hide/unload
 */
function setupLifecycleListeners(): void {
  if (lifecycleListenersSetUp || typeof window === "undefined") return;
  lifecycleListenersSetUp = true;

  // Disconnect when page is hidden (tab switch, minimize, etc.)
  const handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden" && sharedInstance) {
      sharedInstance.disconnect();
    }
  };

  // Disconnect before page unload
  const handleBeforeUnload = (): void => {
    if (sharedInstance) {
      sharedInstance.disconnect();
    }
  };

  // Disconnect on page hide (mobile, etc.)
  const handlePageHide = (): void => {
    if (sharedInstance) {
      sharedInstance.disconnect();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("pagehide", handlePageHide);
}

/**
 * Get the shared BushSocket instance
 */
export function getBushSocket(): BushSocket {
  if (!sharedInstance) {
    sharedInstance = new BushSocket();
    setupLifecycleListeners();
  }
  return sharedInstance;
}

/**
 * Reset the shared instance (useful for testing)
 */
export function resetBushSocket(): void {
  if (sharedInstance) {
    sharedInstance.disconnect();
    sharedInstance = null;
  }
}
