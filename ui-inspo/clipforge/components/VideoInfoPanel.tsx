import { useState, useRef, useEffect } from 'react';
import { Clip, VideoMetadata, MultiClipExportProps, ExportOptions } from '../types';
import { formatTime } from '../utils/timeFormat';
import { Info, Film, Scissors, Clock, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { prepareExportCommand, validateExportData } from '../utils/exportManager';

interface VideoInfoPanelProps {
  selectedClip: Clip | null;
  totalClips: number;
  totalDuration: number;
  currentTime: number;
  clips: MultiClipExportProps['clips'];
  onExportComplete: (path: string) => void;
}

const VideoInfoPanel = ({
  selectedClip,
  totalClips,
  totalDuration,
  currentTime,
  clips,
  onExportComplete,
}: VideoInfoPanelProps) => {
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState<string>('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<"fast" | "reencode">("fast");
  const [resolution, setResolution] = useState<"720p" | "1080p" | "source">("source");
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const formatResolution = (metadata?: VideoMetadata) => {
    if (!metadata) return 'N/A';
    return `${metadata.width}x${metadata.height}`;
  };

  return (
    <div className="h-full flex flex-col bg-panel border-l border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border relative">
        <div className="flex items-center justify-center gap-2">
          <Info className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-bold tracking-wide">Video Info</h2>
        </div>

        {/* Export Button */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2" ref={exportDropdownRef}>
          <button
            onClick={() => setShowExportDropdown(!showExportDropdown)}
            disabled={clips.length === 0}
            className={cn(
              "p-2 rounded transition-colors",
              clips.length === 0
                ? "bg-gray-600 cursor-not-allowed opacity-50"
                : "bg-green-500 hover:bg-green-600 cursor-pointer"
            )}
            title="Export Video"
          >
            <Download className="w-4 h-4 text-white" />
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Project Stats */}
        <div className="space-y-2.5 p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 text-center">
            Project
          </h3>
          <InfoRow
            icon={<Film className="w-3.5 h-3.5" />}
            label="Total Clips"
            value={totalClips.toString()}
          />
          <InfoRow
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Total Duration"
            value={formatTime(totalDuration)}
          />
          <InfoRow
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Current Time"
            value={formatTime(currentTime)}
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Selected Clip Info */}
        {selectedClip ? (
          <div className="space-y-2.5 p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 text-center">
              Selected Clip
            </h3>
            <InfoRow
              label="Clip ID"
              value={selectedClip.id.substring(0, 8)}
              mono
            />
            <InfoRow
              icon={<Clock className="w-3.5 h-3.5" />}
              label="Duration"
              value={formatTime(selectedClip.duration)}
            />
            <InfoRow
              icon={<Scissors className="w-3.5 h-3.5" />}
              label="Source Trim"
              value={`${formatTime(selectedClip.sourceStart)} - ${formatTime(selectedClip.sourceEnd)}`}
            />
            <InfoRow
              label="Timeline Start"
              value={formatTime(selectedClip.timelineStart)}
            />

            {selectedClip.sourceMetadata && (
              <>
                <div className="h-px bg-border my-2" />
                <InfoRow
                  label="Resolution"
                  value={formatResolution(selectedClip.sourceMetadata)}
                />
                <InfoRow
                  label="Frame Rate"
                  value={`${selectedClip.sourceMetadata.fps.toFixed(2)} fps`}
                />
                {selectedClip.sourceMetadata.codec && (
                  <InfoRow
                    label="Codec"
                    value={selectedClip.sourceMetadata.codec}
                  />
                )}
              </>
            )}

            <div className="h-px bg-border my-2" />
            <div className="space-y-1">
              <div className="text-xs text-gray-400">Source File</div>
              <div className="text-xs text-white break-all font-mono bg-black/30 p-2 rounded">
                {selectedClip.sourceFilePath.split('/').pop() || selectedClip.sourceFilePath}
              </div>
              <div className="text-xs text-gray-500 break-all">
                {selectedClip.sourceFilePath}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4 text-center">
              Selected Clip
            </h3>
            <Film className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              No clip selected
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Click a clip on the timeline to view details
            </p>
          </div>
        )}

        {/* Divider */}
        {totalClips === 0 && <div className="h-px bg-border" />}

        {/* Tips Section */}
        {totalClips === 0 && (
          <div className="bg-gray-500/10 p-4 space-y-2 flex-1">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 text-center">
              Getting Started
            </h3>
            <p className="text-xs text-gray-300 font-semibold">Quick Tips</p>
            <ul className="text-xs text-gray-400 space-y-1.5 list-disc list-inside">
              <li>Import videos from the Media Library</li>
              <li>Click videos to add them to timeline</li>
              <li>Drag clips to reorder them</li>
              <li>Trim clips using edge handles</li>
              <li>Export when ready</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper component for info rows
const InfoRow = ({
  icon,
  label,
  value,
  mono = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div className="flex items-center justify-between gap-2 text-xs">
    <div className="flex items-center gap-1.5 text-gray-400">
      {icon}
      <span>{label}</span>
    </div>
    <div className={`text-white text-right ${mono ? 'font-mono' : ''}`}>
      {value}
    </div>
  </div>
);

export default VideoInfoPanel;
