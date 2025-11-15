#include "compositor.h"

namespace capcut {

CompositorFrame Compositor::compose(const Sequence &sequence, double timeSeconds) const {
  CompositorFrame frame;
  frame.time = timeSeconds;
  for (const auto &track : sequence.tracks) {
    if (track.kind == TrackKind::Audio) {
      continue;
    }
    for (const auto &clip : track.clips) {
      if (timeSeconds >= clip.start && timeSeconds <= clip.endTime()) {
        frame.clipStack.push_back(clip.id);
        break;
      }
    }
  }
  return frame;
}

}  // namespace capcut
