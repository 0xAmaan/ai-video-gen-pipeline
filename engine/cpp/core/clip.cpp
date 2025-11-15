#include "clip.h"

namespace capcut {

ClipKind clipKindFromString(const std::string &kind) {
  if (kind == "audio") {
    return ClipKind::Audio;
  }
  if (kind == "image") {
    return ClipKind::Image;
  }
  return ClipKind::Video;
}

std::string clipKindToString(ClipKind kind) {
  switch (kind) {
    case ClipKind::Audio:
      return "audio";
    case ClipKind::Image:
      return "image";
    case ClipKind::Video:
    default:
      return "video";
  }
}

}  // namespace capcut
