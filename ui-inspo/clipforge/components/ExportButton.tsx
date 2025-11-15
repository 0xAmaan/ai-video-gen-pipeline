import { useState, useEffect } from 'react';
import { MultiClipExportProps, ExportOptions } from '../types';
import { formatTime } from '../utils/timeFormat';
import { prepareExportCommand, validateExportData } from '../utils/exportManager';

/**
 * ExportButton Component - Multi-Clip Support
 * Handles multi-clip video export with mode selection (fast/re-encode)
 * and progress tracking
 */
const ExportButton = ({ clips, onExportComplete }: MultiClipExportProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Export options state
  const [exportMode, setExportMode] = useState<"fast" | "reencode">("fast");
  const [resolution, setResolution] = useState<"720p" | "1080p" | "source">("source");

  // Calculate total duration
  const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);

  // Set up progress listener on mount
  useEffect(() => {
    window.electronAPI.onExportProgress((progress: number, message?: string) => {
      setExportProgress(Math.round(progress));
      if (message) setExportMessage(message);
    });
  }, []);

  const handleExport = async () => {
    try {
      // Reset state
      setError(null);
      setSuccessMessage(null);
      setExportProgress(0);
      setExportMessage('');

      // Validate clips
      const options: ExportOptions = {
        mode: exportMode,
        resolution: exportMode === "reencode" ? resolution : undefined,
      };

      const validation = validateExportData(clips, options);
      if (!validation.valid) {
        setError(validation.error || 'Invalid export data');
        return;
      }

      // Generate output filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const suggestedFilename = `clipforge-export-${timestamp}.mp4`;

      // Show save dialog
      const outputPath = await window.electronAPI.saveFile(suggestedFilename);

      if (!outputPath) {
        // User cancelled the save dialog
        return;
      }

      // Prepare export command
      const exportCommand = prepareExportCommand(clips, outputPath, options);

      // Start export
      setIsExporting(true);
      setExportMessage('Preparing export...');

      // Export multiple clips using FFmpeg
      const result = await window.electronAPI.exportMultiClip(
        exportCommand.clips,
        outputPath,
        { mode: exportMode, resolution: exportMode === "reencode" ? resolution : undefined }
      );

      // Success!
      setIsExporting(false);
      setSuccessMessage(`Video exported successfully to: ${result}`);
      setExportMessage('');

      // Call the completion callback
      onExportComplete(result);

    } catch (err) {
      setIsExporting(false);
      setExportMessage('');
      setError(err instanceof Error ? err.message : 'Export failed');
      console.error('Export error:', err);
    }
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Export Info */}
      <div style={{
        fontSize: '14px',
        color: '#888',
        display: 'flex',
        gap: '16px',
        padding: '12px',
        backgroundColor: '#1a1a1a',
        borderRadius: '6px',
      }}>
        <span>
          <strong style={{ color: '#fff' }}>Clips:</strong> {clips.length}
        </span>
        <span>
          <strong style={{ color: '#fff' }}>Total Duration:</strong> {formatTime(totalDuration)}
        </span>
      </div>

      {/* Export Mode Selection */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '12px',
        backgroundColor: '#1a1a1a',
        borderRadius: '6px',
      }}>
        <label style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
          Export Mode:
        </label>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setExportMode("fast")}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '14px',
              fontWeight: '600',
              backgroundColor: exportMode === "fast" ? '#3b82f6' : '#333',
              color: 'white',
              border: exportMode === "fast" ? '2px solid #60a5fa' : '1px solid #555',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Fast
          </button>
          <button
            onClick={() => setExportMode("reencode")}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '14px',
              fontWeight: '600',
              backgroundColor: exportMode === "reencode" ? '#3b82f6' : '#333',
              color: 'white',
              border: exportMode === "reencode" ? '2px solid #60a5fa' : '1px solid #555',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Re-encode
          </button>
        </div>

        {/* Mode Description */}
        <div style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>
          {exportMode === "fast"
            ? "Fast mode: Quick encoding with ultrafast preset (good quality)"
            : "Re-encode mode: Higher quality encoding with resolution options (slower)"}
        </div>

        {/* Resolution Selector (only for re-encode mode) */}
        {exportMode === "reencode" && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
              Resolution:
            </label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value as "720p" | "1080p" | "source")}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                backgroundColor: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              <option value="source">Source (Original)</option>
              <option value="720p">720p (1280x720)</option>
              <option value="1080p">1080p (1920x1080)</option>
            </select>
          </div>
        )}
      </div>

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={isExporting || clips.length === 0}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          fontWeight: '600',
          backgroundColor: isExporting ? '#9ca3af' : '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: isExporting || clips.length === 0 ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
          opacity: isExporting || clips.length === 0 ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isExporting && clips.length > 0) {
            e.currentTarget.style.backgroundColor = '#059669';
          }
        }}
        onMouseLeave={(e) => {
          if (!isExporting && clips.length > 0) {
            e.currentTarget.style.backgroundColor = '#10b981';
          }
        }}
      >
        {isExporting ? `Exporting... ${exportProgress}%` : `Export ${clips.length} Clip${clips.length !== 1 ? 's' : ''}`}
      </button>

      {/* Progress Bar */}
      {isExporting && (
        <div>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#333',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '8px',
          }}>
            <div
              style={{
                width: `${exportProgress}%`,
                height: '100%',
                backgroundColor: '#10b981',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          {exportMessage && (
            <div style={{
              fontSize: '12px',
              color: '#888',
              textAlign: 'center',
              fontStyle: 'italic',
            }}>
              {exportMessage}
            </div>
          )}
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div style={{
          padding: '12px',
          backgroundColor: '#064e3b',
          color: '#6ee7b7',
          borderRadius: '6px',
          fontSize: '14px',
          wordBreak: 'break-word',
          border: '1px solid #10b981',
        }}>
          ✓ {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#7f1d1d',
          color: '#fca5a5',
          borderRadius: '6px',
          fontSize: '14px',
          border: '1px solid #dc2626',
        }}>
          ✗ {error}
        </div>
      )}
    </div>
  );
};

export default ExportButton;
