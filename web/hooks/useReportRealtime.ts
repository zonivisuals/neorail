/**
 * Supabase Realtime Hook for Report & Solution Subscriptions
 * 
 * Listens to INSERT, UPDATE, and DELETE events on the Report and Solution tables
 * and provides real-time updates to React components.
 */

import { useEffect, useState, useRef } from "react";
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
  status: "OPEN" | "ANALYZING" | "PENDING_REVIEW" | "PENDING_CONDUCTOR" | "RESOLVED";
  conductorId: string;
  adminId: string | null;
};

export type SolutionPayload = {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  steps: string[] | string; // Can be array or string from fallback
  confidence: number;
  source: string;
  similarityScore: number | null;
  retrievalMethod: string | null;
  retrievedSources: unknown;
  reportId: string;
  confirmedAt: string | null;
  acknowledgedAt: string | null;
};

export type ReportRealtimeEvent = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: "Report";
  payload: ReportPayload;
  timestamp: string;
};

export type SolutionRealtimeEvent = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: "Solution";
  payload: SolutionPayload;
  timestamp: string;
};

export type RealtimeEvent = ReportRealtimeEvent | SolutionRealtimeEvent;

// For backwards compatibility
export type { ReportRealtimeEvent as LegacyRealtimeEvent };

// Singleton Supabase client to avoid multiple instances
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient();
  }
  return supabaseInstance;
}

/**
 * Hook to subscribe to real-time report and solution changes
 * @param onEvent - Callback fired when a report or solution event occurs
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

    console.log("[Realtime] Setting up subscription for Report and Solution tables...");

    // Subscribe to changes on both Report and Solution tables
    channel = supabase
      .channel("report-solution-changes")
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

          const event: ReportRealtimeEvent = {
            type: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            table: "Report",
            payload: payload.new as ReportPayload,
            timestamp: new Date().toISOString(),
          };

          console.log("[Realtime] Processed report event:", event);
          setLatestEvent(event);

          // Call the callback if provided (using ref to get latest)
          if (onEventRef.current) {
            onEventRef.current(event);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to INSERT, UPDATE, DELETE
          schema: "public",
          table: "Solution",
        },
        (payload: { eventType: string; new: unknown; old: unknown }) => {
          console.log("[Realtime] Solution change detected:", payload);

          if (!isSubscribed) {
            console.log("[Realtime] Ignoring event - already unsubscribed");
            return;
          }

          const event: SolutionRealtimeEvent = {
            type: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            table: "Solution",
            payload: payload.new as SolutionPayload,
            timestamp: new Date().toISOString(),
          };

          console.log("[Realtime] Processed solution event:", event);
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
