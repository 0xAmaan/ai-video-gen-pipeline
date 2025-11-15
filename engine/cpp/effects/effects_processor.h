#pragma once

#include <string>
#include <vector>

#include "../core/clip.h"

namespace capcut {

struct EffectEvaluation {
  std::string clipId;
  double time;
  std::vector<double> values;
};

class EffectsProcessor {
 public:
  EffectsProcessor();
  EffectEvaluation evaluate(const Clip &clip, double localTimeSeconds);
  void setSimdEnabled(bool enabled) { simdEnabled_ = enabled; }

 private:
  bool simdEnabled_{true};
  std::vector<double> applyEffect(const Effect &effect, double time) const;
};

}  // namespace capcut
