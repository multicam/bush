/**
 * Bush Platform - React Real-time Hook
 *
 * React hooks for subscribing to real-time events via WebSocket.
 * Reference: specs/14-realtime-collaboration.md Section 11.2
 */
"use client";

import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import {
  getBushSocket,
  type BushSocket,
  type RealtimeEventMessage,
  type ConnectionState,
  type ChannelType,
  type EventHandler,
} from "../lib/ws-client.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for useRealtime hook
 */
export interface UseRealtimeOptions {
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Callback for connection state changes */
  onStateChange?: (state: ConnectionState) => void;
}

/**
 * Return type for useRealtime hook
 */
export interface UseRealtimeReturn {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Connect to the WebSocket server */
  connect: () => Promise<void>;
  /** Disconnect from the WebSocket server */
  disconnect: () => void;
  /** Subscribe to a channel */
  subscribe: (channel: ChannelType, resourceId: string, handler: EventHandler) => () => void;
}

/**
 * Options for useChannel hook
 */
export interface UseChannelOptions {
  /** Filter by event type(s) */
  eventFilter?: string | string[];
  /** Callback when an event is received */
  onEvent?: (event: RealtimeEventMessage) => void;
}

/**
 * Return type for useChannel hook
 */
export interface UseChannelReturn {
  /** Array of received events (limited to last 100) */
  events: RealtimeEventMessage[];
  /** Current connection state */
  connectionState: ConnectionState;
  /** Clear all events */
  clearEvents: () => void;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Main hook for managing WebSocket connection and subscriptions
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { connectionState, subscribe } = useRealtime();
 *
 *   useEffect(() => {
 *     return subscribe("project", projectId, (event) => {
 *       console.log("Received event:", event);
 *     });
 *   }, [projectId, subscribe]);
 *
 *   return <div>Connection: {connectionState}</div>;
 * }
 * ```
 */
export function useRealtime(options: UseRealtimeOptions = {}): UseRealtimeReturn {
  const { autoConnect = true, onStateChange } = options;
  const socketRef = useRef<BushSocket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");

  // Initialize socket on mount
  useEffect(() => {
    const socket = getBushSocket();
    socketRef.current = socket;

    // Subscribe to state changes
    const unsubscribe = socket.onStateChange((state) => {
      setConnectionState(state);
      onStateChange?.(state);
    });

    // Auto-connect if enabled
    if (autoConnect) {
      socket.connect().catch((error) => {
        console.error("[useRealtime] Connection failed:", error);
      });
    }

    return () => {
      unsubscribe();
    };
  }, [autoConnect, onStateChange]);

  // Connect function
  const connect = useCallback(async () => {
    if (socketRef.current) {
      await socketRef.current.connect();
    }
  }, []);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  }, []);

  // Subscribe function
  const subscribe = useCallback(
    (channel: ChannelType, resourceId: string, handler: EventHandler) => {
      if (!socketRef.current) {
        return () => {};
      }
      return socketRef.current.subscribe(channel, resourceId, handler);
    },
    []
  );

  return {
    connectionState,
    connect,
    disconnect,
    subscribe,
  };
}

/**
 * Hook for subscribing to a specific channel and receiving events
 *
 * @example
 * ```tsx
 * function ProjectEvents({ projectId }: { projectId: string }) {
 *   const { events, connectionState } = useChannel("project", projectId, {
 *     eventFilter: ["comment.created", "file.created"],
 *     onEvent: (event) => {
 *       toast.success(`New ${event.event}`);
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       <div>Connection: {connectionState}</div>
 *       <ul>
 *         {events.map((e) => (
 *           <li key={e.eventId}>{e.event}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useChannel(
  channel: ChannelType,
  resourceId: string | undefined | null,
  options: UseChannelOptions = {}
): UseChannelReturn {
  const { eventFilter, onEvent } = options;
  const [events, setEvents] = useState<RealtimeEventMessage[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const socketRef = useRef<BushSocket | null>(null);

  // Parse event filter into a set for quick lookup (useMemo to avoid accessing during render)
  const eventFilterSet = useMemo<Set<string> | null>(() => {
    if (!eventFilter) return null;
    return new Set(Array.isArray(eventFilter) ? eventFilter : [eventFilter]);
  }, [eventFilter]);

  useEffect(() => {
    if (!resourceId) return;

    const socket = getBushSocket();
    socketRef.current = socket;

    // Subscribe to state changes
    const unsubscribeState = socket.onStateChange(setConnectionState);

    // Subscribe to channel events
    const unsubscribeChannel = socket.subscribe(channel, resourceId, (event) => {
      // Apply event filter if set
      if (eventFilterSet && !eventFilterSet.has(event.event)) {
        return;
      }

      // Add event to state (limit to last 100)
      setEvents((prev) => {
        const newEvents = [...prev, event];
        if (newEvents.length > 100) {
          return newEvents.slice(-100);
        }
        return newEvents;
      });

      // Call onEvent callback
      onEvent?.(event);
    });

    // Auto-connect if not already connected
    if (socket.state === "disconnected") {
      socket.connect().catch((error) => {
        console.error("[useChannel] Connection failed:", error);
      });
    }

    return () => {
      unsubscribeState();
      unsubscribeChannel();
    };
  }, [channel, resourceId, onEvent, eventFilterSet]);

  // Clear events function
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    events,
    connectionState,
    clearEvents,
  };
}

/**
 * Hook for subscribing to project events
 *
 * @example
 * ```tsx
 * function ProjectUpdates({ projectId }: { projectId: string }) {
 *   const { events } = useProjectEvents(projectId);
 *   // ...
 * }
 * ```
 */
export function useProjectEvents(
  projectId: string | undefined | null,
  options?: UseChannelOptions
): UseChannelReturn {
  return useChannel("project", projectId, options);
}

/**
 * Hook for subscribing to file events
 *
 * @example
 * ```tsx
 * function FileUpdates({ fileId }: { fileId: string }) {
 *   const { events } = useFileEvents(fileId, {
 *     eventFilter: ["comment.created", "processing.completed"],
 *   });
 *   // ...
 * }
 * ```
 */
export function useFileEvents(
  fileId: string | undefined | null,
  options?: UseChannelOptions
): UseChannelReturn {
  return useChannel("file", fileId, options);
}

/**
 * Hook for subscribing to user events (notifications, etc.)
 *
 * @example
 * ```tsx
 * function UserNotifications({ userId }: { userId: string }) {
 *   const { events } = useUserEvents(userId, {
 *     eventFilter: "notification.created",
 *   });
 *   // ...
 * }
 * ```
 */
export function useUserEvents(
  userId: string | undefined | null,
  options?: UseChannelOptions
): UseChannelReturn {
  return useChannel("user", userId, options);
}

/**
 * Hook for subscribing to share events
 *
 * @example
 * ```tsx
 * function ShareUpdates({ shareId }: { shareId: string }) {
 *   const { events } = useShareEvents(shareId);
 *   // ...
 * }
 * ```
 */
export function useShareEvents(
  shareId: string | undefined | null,
  options?: UseChannelOptions
): UseChannelReturn {
  return useChannel("share", shareId, options);
}

/**
 * Hook for connection state only (no subscriptions)
 *
 * @example
 * ```tsx
 * function ConnectionIndicator() {
 *   const connectionState = useConnectionState();
 *   return (
 *     <div className={connectionState === "connected" ? "green" : "yellow"}>
 *       {connectionState}
 *     </div>
 *   );
 * }
 * ```
 */
export function useConnectionState(): ConnectionState {
  const [state, setState] = useState<ConnectionState>("disconnected");
  const socketRef = useRef<BushSocket | null>(null);

  useEffect(() => {
    const socket = getBushSocket();
    socketRef.current = socket;

    // Get initial state - this is intentional to sync with socket state
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(socket.state);

    // Subscribe to state changes
    const unsubscribe = socket.onStateChange(setState);

    // Auto-connect if not already connected
    if (socket.state === "disconnected") {
      socket.connect().catch((error) => {
        console.error("[useConnectionState] Connection failed:", error);
      });
    }

    return unsubscribe;
  }, []);

  return state;
}
