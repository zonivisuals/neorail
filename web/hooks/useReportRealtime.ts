/**
 * Supabase Realtime Hook for Report Subscriptions
 * 
 * Listens to INSERT, UPDATE, and DELETE events on the Report table
 * and provides real-time updates to React components.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase/service";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type ReportPayload = {
  id: string;
  createdAt: string;
  updatedAt: string;
  content: string;
  imageUrl: string[];
  location: string;
  trainId: string | null;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "ANALYZING" | "RESOLVED";
  conductorId: string;
  adminId: string | null;
};

export type RealtimeEvent = {
  type: "INSERT" | "UPDATE" | "DELETE";
  payload: ReportPayload;
  timestamp: string;
};

// Singleton Supabase client to avoid multiple instances
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient();
  }
  return supabaseInstance;
}

/**
 * Hook to subscribe to real-time report changes
 * @param onEvent - Callback fired when a report event occurs
 * @returns Connection status and latest event
 */
export function useReportRealtime(
  onEvent?: (event: RealtimeEvent) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [latestEvent, setLatestEvent] = useState<RealtimeEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to store the callback to avoid re-subscribing on every render
  const onEventRef = useRef(onEvent);
  
  // Update the ref when callback changes
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let channel: RealtimeChannel | null = null;
    let isSubscribed = true;

    console.log("[Realtime] Setting up subscription...");

    // Subscribe to all changes on the Report table
    channel = supabase
      .channel("report-changes")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to INSERT, UPDATE, DELETE
          schema: "public",
          table: "Report",
        },
        (payload: { eventType: string; new: unknown; old: unknown }) => {
          console.log("[Realtime] Report change detected:", payload);

          if (!isSubscribed) {
            console.log("[Realtime] Ignoring event - already unsubscribed");
            return;
          }

          const event: RealtimeEvent = {
            type: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            payload: payload.new as ReportPayload,
            timestamp: new Date().toISOString(),
          };

          console.log("[Realtime] Processed event:", event);
          setLatestEvent(event);

          // Call the callback if provided (using ref to get latest)
          if (onEventRef.current) {
            onEventRef.current(event);
          }
        }
      )
      .subscribe((status: string) => {
        console.log("[Realtime] Subscription status:", status);
        
        if (!isSubscribed) return;
        
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          setError(null);
        } else if (status === "CHANNEL_ERROR") {
          setIsConnected(false);
          setError("Failed to connect to realtime channel");
        } else if (status === "TIMED_OUT") {
          setIsConnected(false);
          setError("Connection timed out");
        }
      });

    // Cleanup on unmount
    return () => {
      console.log("[Realtime] Cleaning up subscription...");
      isSubscribed = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []); // Empty dependency array - only run once on mount

  return {
    isConnected,
    latestEvent,
    error,
  };
}
