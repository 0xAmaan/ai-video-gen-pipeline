#include "effects_processor.h"

#include <cmath>

namespace capcut {

EffectsProcessor::EffectsProcessor() = default;

std::vector<double> EffectsProcessor::applyEffect(const Effect &effect, double time) const {
  std::vector<double> response;
  response.reserve(effect.params.size());
  for (const auto &entry : effect.params) {
    const double modulation = simdEnabled_ ? std::sin(time * 0.5) : 1.0;
    response.push_back(entry.second * modulation);
  }
  return response;
}

EffectEvaluation EffectsProcessor::evaluate(const Clip &clip, double localTimeSeconds) {
  EffectEvaluation evaluation;
  evaluation.clipId = clip.id;
  evaluation.time = localTimeSeconds;
  for (const auto &effect : clip.effects) {
    if (!effect.enabled) {
      continue;
    }
    auto values = applyEffect(effect, localTimeSeconds);
    evaluation.values.insert(evaluation.values.end(), values.begin(), values.end());
  }
  return evaluation;
}

}  // namespace capcut
