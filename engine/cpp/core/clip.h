#pragma once

#include <string>
#include <unordered_map>
#include <vector>

namespace capcut {

enum class ClipKind { Video = 0, Audio = 1, Image = 2 };

struct Effect {
  std::string id;
  std::string type;
  std::unordered_map<std::string, double> params;
  bool enabled{true};
};

struct TransitionSpec {
  std::string id;
  std::string type;
  double duration{0.0};
  double easing{0.0};
};

struct Clip {
  std::string id;
  std::string mediaId;
  std::string trackId;
  ClipKind kind{ClipKind::Video};
  double start{0.0};
  double duration{0.0};
  double trimStart{0.0};
  double trimEnd{0.0};
  double opacity{1.0};
  double volume{1.0};
  std::vector<Effect> effects{};
  std::vector<TransitionSpec> transitions{};

  [[nodiscard]] double endTime() const { return start + duration; }
};

ClipKind clipKindFromString(const std::string &kind);
std::string clipKindToString(ClipKind kind);

}  // namespace capcut
