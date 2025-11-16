"use client";

import { useState, useEffect } from "react";
import { PerformanceMonitor, type PerformanceMetrics } from "@/lib/editor/export/performance-monitor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  Clock, 
  HardDrive, 
  Zap, 
  TrendingUp, 
  AlertTriangle,
  Download,
  Trash2
} from "lucide-react";

interface PerformanceDashboardProps {
  isVisible: boolean;
  onClose: () => void;
}

export const PerformanceDashboard = ({ isVisible, onClose }: PerformanceDashboardProps) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [trends, setTrends] = useState<ReturnType<typeof PerformanceMonitor.analyzePerformanceTrends> | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    if (isVisible) {
      loadPerformanceData();
    }
  }, [isVisible]);

  const loadPerformanceData = () => {
    const history = PerformanceMonitor.getPerformanceHistory();
    const trends = PerformanceMonitor.analyzePerformanceTrends();
    setMetrics(history);
    setTrends(trends);
    if (history.length > 0) {
      setSelectedMetric(history[history.length - 1]); // Latest export
    }
  };

  const clearHistory = () => {
    localStorage.removeItem('export_performance_history');
    setMetrics([]);
    setTrends(null);
    setSelectedMetric(null);
  };

  const exportData = () => {
    const data = {
      metrics,
      trends,
      exportDate: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export-performance-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  const formatMemory = (bytes?: number) => {
    if (!bytes) return 'N/A';
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  const getPerformanceScore = (metric: PerformanceMetrics) => {
    // Simple scoring algorithm based on various factors
    let score = 100;
    
    // Penalize for slow exports (assuming target is <30 seconds for 5-minute video)
    if (metric.totalExportTime > 30000) score -= 20;
    
    // Penalize for slow frame rates
    if (metric.averageFrameTime > 100) score -= 15;
    
    // Penalize for high memory usage
    if (metric.peakMemoryUsage > 1024 * 1024 * 1024) score -= 10; // > 1GB
    
    // Penalize for errors
    score -= (metric.errors?.length || 0) * 10;
    score -= (metric.warnings?.length || 0) * 5;
    
    return Math.max(0, score);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[90vw] h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Export Performance Dashboard
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportData} disabled={metrics.length === 0}>
              <Download className="w-4 h-4 mr-1" />
              Export Data
            </Button>
            <Button variant="outline" size="sm" onClick={clearHistory} disabled={metrics.length === 0}>
              <Trash2 className="w-4 h-4 mr-1" />
              Clear History
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          {metrics.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <BarChart3 className="w-16 h-16 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Performance Data</h3>
              <p>Export a video to start collecting performance metrics.</p>
            </div>
          ) : (
            <Tabs defaultValue="overview" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="trends">Trends</TabsTrigger>
              </TabsList>
              
              <div className="flex-1 overflow-auto p-4">
                <TabsContent value="overview" className="space-y-4">
                  {selectedMetric && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Total Export Time</CardTitle>
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{formatDuration(selectedMetric.totalExportTime)}</div>
                          <p className="text-xs text-muted-foreground">
                            Avg frame: {formatDuration(selectedMetric.averageFrameTime)}
                          </p>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                          <HardDrive className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{formatMemory(selectedMetric.peakMemoryUsage)}</div>
                          <p className="text-xs text-muted-foreground">
                            Peak usage
                          </p>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Export Quality</CardTitle>
                          <Zap className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{formatFileSize(selectedMetric.fileSize)}</div>
                          <p className="text-xs text-muted-foreground">
                            {selectedMetric.resolution?.width}x{selectedMetric.resolution?.height} @ {selectedMetric.framesPerSecond?.toFixed(1)}fps
                          </p>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{getPerformanceScore(selectedMetric)}/100</div>
                          <Progress value={getPerformanceScore(selectedMetric)} className="mt-2" />
                        </CardContent>
                      </Card>
                    </div>
                  )}
                  
                  {selectedMetric && (selectedMetric.errors?.length || 0) + (selectedMetric.warnings?.length || 0) > 0 && (
                    <Card className="border-orange-200">
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                          Issues Detected
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {selectedMetric.errors?.map((error, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <Badge variant="destructive" className="text-xs">Error</Badge>
                              <div className="text-sm">
                                <div className="font-medium">{error.type}</div>
                                <div className="text-muted-foreground">{error.message}</div>
                              </div>
                            </div>
                          ))}
                          {selectedMetric.warnings?.map((warning, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <Badge variant="secondary" className="text-xs">Warning</Badge>
                              <div className="text-sm">
                                <div className="font-medium">{warning.type}</div>
                                <div className="text-muted-foreground">{warning.message}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                
                <TabsContent value="history" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Export History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-96 overflow-auto">
                        {metrics.slice(-20).reverse().map((metric, index) => (
                          <div 
                            key={metric.timestamp}
                            className={`p-3 border rounded cursor-pointer transition-colors ${
                              selectedMetric?.timestamp === metric.timestamp 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => setSelectedMetric(metric)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-sm">
                                  {new Date(metric.timestamp).toLocaleString()}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {metric.resolution?.width}x{metric.resolution?.height} • {formatDuration(metric.totalExportTime)}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Badge variant={getPerformanceScore(metric) >= 80 ? "default" : getPerformanceScore(metric) >= 60 ? "secondary" : "destructive"} className="text-xs">
                                  {getPerformanceScore(metric)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="details" className="space-y-4">
                  {selectedMetric && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Timing Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between">
                            <span>Total Export Time:</span>
                            <span className="font-mono">{formatDuration(selectedMetric.totalExportTime)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Rendering Time:</span>
                            <span className="font-mono">{formatDuration(selectedMetric.renderingTime)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Encoding Time:</span>
                            <span className="font-mono">{formatDuration(selectedMetric.encodingTime)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Seek Time:</span>
                            <span className="font-mono">{formatDuration(selectedMetric.seekTime)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Average Frame Time:</span>
                            <span className="font-mono">{formatDuration(selectedMetric.averageFrameTime)}</span>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader>
                          <CardTitle>Video Metrics</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between">
                            <span>Resolution:</span>
                            <span className="font-mono">
                              {selectedMetric.resolution?.width}x{selectedMetric.resolution?.height}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Frames:</span>
                            <span className="font-mono">{selectedMetric.totalFrames}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Frames per Second:</span>
                            <span className="font-mono">{selectedMetric.framesPerSecond?.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>File Size:</span>
                            <span className="font-mono">{formatFileSize(selectedMetric.fileSize)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Compression Ratio:</span>
                            <span className="font-mono">{selectedMetric.compression?.toFixed(2)}x</span>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader>
                          <CardTitle>Memory Usage</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between">
                            <span>Peak Memory:</span>
                            <span className="font-mono">{formatMemory(selectedMetric.peakMemoryUsage)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Average Memory:</span>
                            <span className="font-mono">{formatMemory(selectedMetric.averageMemoryUsage)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Browser Info:</span>
                            <span className="font-mono text-xs truncate max-w-48" title={selectedMetric.browserInfo}>
                              {selectedMetric.browserInfo}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="trends" className="space-y-4">
                  {trends && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Performance Trends</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between">
                            <span>Average Export Time:</span>
                            <span className="font-mono">{formatDuration(trends.averageExportTime)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Performance Change:</span>
                            <span className={`font-mono ${trends.performanceImprovement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {trends.performanceImprovement >= 0 ? '+' : ''}{(trends.performanceImprovement * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Exports:</span>
                            <span className="font-mono">{metrics.length}</span>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader>
                          <CardTitle>Common Issues</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {trends.commonIssues.length > 0 ? (
                            <div className="space-y-2">
                              {trends.commonIssues.map((issue, index) => (
                                <div key={index} className="flex justify-between">
                                  <span className="capitalize">{issue.type.replace('_', ' ')}:</span>
                                  <span className="font-mono">{issue.count}x</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-muted-foreground">No recurring issues detected</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
};