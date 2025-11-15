import { X, Clock } from 'lucide-react';
import { MediaThumbnailProps } from '../types';
import { formatTime } from '../utils/timeFormat';

/**
 * MediaThumbnail component
 * Displays a single media item in the library with thumbnail and metadata
 */
export const MediaThumbnail = ({
  item,
  onClick,
  onRemove,
}: MediaThumbnailProps) => {
  // Format file size to human-readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering onClick
    onRemove();
  };

  return (
    <div
      className="group flex flex-col bg-panel rounded border border-border cursor-pointer transition-all hover:border-accent hover:shadow-md hover:shadow-accent/20 overflow-hidden"
      onClick={onClick}
      draggable="true"
    >
      {/* Thumbnail Image */}
      <div className="relative w-full aspect-video bg-background overflow-hidden">
        <img
          src={window.electronAPI.getFileUrl(item.thumbnail)}
          alt={item.fileName}
          className="w-full h-full object-cover"
        />

        {/* Duration Badge */}
        <div className="absolute bottom-1 right-1 flex items-center gap-0.5 px-1.5 py-0.5 bg-black/80 rounded text-[10px] font-semibold font-mono text-white">
          <Clock className="w-2.5 h-2.5" />
          {formatTime(item.duration)}
        </div>

        {/* Remove Button */}
        <button
          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-black/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          onClick={handleRemoveClick}
          title="Remove from library"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      </div>

      {/* Metadata - always show filename */}
      <div className="px-1.5 py-1.5">
        <div
          className="text-[10px] font-medium text-gray-300 truncate"
          title={item.fileName}
        >
          {item.fileName}
        </div>
      </div>
    </div>
  );
};
