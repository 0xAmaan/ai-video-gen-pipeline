import { useState, useRef, useEffect } from 'react';
import { Video, Download } from 'lucide-react';
import { MultiClipExportProps, ExportOptions } from '../types';
import { formatTime } from '../utils/timeFormat';
import { prepareExportCommand, validateExportData } from '../utils/exportManager';
import { cn } from '../lib/utils';

interface TopNavProps {
  // Recording props
  isRecording: boolean;
  isPicking: boolean;
  isSaving?: boolean;
  elapsedTime: number;
  onStartPicking: () => void;
  onStopRecording: () => void;
  recordingError: string | null;
  onOpenSettings?: () => void;

  // Export props
  clips: MultiClipExportProps['clips'];
  onExportComplete: (path: string) => void;
}

const TopNav = ({
  isRecording,
  isPicking,
  isSaving,
  elapsedTime,
  onStartPicking,
  onStopRecording,
  recordingError,
  onOpenSettings,
  clips,
  onExportComplete,
}: TopNavProps) => {
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState<string>('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<"fast" | "reencode">("fast");
  const [resolution, setResolution] = useState<"720p" | "1080p" | "source">("source");
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showRecordingPopup, setShowRecordingPopup] = useState(false);

  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const recordingPopupRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
      if (recordingPopupRef.current && !recordingPopupRef.current.contains(event.target as Node)) {
        // Don't auto-close recording popup if recording is in progress
        if (!isRecording && !isSaving) {
          setShowRecordingPopup(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRecording, isSaving]);

  // Set up export progress listener
  useEffect(() => {
    window.electronAPI.onExportProgress((progress: number, message?: string) => {
      setExportProgress(Math.round(progress));
      if (message) setExportMessage(message);
    });
  }, []);

  const handleExport = async () => {
    try {
      setExportError(null);
      setSuccessMessage(null);
      setExportProgress(0);
      setExportMessage('');

      const options: ExportOptions = {
        mode: exportMode,
        resolution: exportMode === "reencode" ? resolution : undefined,
      };

      const validation = validateExportData(clips, options);
      if (!validation.valid) {
        setExportError(validation.error || 'Invalid export data');
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const suggestedFilename = `clipforge-export-${timestamp}.mp4`;

      const outputPath = await window.electronAPI.saveFile(suggestedFilename);
      if (!outputPath) return;

      const exportCommand = prepareExportCommand(clips, outputPath, options);

      setIsExporting(true);
      setExportMessage('Preparing export...');

      const result = await window.electronAPI.exportMultiClip(
        exportCommand.clips,
        outputPath,
        { mode: exportMode, resolution: exportMode === "reencode" ? resolution : undefined }
      );

      setIsExporting(false);
      setSuccessMessage(`Video exported successfully!`);
      setExportMessage('');
      onExportComplete(result);

      // Auto-close dropdown after successful export
      setTimeout(() => {
        setShowExportDropdown(false);
        setSuccessMessage(null);
      }, 2000);

    } catch (err) {
      setIsExporting(false);
      setExportMessage('');
      setExportError(err instanceof Error ? err.message : 'Export failed');
      console.error('Export error:', err);
    }
  };

  return (
    <nav className="h-12 bg-panel border-b border-border flex items-center justify-between px-4 pr-6 gap-4">
      {/* Left side - Recording status indicator */}
      <div className="flex items-center gap-3">
        {isRecording && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-red-500">Recording</span>
            <span className="text-sm font-mono text-white">{formatTime(elapsedTime)}</span>
          </div>
        )}
        {isSaving && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-accent">Saving...</span>
          </div>
        )}
        {isExporting && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-green-500">Exporting {exportProgress}%</span>
          </div>
        )}
      </div>

      {/* Right side - Action buttons */}
      <div className="flex items-center gap-3">
        {/* Recording Button with Popup */}
        <div className="relative" ref={recordingPopupRef}>
          <button
            onClick={() => setShowRecordingPopup(!showRecordingPopup)}
            disabled={isPicking || isSaving}
            className={cn(
              "p-2 rounded-md transition-colors cursor-pointer",
              isRecording ? "bg-red-500 hover:bg-red-600" : "bg-accent hover:bg-blue-600",
              (isPicking || isSaving) && "opacity-50 cursor-not-allowed"
            )}
            title={isRecording ? "Stop Recording" : "Start Recording"}
          >
            <Video className="w-5 h-5 text-white" />
          </button>

          {showRecordingPopup && (
            <div className="absolute right-0 top-12 w-80 bg-panel border border-border rounded-lg shadow-xl z-50 p-4">
              <h3 className="text-sm font-semibold mb-3">Screen Recording</h3>

              {recordingError && (
                <div className="mb-3 p-3 bg-red-500/10 border border-red-500 rounded text-sm text-red-500">
                  <div className="whitespace-pre-wrap break-words font-mono text-xs">
                    {recordingError}
                  </div>
                  {recordingError.includes("permission") && onOpenSettings && (
                    <button
                      onClick={onOpenSettings}
                      className="mt-2 px-3 py-1.5 bg-accent hover:bg-blue-600 rounded text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Open System Settings
                    </button>
                  )}
                </div>
              )}

              {!isRecording && !isSaving ? (
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      onStartPicking();
                      // Keep popup open during picking/recording
                    }}
                    disabled={isPicking}
                    className={cn(
                      "w-full px-4 py-2 bg-accent hover:bg-blue-600 rounded text-white font-semibold transition-colors cursor-pointer",
                      isPicking && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isPicking ? "Starting..." : "Start Recording"}
                  </button>
                  <p className="text-xs text-gray-400 italic">
                    Click to select a screen or window to capture
                  </p>
                </div>
              ) : isSaving ? (
                <div className="flex items-center gap-2 text-sm text-accent">
                  <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  Processing and importing video...
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold font-mono">{formatTime(elapsedTime)}</span>
                    <button
                      onClick={() => {
                        onStopRecording();
                        setShowRecordingPopup(false);
                      }}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded text-white font-semibold transition-colors cursor-pointer"
                    >
                      Stop Recording
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Export Button with Dropdown */}
        <div className="relative" ref={exportDropdownRef}>
          <button
            onClick={() => setShowExportDropdown(!showExportDropdown)}
            disabled={clips.length === 0}
            className={cn(
              "p-2 rounded-md transition-colors",
              clips.length === 0
                ? "bg-gray-600 cursor-not-allowed opacity-50"
                : "bg-green-500 hover:bg-green-600 cursor-pointer"
            )}
            title="Export Video"
          >
            <Download className="w-5 h-5 text-white" />
          </button>

          {showExportDropdown && (
            <div className="absolute right-0 top-12 w-96 bg-panel border border-border rounded-lg shadow-xl z-50 p-4 max-h-[80vh] overflow-y-auto">
              <h3 className="text-sm font-semibold mb-3">Export Video</h3>

              {/* Clip Info */}
              <div className="mb-3 p-3 bg-background rounded text-xs flex gap-4">
                <span>
                  <strong className="text-white">Clips:</strong>{' '}
                  <span className="text-gray-400">{clips.length}</span>
                </span>
                <span>
                  <strong className="text-white">Duration:</strong>{' '}
                  <span className="text-gray-400">{formatTime(clips.reduce((sum, clip) => sum + clip.duration, 0))}</span>
                </span>
              </div>

              {/* Export Mode Selection */}
              <div className="mb-3">
                <label className="text-xs font-semibold block mb-2">Export Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setExportMode("fast")}
                    className={cn(
                      "px-3 py-2 rounded text-sm font-semibold transition-all cursor-pointer",
                      exportMode === "fast"
                        ? "bg-accent text-white border-2 border-blue-400"
                        : "bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600"
                    )}
                  >
                    Fast (Copy)
                  </button>
                  <button
                    onClick={() => setExportMode("reencode")}
                    className={cn(
                      "px-3 py-2 rounded text-sm font-semibold transition-all cursor-pointer",
                      exportMode === "reencode"
                        ? "bg-accent text-white border-2 border-blue-400"
                        : "bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600"
                    )}
                  >
                    Re-encode
                  </button>
                </div>
                <p className="text-xs text-gray-400 italic mt-2">
                  {exportMode === "fast"
                    ? "No re-encoding, quick export (same quality)"
                    : "Transcode with resolution options (slower)"}
                </p>
              </div>

              {/* Resolution Selector */}
              {exportMode === "reencode" && (
                <div className="mb-3">
                  <label className="text-xs font-semibold block mb-2">Resolution</label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as "720p" | "1080p" | "source")}
                    className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded text-sm cursor-pointer"
                  >
                    <option value="source">Source (Original)</option>
                    <option value="720p">720p (1280x720)</option>
                    <option value="1080p">1080p (1920x1080)</option>
                  </select>
                </div>
              )}

              {/* Export Button */}
              <button
                onClick={handleExport}
                disabled={isExporting || clips.length === 0}
                className={cn(
                  "w-full px-4 py-2 rounded font-semibold transition-colors",
                  isExporting || clips.length === 0
                    ? "bg-gray-600 cursor-not-allowed opacity-50"
                    : "bg-green-500 hover:bg-green-600 text-white cursor-pointer"
                )}
              >
                {isExporting ? `Exporting... ${exportProgress}%` : `Export ${clips.length} Clip${clips.length !== 1 ? 's' : ''}`}
              </button>

              {/* Progress Bar */}
              {isExporting && (
                <div className="mt-3">
                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                  {exportMessage && (
                    <p className="text-xs text-gray-400 text-center mt-1 italic">
                      {exportMessage}
                    </p>
                  )}
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className="mt-3 p-2 bg-green-500/10 border border-green-500 rounded text-xs text-green-500">
                  ✓ {successMessage}
                </div>
              )}

              {/* Error Message */}
              {exportError && (
                <div className="mt-3 p-2 bg-red-500/10 border border-red-500 rounded text-xs text-red-500">
                  ✗ {exportError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
