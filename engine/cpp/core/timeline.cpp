#include "timeline.h"

#include <algorithm>
#include <sstream>
#include <stdexcept>

namespace capcut {
namespace {
std::string escape(const std::string &value) {
  std::string escaped;
  escaped.reserve(value.size());
  for (const char c : value) {
    switch (c) {
      case '\"':
        escaped += "\\\"";
        break;
      case '\\':
        escaped += "\\\\";
        break;
      case '\n':
        escaped += "\\n";
        break;
      default:
        escaped.push_back(c);
        break;
    }
  }
  return escaped;
}

bool clipOverlaps(const Clip &a, const Clip &b) {
  const double startDiff = std::max(a.start, b.start);
  const double endDiff = std::min(a.endTime(), b.endTime());
  return endDiff - startDiff > 1e-6;
}

std::string serializeEffects(const std::vector<Effect> &effects) {
  std::ostringstream out;
  out << '[';
  for (size_t i = 0; i < effects.size(); ++i) {
    const auto &effect = effects[i];
    out << "{\"id\":\"" << escape(effect.id) << "\",";
    out << "\"type\":\"" << escape(effect.type) << "\",";
    out << "\"enabled\":" << (effect.enabled ? "true" : "false") << ",";
    out << "\"params\":{";
    size_t idx = 0;
    for (const auto &entry : effect.params) {
      out << "\"" << escape(entry.first) << "\":" << entry.second;
      if (++idx < effect.params.size()) {
        out << ',';
      }
    }
    out << "}}";
    if (i + 1 < effects.size()) {
      out << ',';
    }
  }
  out << ']';
  return out.str();
}

std::string serializeTransitions(const std::vector<TransitionSpec> &transitions) {
  std::ostringstream out;
  out << '[';
  for (size_t i = 0; i < transitions.size(); ++i) {
    const auto &transition = transitions[i];
    out << "{\"id\":\"" << escape(transition.id) << "\",";
    out << "\"type\":\"" << escape(transition.type) << "\",";
    out << "\"duration\":" << transition.duration << ',';
    out << "\"easing\":" << transition.easing << "}";
    if (i + 1 < transitions.size()) {
      out << ',';
    }
  }
  out << ']';
  return out.str();
}
}  // namespace

Timeline::Timeline() {
  sequence_.tracks.reserve(8);
}

void Timeline::setSequenceMetadata(int width, int height, double fps, int sampleRate) {
  sequence_.width = width;
  sequence_.height = height;
  sequence_.fps = fps;
  sequence_.sampleRate = sampleRate;
}

bool Timeline::addTrack(const Track &track) {
  if (trackIndex_.count(track.id) > 0) {
    return false;
  }
  pushUndo();
  sequence_.tracks.push_back(track);
  trackIndex_[track.id] = sequence_.tracks.size() - 1;
  rebuildIndices();
  return true;
}

bool Timeline::updateTrack(const Track &track) {
  auto *existing = findTrack(track.id);
  if (!existing) {
    return false;
  }
  pushUndo();
  *existing = track;
  rebuildIndices();
  return true;
}

bool Timeline::removeTrack(const std::string &trackId) {
  auto it = trackIndex_.find(trackId);
  if (it == trackIndex_.end()) {
    return false;
  }
  pushUndo();
  sequence_.tracks.erase(sequence_.tracks.begin() + static_cast<long>(it->second));
  rebuildIndices();
  return true;
}

bool Timeline::upsertClip(const Clip &clip) {
  auto *track = findTrack(clip.trackId);
  if (!track) {
    return false;
  }
  auto clipLocation = clipIndex_.find(clip.id);
  if (clipLocation == clipIndex_.end()) {
    if (!validatePlacement(*track, clip, std::nullopt)) {
      return false;
    }
    pushUndo();
    track->clips.push_back(clip);
  } else {
    auto &pair = clipLocation->second;
    auto *existing = &sequence_.tracks[pair.first].clips[pair.second];
    if (!validatePlacement(*track, clip, pair.second)) {
      return false;
    }
    pushUndo();
    *existing = clip;
  }
  std::sort(track->clips.begin(), track->clips.end(),
            [](const Clip &lhs, const Clip &rhs) { return lhs.start < rhs.start; });
  rebuildIndices();
  updateDuration();
  return true;
}

bool Timeline::moveClip(const std::string &clipId, const std::string &targetTrackId,
                        double newStart) {
  auto *clip = findClip(clipId);
  auto *targetTrack = findTrack(targetTrackId);
  if (!clip || !targetTrack) {
    return false;
  }
  Clip candidate = *clip;
  candidate.trackId = targetTrackId;
  candidate.start = newStart;
  if (!validatePlacement(*targetTrack, candidate, std::nullopt)) {
    return false;
  }
  pushUndo();
  *clip = candidate;
  rebuildIndices();
  updateDuration();
  return true;
}

bool Timeline::trimClip(const std::string &clipId, double trimStart, double trimEnd) {
  auto *clip = findClip(clipId);
  if (!clip) {
    return false;
  }
  const double newDuration = std::max(0.0, clip->duration - trimStart - trimEnd);
  if (newDuration <= 0.0) {
    return false;
  }
  pushUndo();
  clip->trimStart += trimStart;
  clip->trimEnd += trimEnd;
  clip->duration = newDuration;
  updateDuration();
  return true;
}

bool Timeline::splitClip(const std::string &clipId, double offsetSeconds) {
  auto *clip = findClip(clipId);
  if (!clip || offsetSeconds <= 0.0 || offsetSeconds >= clip->duration) {
    return false;
  }
  pushUndo();
  Clip secondHalf = *clip;
  secondHalf.id = clip->id + "_b";
  secondHalf.start += offsetSeconds;
  secondHalf.trimStart += offsetSeconds;
  secondHalf.duration -= offsetSeconds;
  clip->duration = offsetSeconds;
  clip->trimEnd += secondHalf.duration;
  auto *track = findTrack(clip->trackId);
  if (!track) {
    return false;
  }
  track->clips.push_back(secondHalf);
  std::sort(track->clips.begin(), track->clips.end(),
            [](const Clip &lhs, const Clip &rhs) { return lhs.start < rhs.start; });
  rebuildIndices();
  updateDuration();
  return true;
}

bool Timeline::rippleDelete(const std::string &clipId) {
  auto *clip = findClip(clipId);
  if (!clip) {
    return false;
  }
  auto *track = findTrack(clip->trackId);
  if (!track) {
    return false;
  }
  const double removedDuration = clip->duration;
  pushUndo();
  track->clips.erase(track->clips.begin() + static_cast<long>(clipIndex_[clipId].second));
  for (auto &otherClip : track->clips) {
    if (otherClip.start >= clip->start) {
      otherClip.start = std::max(0.0, otherClip.start - removedDuration);
    }
  }
  rebuildIndices();
  updateDuration();
  return true;
}

std::optional<TimelineFrameInfo> Timeline::frameAt(double timeSeconds) const {
  for (const auto &track : sequence_.tracks) {
    if (track.kind != TrackKind::Video) {
      continue;
    }
    for (const auto &clip : track.clips) {
      if (timeSeconds >= clip.start && timeSeconds <= clip.endTime()) {
        return TimelineFrameInfo{clip.id, timeSeconds - clip.start, timeSeconds};
      }
    }
  }
  return std::nullopt;
}

std::string Timeline::serialize() const {
  std::ostringstream out;
  out << "{\"sequence\":{";
  out << "\"id\":\"" << escape(sequence_.id) << "\",";
  out << "\"name\":\"" << escape(sequence_.name) << "\",";
  out << "\"width\":" << sequence_.width << ',';
  out << "\"height\":" << sequence_.height << ',';
  out << "\"fps\":" << sequence_.fps << ',';
  out << "\"sampleRate\":" << sequence_.sampleRate << ',';
  out << "\"duration\":" << sequence_.duration << ',';
  out << "\"tracks\":[";
  for (size_t t = 0; t < sequence_.tracks.size(); ++t) {
    const auto &track = sequence_.tracks[t];
    out << "{\"id\":\"" << escape(track.id) << "\",";
    out << "\"kind\":\"" << escape(trackKindToString(track.kind)) << "\",";
    out << "\"allowOverlap\":" << (track.allowOverlap ? "true" : "false") << ',';
    out << "\"locked\":" << (track.locked ? "true" : "false") << ',';
    out << "\"muted\":" << (track.muted ? "true" : "false") << ',';
    out << "\"clips\":[";
    for (size_t c = 0; c < track.clips.size(); ++c) {
      const auto &clip = track.clips[c];
      out << "{\"id\":\"" << escape(clip.id) << "\",";
      out << "\"mediaId\":\"" << escape(clip.mediaId) << "\",";
      out << "\"trackId\":\"" << escape(clip.trackId) << "\",";
      out << "\"kind\":\"" << escape(clipKindToString(clip.kind)) << "\",";
      out << "\"start\":" << clip.start << ',';
      out << "\"duration\":" << clip.duration << ',';
      out << "\"trimStart\":" << clip.trimStart << ',';
      out << "\"trimEnd\":" << clip.trimEnd << ',';
      out << "\"opacity\":" << clip.opacity << ',';
      out << "\"volume\":" << clip.volume << ',';
      out << "\"effects\":" << serializeEffects(clip.effects) << ',';
      out << "\"transitions\":" << serializeTransitions(clip.transitions) << "}";
      if (c + 1 < track.clips.size()) {
        out << ',';
      }
    }
    out << "]}";
    if (t + 1 < sequence_.tracks.size()) {
      out << ',';
    }
  }
  out << "]}}";
  return out.str();
}

void Timeline::pushUndo() {
  undoStack_.push_back(sequence_);
  if (undoStack_.size() > 32) {
    undoStack_.erase(undoStack_.begin());
  }
  clearRedo();
}

void Timeline::clearRedo() { redoStack_.clear(); }

void Timeline::rebuildIndices() {
  trackIndex_.clear();
  clipIndex_.clear();
  for (size_t t = 0; t < sequence_.tracks.size(); ++t) {
    const auto &track = sequence_.tracks[t];
    trackIndex_[track.id] = t;
    for (size_t c = 0; c < track.clips.size(); ++c) {
      clipIndex_[track.clips[c].id] = {t, c};
    }
  }
}

Track *Timeline::findTrack(const std::string &trackId) {
  auto it = trackIndex_.find(trackId);
  if (it == trackIndex_.end()) {
    return nullptr;
  }
  return &sequence_.tracks[it->second];
}

Clip *Timeline::findClip(const std::string &clipId) {
  auto it = clipIndex_.find(clipId);
  if (it == clipIndex_.end()) {
    return nullptr;
  }
  return &sequence_.tracks[it->second.first].clips[it->second.second];
}

bool Timeline::validatePlacement(const Track &track, const Clip &candidate,
                                 std::optional<size_t> ignoreIndex) const {
  if (track.allowOverlap) {
    return true;
  }
  for (size_t i = 0; i < track.clips.size(); ++i) {
    if (ignoreIndex && ignoreIndex.value() == i) {
      continue;
    }
    if (clipOverlaps(track.clips[i], candidate)) {
      return false;
    }
  }
  return true;
}

void Timeline::updateDuration() {
  double maxDuration = 0.0;
  for (const auto &track : sequence_.tracks) {
    for (const auto &clip : track.clips) {
      maxDuration = std::max(maxDuration, clip.endTime());
    }
  }
  sequence_.duration = maxDuration;
}

TrackKind trackKindFromString(const std::string &kind) {
  if (kind == "audio") {
    return TrackKind::Audio;
  }
  if (kind == "overlay") {
    return TrackKind::Overlay;
  }
  if (kind == "fx") {
    return TrackKind::Fx;
  }
  return TrackKind::Video;
}

std::string trackKindToString(TrackKind kind) {
  switch (kind) {
    case TrackKind::Audio:
      return "audio";
    case TrackKind::Overlay:
      return "overlay";
    case TrackKind::Fx:
      return "fx";
    case TrackKind::Video:
    default:
      return "video";
  }
}

}  // namespace capcut
