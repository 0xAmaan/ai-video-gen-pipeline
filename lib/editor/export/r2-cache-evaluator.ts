/**
 * Evaluates when R2 caching becomes necessary for video exports
 * Based on the Linear ticket requirements for 4K 5-minute videos
 */

export interface CacheEvaluationResult {
  shouldUseCache: boolean;
  reason: string;
  estimatedSize: number; // in MB
  estimatedCost: number; // in USD per month
  recommendation: 'browser_only' | 'cache_recommended' | 'cache_required';
}

export interface VideoSpecs {
  width: number;
  height: number;
  duration: number; // in seconds
  fps: number;
  quality: 'low' | 'medium' | 'high';
}

export class R2CacheEvaluator {
  // R2 pricing (as of 2024)
  private static readonly R2_STORAGE_COST_PER_GB_MONTH = 0.015; // $0.015 per GB per month
  private static readonly R2_REQUEST_COST_PUT = 0.0036 / 1000; // $0.0036 per 1000 PUT requests
  private static readonly R2_REQUEST_COST_GET = 0.00036 / 1000; // $0.00036 per 1000 GET requests
  
  // Browser limitations
  private static readonly MAX_BROWSER_MEMORY = 2 * 1024; // 2GB in MB (conservative estimate)
  private static readonly MAX_SAFE_FILE_SIZE = 500; // 500MB (safe browser download limit)
  
  static evaluate(specs: VideoSpecs): CacheEvaluationResult {
    const estimatedSize = this.estimateVideoSize(specs);
    const estimatedCost = this.estimateMonthlyCost(estimatedSize);
    
    // Evaluate based on multiple factors
    const evaluation = this.performEvaluation(specs, estimatedSize);
    
    return {
      shouldUseCache: evaluation.recommendation !== 'browser_only',
      reason: evaluation.reason,
      estimatedSize,
      estimatedCost,
      recommendation: evaluation.recommendation,
    };
  }
  
  private static estimateVideoSize(specs: VideoSpecs): number {
    // Estimate video size based on resolution, duration, fps, and quality
    const { width, height, duration, fps, quality } = specs;
    
    // Baseline bitrate per pixel per frame (rough estimates)
    const qualityMultipliers = {
      low: 0.1,
      medium: 0.2,
      high: 0.4,
    };
    
    const pixels = width * height;
    const totalFrames = duration * fps;
    const qualityMultiplier = qualityMultipliers[quality];
    
    // Estimate bits per pixel per frame, then convert to MB
    const bitsPerPixelPerFrame = qualityMultiplier;
    const totalBits = pixels * totalFrames * bitsPerPixelPerFrame;
    const totalBytes = totalBits / 8;
    const totalMB = totalBytes / (1024 * 1024);
    
    // Add overhead for container format, metadata, etc.
    return totalMB * 1.1;
  }
  
  private static estimateMonthlyCost(fileSizeMB: number): number {
    const fileSizeGB = fileSizeMB / 1024;
    
    // Assume average usage: 50 exports per month, 10 downloads per export
    const monthlyExports = 50;
    const downloadsPerExport = 10;
    
    const storageCost = fileSizeGB * this.R2_STORAGE_COST_PER_GB_MONTH;
    const putCost = monthlyExports * this.R2_REQUEST_COST_PUT * 1000;
    const getCost = monthlyExports * downloadsPerExport * this.R2_REQUEST_COST_GET * 1000;
    
    return storageCost + putCost + getCost;
  }
  
  private static performEvaluation(
    specs: VideoSpecs,
    estimatedSize: number
  ): {
    recommendation: 'browser_only' | 'cache_recommended' | 'cache_required';
    reason: string;
  } {
    const { width, height, duration } = specs;
    
    // Check if it's 4K content
    const is4K = width >= 3840 && height >= 2160;
    const isHighResolution = width >= 1920 && height >= 1080;
    const isLongDuration = duration >= 300; // 5 minutes
    
    // Critical factors that require caching
    if (estimatedSize > this.MAX_SAFE_FILE_SIZE) {
      return {
        recommendation: 'cache_required',
        reason: `File size (${estimatedSize.toFixed(1)}MB) exceeds browser safe download limit (${this.MAX_SAFE_FILE_SIZE}MB). Caching required for reliable downloads.`
      };
    }
    
    if (estimatedSize > this.MAX_BROWSER_MEMORY / 4) {
      return {
        recommendation: 'cache_required',
        reason: `File size (${estimatedSize.toFixed(1)}MB) may cause browser memory issues during export. Caching required for stability.`
      };
    }
    
    // Factors that recommend caching
    if (is4K && isLongDuration) {
      return {
        recommendation: 'cache_recommended',
        reason: `4K video at ${(duration/60).toFixed(1)} minutes (${estimatedSize.toFixed(1)}MB) benefits from caching for improved user experience and reliability.`
      };
    }
    
    if (estimatedSize > 100) { // > 100MB
      return {
        recommendation: 'cache_recommended',
        reason: `Large file size (${estimatedSize.toFixed(1)}MB) would benefit from caching to improve export performance and reduce browser strain.`
      };
    }
    
    if (isHighResolution && duration >= 180) { // HD+ and 3+ minutes
      return {
        recommendation: 'cache_recommended',
        reason: `High resolution video at ${(duration/60).toFixed(1)} minutes may benefit from caching for better performance.`
      };
    }
    
    // Browser can handle this fine
    return {
      recommendation: 'browser_only',
      reason: `Video specs (${width}x${height}, ${(duration/60).toFixed(1)}min, ${estimatedSize.toFixed(1)}MB) are within browser capabilities. No caching needed.`
    };
  }
  
  // Helper method to get recommendations for common video specs
  static getRecommendationsForCommonSpecs(): Array<{
    label: string;
    specs: VideoSpecs;
    evaluation: CacheEvaluationResult;
  }> {
    const commonSpecs: Array<{ label: string; specs: VideoSpecs }> = [
      {
        label: "4K 5-minute high quality",
        specs: { width: 3840, height: 2160, duration: 300, fps: 30, quality: 'high' }
      },
      {
        label: "4K 2-minute medium quality", 
        specs: { width: 3840, height: 2160, duration: 120, fps: 30, quality: 'medium' }
      },
      {
        label: "1080p 5-minute high quality",
        specs: { width: 1920, height: 1080, duration: 300, fps: 30, quality: 'high' }
      },
      {
        label: "1080p 2-minute medium quality",
        specs: { width: 1920, height: 1080, duration: 120, fps: 30, quality: 'medium' }
      },
      {
        label: "720p 5-minute high quality",
        specs: { width: 1280, height: 720, duration: 300, fps: 30, quality: 'high' }
      },
    ];
    
    return commonSpecs.map(({ label, specs }) => ({
      label,
      specs,
      evaluation: this.evaluate(specs)
    }));
  }
  
  // Method to check if current browser has sufficient capabilities
  static checkBrowserCapabilities(): {
    hasEnoughMemory: boolean;
    hasFileSystemAPI: boolean;
    hasOffscreenCanvas: boolean;
    hasWebWorkers: boolean;
    recommendation: string;
  } {
    const hasEnoughMemory = 'memory' in performance ? 
      (performance as any).memory?.jsHeapSizeLimit >= (1024 * 1024 * 1024) : // 1GB
      true; // Assume sufficient if we can't check
      
    const hasFileSystemAPI = 'showSaveFilePicker' in window;
    const hasOffscreenCanvas = 'OffscreenCanvas' in window;
    const hasWebWorkers = 'Worker' in window;
    
    let recommendation = "Browser fully supports in-browser video export.";
    
    if (!hasEnoughMemory) {
      recommendation = "Browser may have memory limitations. Consider caching for large videos.";
    }
    
    if (!hasFileSystemAPI) {
      recommendation += " File System Access API not available - downloads will use fallback method.";
    }
    
    return {
      hasEnoughMemory,
      hasFileSystemAPI,
      hasOffscreenCanvas,
      hasWebWorkers,
      recommendation
    };
  }
}