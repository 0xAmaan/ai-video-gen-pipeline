/**
 * Performance monitoring and logging system for video export pipeline
 */

export interface PerformanceMetrics {
  // Timing metrics
  totalExportTime: number;
  encodingTime: number;
  renderingTime: number;
  averageFrameTime: number;
  seekTime: number;
  
  // Video processing metrics
  totalFrames: number;
  framesPerSecond: number;
  resolution: { width: number; height: number };
  bitrate: number;
  
  // Memory metrics
  peakMemoryUsage: number;
  averageMemoryUsage: number;
  memoryLeaks?: number;
  
  // Quality metrics
  compression: number;
  fileSize: number;
  
  // System metrics
  timestamp: number;
  browserInfo: string;
  
  // Error tracking
  errors: ExportError[];
  warnings: ExportWarning[];
}

export interface ExportError {
  type: 'seek_timeout' | 'memory_limit' | 'encoding_failure' | 'unknown';
  message: string;
  timestamp: number;
  context?: Record<string, any>;
}

export interface ExportWarning {
  type: 'slow_frame' | 'high_memory' | 'compression_low' | 'unknown';
  message: string;
  timestamp: number;
  value?: number;
  threshold?: number;
}

export interface FrameMetrics {
  frameNumber: number;
  timestamp: number;
  renderTime: number;
  seekTime: number;
  encodeTime: number;
  memoryUsage: number;
}

export class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {
    errors: [],
    warnings: [],
    timestamp: Date.now(),
    browserInfo: this.getBrowserInfo(),
  };
  
  private frameMetrics: FrameMetrics[] = [];
  private timers = new Map<string, number>();
  private memoryObserver?: PerformanceObserver;
  private isMonitoring = false;
  
  constructor() {
    this.setupMemoryMonitoring();
  }
  
  start(): void {
    this.isMonitoring = true;
    this.metrics.timestamp = Date.now();
    this.frameMetrics = [];
    this.timers.clear();
    this.startTimer('total_export');
    
    // Log export start
    console.log('[Export Performance] Starting export with monitoring');
  }
  
  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }
  
  endTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      this.logWarning('unknown', `Timer '${name}' not found`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.timers.delete(name);
    
    // Store key timing metrics
    switch (name) {
      case 'total_export':
        this.metrics.totalExportTime = duration;
        break;
      case 'encoding':
        this.metrics.encodingTime = duration;
        break;
      case 'rendering':
        this.metrics.renderingTime = duration;
        break;
    }
    
    return duration;
  }
  
  recordFrameMetrics(frameNumber: number, timestamp: number, metrics: Partial<FrameMetrics>): void {
    if (!this.isMonitoring) return;
    
    const frameMetric: FrameMetrics = {
      frameNumber,
      timestamp,
      renderTime: metrics.renderTime || 0,
      seekTime: metrics.seekTime || 0,
      encodeTime: metrics.encodeTime || 0,
      memoryUsage: this.getCurrentMemoryUsage(),
    };
    
    this.frameMetrics.push(frameMetric);
    
    // Check for performance issues
    if (frameMetric.renderTime > 100) {
      this.logWarning('slow_frame', `Frame ${frameNumber} took ${frameMetric.renderTime.toFixed(2)}ms to render`, frameMetric.renderTime, 100);
    }
    
    if (frameMetric.memoryUsage > 500 * 1024 * 1024) { // 500MB threshold
      this.logWarning('high_memory', `High memory usage: ${(frameMetric.memoryUsage / 1024 / 1024).toFixed(2)}MB at frame ${frameNumber}`, frameMetric.memoryUsage, 500 * 1024 * 1024);
    }
  }
  
  setVideoMetrics(width: number, height: number, totalFrames: number, bitrate: number): void {
    this.metrics.resolution = { width, height };
    this.metrics.totalFrames = totalFrames;
    this.metrics.bitrate = bitrate;
  }
  
  setFileSize(size: number): void {
    this.metrics.fileSize = size;
    if (this.metrics.resolution) {
      const pixels = this.metrics.resolution.width * this.metrics.resolution.height;
      const duration = (this.metrics.totalFrames || 1) / 30; // Assume 30fps
      const expectedSize = pixels * duration * 0.1; // Rough estimate
      this.metrics.compression = expectedSize / size;
    }
  }
  
  logError(type: ExportError['type'], message: string, context?: Record<string, any>): void {
    const error: ExportError = {
      type,
      message,
      timestamp: Date.now(),
      context,
    };
    
    this.metrics.errors?.push(error);
    console.error(`[Export Error] ${type}: ${message}`, context);
  }
  
  logWarning(type: ExportWarning['type'], message: string, value?: number, threshold?: number): void {
    const warning: ExportWarning = {
      type,
      message,
      timestamp: Date.now(),
      value,
      threshold,
    };
    
    this.metrics.warnings?.push(warning);
    console.warn(`[Export Warning] ${type}: ${message}`);
  }
  
  finish(): PerformanceMetrics {
    if (!this.isMonitoring) {
      throw new Error('PerformanceMonitor not started');
    }
    
    this.endTimer('total_export');
    this.isMonitoring = false;
    
    // Calculate derived metrics
    if (this.frameMetrics.length > 0) {
      const totalRenderTime = this.frameMetrics.reduce((sum, frame) => sum + frame.renderTime, 0);
      this.metrics.averageFrameTime = totalRenderTime / this.frameMetrics.length;
      
      const totalSeekTime = this.frameMetrics.reduce((sum, frame) => sum + frame.seekTime, 0);
      this.metrics.seekTime = totalSeekTime;
      
      if (this.metrics.totalExportTime) {
        this.metrics.framesPerSecond = this.frameMetrics.length / (this.metrics.totalExportTime / 1000);
      }
      
      const memoryUsages = this.frameMetrics.map(f => f.memoryUsage).filter(m => m > 0);
      if (memoryUsages.length > 0) {
        this.metrics.peakMemoryUsage = Math.max(...memoryUsages);
        this.metrics.averageMemoryUsage = memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length;
      }
    }
    
    // Log final metrics summary
    this.logSummary();
    
    // Store metrics for analysis
    this.storeMetrics();
    
    return this.metrics as PerformanceMetrics;
  }
  
  private logSummary(): void {
    const m = this.metrics;
    console.log('[Export Performance] Export completed with metrics:', {
      totalTime: `${m.totalExportTime?.toFixed(2)}ms`,
      avgFrameTime: `${m.averageFrameTime?.toFixed(2)}ms`,
      framesPerSecond: m.framesPerSecond?.toFixed(2),
      peakMemory: m.peakMemoryUsage ? `${(m.peakMemoryUsage / 1024 / 1024).toFixed(2)}MB` : 'N/A',
      fileSize: m.fileSize ? `${(m.fileSize / 1024 / 1024).toFixed(2)}MB` : 'N/A',
      errors: m.errors?.length || 0,
      warnings: m.warnings?.length || 0,
    });
  }
  
  private storeMetrics(): void {
    try {
      const stored = localStorage.getItem('export_performance_history');
      const history = stored ? JSON.parse(stored) : [];
      
      // Keep only last 100 exports
      history.push(this.metrics);
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }
      
      localStorage.setItem('export_performance_history', JSON.stringify(history));
    } catch (error) {
      console.warn('[Performance Monitor] Failed to store metrics:', error);
    }
  }
  
  private getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }
  
  private getBrowserInfo(): string {
    return `${navigator.userAgent} | Memory: ${this.getMemoryInfo()}`;
  }
  
  private getMemoryInfo(): string {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(0)}MB limit`;
    }
    return 'Unknown';
  }
  
  private setupMemoryMonitoring(): void {
    try {
      if ('PerformanceObserver' in window && 'measure' in performance) {
        this.memoryObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure' && entry.name.startsWith('export:')) {
              // Handle custom performance marks if needed
            }
          }
        });
      }
    } catch (error) {
      // Memory monitoring not available
    }
  }
  
  // Static method for easy access to performance history
  static getPerformanceHistory(): PerformanceMetrics[] {
    try {
      const stored = localStorage.getItem('export_performance_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
  
  // Static method for analyzing trends
  static analyzePerformanceTrends(): {
    averageExportTime: number;
    performanceImprovement: number;
    commonIssues: Array<{ type: string; count: number }>;
  } {
    const history = this.getPerformanceHistory();
    if (history.length === 0) {
      return {
        averageExportTime: 0,
        performanceImprovement: 0,
        commonIssues: [],
      };
    }
    
    const avgTime = history.reduce((sum, m) => sum + (m.totalExportTime || 0), 0) / history.length;
    
    // Compare last 10 vs previous 10
    const performanceImprovement = history.length >= 20 ? (
      history.slice(-10).reduce((sum, m) => sum + (m.totalExportTime || 0), 0) / 10 /
      history.slice(-20, -10).reduce((sum, m) => sum + (m.totalExportTime || 0), 0) * 10
    ) - 1 : 0;
    
    // Aggregate common issues
    const issueMap = new Map<string, number>();
    history.forEach(m => {
      m.errors?.forEach(e => {
        issueMap.set(e.type, (issueMap.get(e.type) || 0) + 1);
      });
      m.warnings?.forEach(w => {
        issueMap.set(w.type, (issueMap.get(w.type) || 0) + 1);
      });
    });
    
    const commonIssues = Array.from(issueMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      averageExportTime: avgTime,
      performanceImprovement,
      commonIssues,
    };
  }
}