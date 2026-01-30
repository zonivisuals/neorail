"use client";

import { useState, useCallback } from "react";
import { WaitingForReport } from "@/components/admin/waiting-for-report";
import { useReportRealtime, type RealtimeEvent } from "@/hooks/useReportRealtime";

export default function AdminDashboardPage() {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  
  // Memoize callback to prevent unnecessary re-renders
  const handleReportEvent = useCallback((event: RealtimeEvent) => {
    console.log("[Dashboard] Received event:", event);
    // Add new event to the top of the list
    setEvents((prev) => [event, ...prev]);
  }, []);
  
  const { isConnected, latestEvent, error } = useReportRealtime(handleReportEvent);

  return (
    <div className="w-screen h-screen flex flex-col">
      {/* Header with connection status */}
      <div className="p-4 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Admin Dashboard</h1>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="text-sm text-muted-foreground">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-500 mt-2">
            Error: {error}
          </p>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left side - Waiting animation */}
        <div className="flex-1 flex items-center justify-center">
          <WaitingForReport />
        </div>

        {/* Right side - Real-time events */}
        <div className="w-1/2 border-l bg-muted/30 flex flex-col">
          <div className="p-4 border-b bg-background/95">
            <h2 className="text-lg font-semibold">
              Real-time Reports ({events.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              New reports will appear here automatically
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {events.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">No reports received yet...</p>
              </div>
            ) : (
              events.map((event, index) => (
                <div
                  key={`${event.payload.id}-${index}`}
                  className="bg-background border rounded-lg p-4 space-y-2 animate-in slide-in-from-top-2 duration-300"
                >
                  {/* Event header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        event.type === "INSERT"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : event.type === "UPDATE"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                      }`}
                    >
                      {event.type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Report preview */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${
                          event.payload.urgency === "CRITICAL"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                            : event.payload.urgency === "HIGH"
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                            : event.payload.urgency === "MEDIUM"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
                        }`}
                      >
                        {event.payload.urgency}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        📍 {event.payload.location}
                      </span>
                      {event.payload.trainId && (
                        <span className="text-xs text-muted-foreground">
                          🚆 Train {event.payload.trainId}
                        </span>
                      )}
                    </div>
                    <p className="text-sm line-clamp-2">
                      {event.payload.content}
                    </p>
                    {event.payload.imageUrl.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        📎 {event.payload.imageUrl.length} image(s)
                      </p>
                    )}
                  </div>

                  {/* JSON payload (collapsible) */}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View full JSON
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto text-[10px]">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </details>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}