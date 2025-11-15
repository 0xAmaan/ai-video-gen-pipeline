import { VideoMetadata } from '../types';
import { formatTime } from '../utils/timeFormat';

interface ControlsProps {
  onImport: () => void;
  videoPath: string | null;
  metadata: VideoMetadata | null;
  isLoading?: boolean;
}

/**
 * Controls component
 * Displays import button and video metadata information
 */
export const Controls = ({
  onImport,
  videoPath,
  metadata,
  isLoading = false,
}: ControlsProps) => {
  // Extract filename from full path
  const getFileName = (path: string | null): string => {
    if (!path) return '';
    return path.split('/').pop() || path;
  };

  return (
    <div style={styles.container}>
      <div style={styles.importSection}>
        <button
          onClick={onImport}
          style={styles.importButton}
          disabled={isLoading}
        >
          {isLoading ? '⏳ Loading...' : '📁 Import Video'}
        </button>

        {videoPath && (
          <div style={styles.fileInfo}>
            <div style={styles.fileName} title={videoPath}>
              📹 {getFileName(videoPath)}
            </div>
          </div>
        )}
      </div>

      {metadata && (
        <div style={styles.metadataSection}>
          <div style={styles.metadataTitle}>Video Info</div>
          <div style={styles.metadataGrid}>
            <div style={styles.metadataItem}>
              <span style={styles.metadataLabel}>Duration:</span>
              <span style={styles.metadataValue}>{formatTime(metadata.duration)}</span>
            </div>
            <div style={styles.metadataItem}>
              <span style={styles.metadataLabel}>Resolution:</span>
              <span style={styles.metadataValue}>
                {metadata.width} × {metadata.height}
              </span>
            </div>
            <div style={styles.metadataItem}>
              <span style={styles.metadataLabel}>FPS:</span>
              <span style={styles.metadataValue}>{metadata.fps.toFixed(2)}</span>
            </div>
            <div style={styles.metadataItem}>
              <span style={styles.metadataLabel}>Codec:</span>
              <span style={styles.metadataValue}>{metadata.codec}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Styles
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    border: '1px solid #333',
  },
  importSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  importButton: {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: 'fit-content',
  },
  fileInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  fileName: {
    fontSize: '14px',
    color: '#fff',
    backgroundColor: '#2a2a2a',
    padding: '8px 12px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '400px',
  },
  metadataSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #333',
  },
  metadataTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  metadataGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
  },
  metadataItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  metadataLabel: {
    fontSize: '12px',
    color: '#888',
    fontWeight: '500',
  },
  metadataValue: {
    fontSize: '14px',
    color: '#fff',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
};
