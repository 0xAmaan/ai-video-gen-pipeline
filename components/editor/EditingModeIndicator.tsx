import { memo } from 'react';
import type { EditingMode } from '@/lib/editor/hooks/useSlipSlideMode';

interface EditingModeIndicatorProps {
  mode: EditingMode;
  clipId: string | null;
  visible: boolean;
  position?: { x: number; y: number };
}

/**
 * Visual indicator showing the current editing mode (slip/slide).
 * Displays a tooltip near the cursor during slip/slide operations.
 */
export const EditingModeIndicator = memo(function EditingModeIndicator({
  mode,
  clipId,
  visible,
  position,
}: EditingModeIndicatorProps) {
  if (!visible || mode === 'normal' || !clipId) {
    return null;
  }

  const modeInfo = {
    slip: {
      title: 'Slip Edit',
      description: 'Alt+Drag: Adjust content offset',
      color: 'bg-blue-500/90',
      icon: '↔',
    },
    slide: {
      title: 'Slide Edit',
      description: 'Cmd+Alt+Drag: Move with gap preservation',
      color: 'bg-purple-500/90',
      icon: '⇄',
    },
  };

  const info = modeInfo[mode as keyof typeof modeInfo];
  if (!info) return null;

  return (
    <div
      className="fixed pointer-events-none z-[9999] animate-in fade-in duration-150"
      style={{
        left: position ? `${position.x + 20}px` : '50%',
        top: position ? `${position.y - 40}px` : '50%',
        transform: position ? 'none' : 'translate(-50%, -50%)',
      }}
    >
      <div className={`${info.color} text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2`}>
        <span className="text-lg">{info.icon}</span>
        <div className="flex flex-col">
          <span className="font-bold">{info.title}</span>
          <span className="text-xs opacity-90">{info.description}</span>
        </div>
      </div>
    </div>
  );
});
