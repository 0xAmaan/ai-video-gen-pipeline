#pragma once

#include <vector>

#include "../core/timeline.h"

namespace capcut {

struct CompositorFrame {
  double time{0.0};
  std::vector<std::string> clipStack;
};

class Compositor {
 public:
  Compositor() = default;
  CompositorFrame compose(const Sequence &sequence, double timeSeconds) const;
};

}  // namespace capcut
