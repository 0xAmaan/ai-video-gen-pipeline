#pragma once

#include <optional>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

#include "clip.h"

namespace capcut {

enum class TrackKind { Video = 0, Audio = 1, Overlay = 2, Fx = 3 };

struct Track {
  std::string id;
  TrackKind kind{TrackKind::Video};
  bool allowOverlap{false};
  bool locked{false};
  bool muted{false};
  std::vector<Clip> clips{};
};

struct Sequence {
  std::string id{"sequence-0"};
  std::string name{"Main"};
  int width{1920};
  int height{1080};
  double fps{30.0};
  int sampleRate{48000};
  double duration{0.0};
  std::vector<Track> tracks{};
};

struct TimelineFrameInfo {
  std::string clipId;
  double localTime{0.0};
  double globalTime{0.0};
};

class Timeline {
 public:
  Timeline();

  void setSequenceMetadata(int width, int height, double fps, int sampleRate);
  [[nodiscard]] Sequence sequence() const { return sequence_; }
  [[nodiscard]] double duration() const { return sequence_.duration; }

  bool addTrack(const Track &track);
  bool updateTrack(const Track &track);
  bool removeTrack(const std::string &trackId);

  bool upsertClip(const Clip &clip);
  bool moveClip(const std::string &clipId, const std::string &targetTrackId,
                double newStart);
  bool trimClip(const std::string &clipId, double trimStart, double trimEnd);
  bool splitClip(const std::string &clipId, double offsetSeconds);
  bool rippleDelete(const std::string &clipId);

  [[nodiscard]] std::optional<TimelineFrameInfo> frameAt(double timeSeconds) const;

  std::string serialize() const;

 private:
  Sequence sequence_{};
  std::vector<Sequence> undoStack_{};
  std::vector<Sequence> redoStack_{};
  std::unordered_map<std::string, size_t> trackIndex_{};
  std::unordered_map<std::string, std::pair<size_t, size_t>> clipIndex_{};

  void pushUndo();
  void clearRedo();
  void rebuildIndices();
  [[nodiscard]] Track *findTrack(const std::string &trackId);
  [[nodiscard]] Clip *findClip(const std::string &clipId);
  [[nodiscard]] bool validatePlacement(const Track &track,
                                       const Clip &candidate,
                                       std::optional<size_t> ignoreIndex) const;
  void updateDuration();
};

TrackKind trackKindFromString(const std::string &kind);
std::string trackKindToString(TrackKind kind);

}  // namespace capcut
