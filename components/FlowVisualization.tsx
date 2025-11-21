"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronUp,
  ChevronDown,
  Download,
  Trash2,
  Activity,
  Zap,
  Code,
  GitBranch,
  Clock,
} from "lucide-react";
import { getFlowTracker, type FlowEvent } from "@/lib/flow-tracker";
import { getDemoMode, isDevelopment } from "@/lib/demo-mode";

export const FlowVisualization = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<FlowEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<FlowEvent | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const prevEventCountRef = useRef(0); // Track previous event count for auto-open logic

  // Fix hydration mismatch by only rendering after client mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !isDevelopment()) {
      return;
    }

    const tracker = getFlowTracker();
    const unsubscribe = tracker.subscribe((newEvents) => {
      setEvents(newEvents);

      // Auto-open only when transitioning from 0 events to 1+ events (first arrival)
      // Don't auto-open if user manually closed it and events still exist
      const prevCount = prevEventCountRef.current;
      const newCount = newEvents.length;

      if (prevCount === 0 && newCount > 0 && !isOpen) {
        setIsOpen(true);
      }

      prevEventCountRef.current = newCount;
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, isMounted]);

  const handleExport = () => {
    const tracker = getFlowTracker();
    const json = tracker.exportToJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flow-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    const tracker = getFlowTracker();
    tracker.clearEvents();
    setSelectedEvent(null);
  };

  const getEventIcon = (type: FlowEvent["type"]) => {
    switch (type) {
      case "api_call":
        return <Zap className="w-4 h-4 text-blue-500" />;
      case "decision":
        return <GitBranch className="w-4 h-4 text-yellow-500" />;
      case "model_selection":
        return <Code className="w-4 h-4 text-purple-500" />;
      case "timing":
        return <Clock className="w-4 h-4 text-green-500" />;
    }
  };

  const getEventAccentColor = (type: FlowEvent["type"]) => {
    switch (type) {
      case "api_call":
        return "border-blue-500/50";
      case "decision":
        return "border-yellow-500/50";
      case "model_selection":
        return "border-purple-500/50";
      case "timing":
        return "border-green-500/50";
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatJSON = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  // Prevent hydration mismatch - don't render until client-side mounted
  if (!isMounted) {
    return null;
  }

  // Only render in development and when demo mode is active
  if (!isDevelopment()) {
    return null;
  }

  const currentDemoMode = getDemoMode();

  if (currentDemoMode === "off") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-2xl">
      {/* Collapsed State */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="gap-2 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
          size="lg"
          variant={events.length > 0 ? "default" : "secondary"}
        >
          <Activity className={`w-4 h-4 ${events.length > 0 ? 'animate-pulse' : ''}`} />
          <span className="font-medium">Event Log</span>
          {events.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-background/20">
              {events.length}
            </Badge>
          )}
          <ChevronUp className="w-3.5 h-3.5" />
        </Button>
      )}

      {/* Expanded State */}
      {isOpen && (
        <Card className="w-[21rem] shadow-2xl border-2 animate-in slide-in-from-bottom-2 fade-in duration-200 p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Event Flow Log</h3>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {events.length}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExport}
                disabled={events.length === 0}
                title="Export as JSON"
                className="h-7 w-7 p-0"
              >
                <Download className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={events.length === 0}
                title="Clear log"
                className="h-7 w-7 p-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 p-0"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex h-[24rem]">
            {/* Event List */}
            <div className="flex-1 overflow-y-auto min-w-0">
              {events.length === 0 ? (
                <div className="h-full flex items-center justify-center p-6 text-center text-muted-foreground">
                  <div>
                    <Activity className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium mb-1">No events yet</p>
                    <p className="text-xs">
                      Events will appear here as you interact with the app
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-2">
                  {events.map((event, index) => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className={`w-full px-4 py-3 text-left hover:bg-accent/50 transition-all border-l-2 ${
                        selectedEvent?.id === event.id
                          ? `bg-accent border-l-4 ${getEventAccentColor(event.type)}`
                          : "border-transparent"
                      } ${
                        index < events.length - 1 ? "border-b border-border/40" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getEventIcon(event.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium truncate">
                              {event.title}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0.5 h-4 shrink-0"
                            >
                              {event.type.replace("_", " ")}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(event.timestamp)}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Event Details */}
            {selectedEvent && (
              <div className="w-72 border-l px-3 py-4 overflow-y-auto bg-muted/30 min-w-0">
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    {getEventIcon(selectedEvent.type)}
                    <h4 className="font-semibold text-sm">
                      {selectedEvent.title}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatTimestamp(selectedEvent.timestamp)}
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  {/* API Call Details */}
                  {selectedEvent.type === "api_call" && (
                    <>
                      {selectedEvent.details.method && (
                        <div>
                          <span className="font-semibold">Method:</span>{" "}
                          <Badge variant="outline" className="text-xs">
                            {selectedEvent.details.method}
                          </Badge>
                        </div>
                      )}
                      {selectedEvent.details.url && (
                        <div>
                          <span className="font-semibold">URL:</span>
                          <pre className="mt-1 p-2 bg-background rounded text-[10px] break-all whitespace-pre-wrap">
                            {selectedEvent.details.url}
                          </pre>
                        </div>
                      )}
                      {selectedEvent.details.requestPayload && (
                        <div>
                          <span className="font-semibold">Request:</span>
                          <pre className="mt-1 p-2 bg-background rounded text-[10px] overflow-auto max-h-32">
                            {formatJSON(selectedEvent.details.requestPayload)}
                          </pre>
                        </div>
                      )}
                      {selectedEvent.details.responsePayload && (
                        <div>
                          <span className="font-semibold">Response:</span>
                          <pre className="mt-1 p-2 bg-background rounded text-[10px] overflow-auto max-h-32">
                            {formatJSON(selectedEvent.details.responsePayload)}
                          </pre>
                        </div>
                      )}
                      {selectedEvent.details.status && (
                        <div>
                          <span className="font-semibold">Status:</span>{" "}
                          <Badge
                            variant={
                              selectedEvent.details.status >= 200 &&
                              selectedEvent.details.status < 300
                                ? "default"
                                : "destructive"
                            }
                            className="text-xs"
                          >
                            {selectedEvent.details.status}
                          </Badge>
                        </div>
                      )}
                    </>
                  )}

                  {/* Decision Details */}
                  {selectedEvent.type === "decision" && (
                    <>
                      {selectedEvent.details.condition && (
                        <div>
                          <span className="font-semibold">Condition:</span>
                          <p className="mt-1 p-2 bg-background rounded">
                            {selectedEvent.details.condition}
                          </p>
                        </div>
                      )}
                      {selectedEvent.details.result && (
                        <div>
                          <span className="font-semibold">Result:</span>
                          <Badge variant="default" className="text-xs ml-2">
                            {selectedEvent.details.result}
                          </Badge>
                        </div>
                      )}
                      {selectedEvent.details.reason && (
                        <div>
                          <span className="font-semibold">Reason:</span>
                          <p className="mt-1 text-muted-foreground">
                            {selectedEvent.details.reason}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Model Selection Details */}
                  {selectedEvent.type === "model_selection" && (
                    <>
                      {selectedEvent.details.modelName && (
                        <div>
                          <span className="font-semibold">Model:</span>
                          <p className="mt-1 font-mono">
                            {selectedEvent.details.modelName}
                          </p>
                        </div>
                      )}
                      {selectedEvent.details.modelVersion && (
                        <div>
                          <span className="font-semibold">Version:</span>
                          <pre className="mt-1 p-2 bg-background rounded text-[10px] break-all">
                            {selectedEvent.details.modelVersion}
                          </pre>
                        </div>
                      )}
                      {selectedEvent.details.modelCost !== undefined && (
                        <div>
                          <span className="font-semibold">Cost:</span>{" "}
                          <span className="font-mono">
                            ${selectedEvent.details.modelCost.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {selectedEvent.details.modelReasoning && (
                        <div>
                          <span className="font-semibold">Reasoning:</span>
                          <p className="mt-1 text-muted-foreground">
                            {selectedEvent.details.modelReasoning}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Timing Details */}
                  {selectedEvent.type === "timing" && (
                    <>
                      {selectedEvent.details.duration !== undefined && (
                        <div>
                          <span className="font-semibold">Duration:</span>{" "}
                          <span className="font-mono">
                            {selectedEvent.details.duration.toFixed(2)}ms
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
