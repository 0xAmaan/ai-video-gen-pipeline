/**
 * Flow Tracker
 *
 * Tracks all API calls, decisions, and model selections during video generation
 * for visualization in the demo mode flow modal.
 */

export interface FlowEvent {
  id: string;
  timestamp: number;
  type: "api_call" | "decision" | "model_selection" | "timing";
  title: string;
  details: {
    // For API calls
    method?: string;
    url?: string;
    requestPayload?: any;
    responsePayload?: any;
    status?: number;

    // For decisions
    condition?: string;
    result?: string;
    reason?: string;

    // For model selections
    modelName?: string;
    modelVersion?: string;
    modelCost?: number;
    modelReasoning?: string;

    // For timing
    duration?: number;
    startTime?: number;
    endTime?: number;
  };
}

class FlowTracker {
  private events: FlowEvent[] = [];
  private listeners: Array<(events: FlowEvent[]) => void> = [];
  private idCounter = 0;
  private lastClearTime: number = 0; // Track when events were manually cleared

  trackAPICall(
    method: string,
    url: string,
    requestPayload?: any,
    responsePayload?: any,
    status?: number,
  ): string {
    const id = this.generateId();
    const event: FlowEvent = {
      id,
      timestamp: Date.now(),
      type: "api_call",
      title: `${method} ${url}`,
      details: {
        method,
        url,
        requestPayload,
        responsePayload,
        status,
      },
    };

    this.addEvent(event);
    return id;
  }

  trackDecision(condition: string, result: string, reason?: string): string {
    const id = this.generateId();
    const event: FlowEvent = {
      id,
      timestamp: Date.now(),
      type: "decision",
      title: `Decision: ${condition}`,
      details: {
        condition,
        result,
        reason,
      },
    };

    this.addEvent(event);
    return id;
  }

  trackModelSelection(
    modelName: string,
    modelVersion?: string,
    modelCost?: number,
    modelReasoning?: string,
  ): string {
    const id = this.generateId();
    const event: FlowEvent = {
      id,
      timestamp: Date.now(),
      type: "model_selection",
      title: `Model: ${modelName}`,
      details: {
        modelName,
        modelVersion,
        modelCost,
        modelReasoning,
      },
    };

    this.addEvent(event);
    return id;
  }

  trackTiming(title: string, duration: number, startTime?: number): string {
    const id = this.generateId();
    const event: FlowEvent = {
      id,
      timestamp: Date.now(),
      type: "timing",
      title: `⏱️ ${title}`,
      details: {
        duration,
        startTime,
        endTime: startTime ? startTime + duration : undefined,
      },
    };

    this.addEvent(event);
    return id;
  }

  updateEvent(id: string, updates: Partial<FlowEvent>): void {
    const index = this.events.findIndex((e) => e.id === id);
    if (index !== -1) {
      this.events[index] = { ...this.events[index], ...updates };
      this.notifyListeners();
    }
  }

  getEvents(): FlowEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
    this.lastClearTime = Date.now();
    this.notifyListeners();
  }

  subscribe(listener: (events: FlowEvent[]) => void): () => void {
    this.listeners.push(listener);

    // Immediately notify new listener of existing events
    if (this.events.length > 0) {
      listener([...this.events]);
    }

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private addEvent(event: FlowEvent): void {
    this.events.push(event);
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener([...this.events]));
  }

  private generateId(): string {
    return `flow-event-${this.idCounter++}-${Date.now()}`;
  }

  exportToJSON(): string {
    return JSON.stringify(this.events, null, 2);
  }

  // Import events from API response (server -> client sync)
  importEvents(events: FlowEvent[]): void {
    if (!Array.isArray(events)) return;

    // Filter out events older than last clear time
    const recentEvents = events.filter((e) => e.timestamp > this.lastClearTime);

    // Merge events, avoiding duplicates by ID
    const existingIds = new Set(this.events.map((e) => e.id));
    const newEvents = recentEvents.filter((e) => !existingIds.has(e.id));

    if (newEvents.length === 0) return;

    this.events.push(...newEvents);
    this.events.sort((a, b) => a.timestamp - b.timestamp);
    this.notifyListeners();
  }
}

// Global singleton instance
let flowTrackerInstance: FlowTracker | null = null;

export const getFlowTracker = (): FlowTracker => {
  if (!flowTrackerInstance) {
    flowTrackerInstance = new FlowTracker();
  }
  return flowTrackerInstance;
};

export const resetFlowTracker = (): void => {
  flowTrackerInstance = null;
};
