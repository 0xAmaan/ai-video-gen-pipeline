#include <emscripten/bind.h>

#include "../compositor/compositor.h"
#include "../core/timeline.h"
#include "../effects/effects_processor.h"

using namespace emscripten;

EMSCRIPTEN_BINDINGS(capcut_timeline) {
  enum_<capcut::ClipKind>("ClipKind")
      .value("video", capcut::ClipKind::Video)
      .value("audio", capcut::ClipKind::Audio)
      .value("image", capcut::ClipKind::Image);

  enum_<capcut::TrackKind>("TrackKind")
      .value("video", capcut::TrackKind::Video)
      .value("audio", capcut::TrackKind::Audio)
      .value("overlay", capcut::TrackKind::Overlay)
      .value("fx", capcut::TrackKind::Fx);

  value_object<capcut::Effect>("Effect")
      .field("id", &capcut::Effect::id)
      .field("type", &capcut::Effect::type)
      .field("params", &capcut::Effect::params)
      .field("enabled", &capcut::Effect::enabled);

  value_object<capcut::TransitionSpec>("TransitionSpec")
      .field("id", &capcut::TransitionSpec::id)
      .field("type", &capcut::TransitionSpec::type)
      .field("duration", &capcut::TransitionSpec::duration)
      .field("easing", &capcut::TransitionSpec::easing);

  value_object<capcut::Clip>("Clip")
      .field("id", &capcut::Clip::id)
      .field("mediaId", &capcut::Clip::mediaId)
      .field("trackId", &capcut::Clip::trackId)
      .field("kind", &capcut::Clip::kind)
      .field("start", &capcut::Clip::start)
      .field("duration", &capcut::Clip::duration)
      .field("trimStart", &capcut::Clip::trimStart)
      .field("trimEnd", &capcut::Clip::trimEnd)
      .field("opacity", &capcut::Clip::opacity)
      .field("volume", &capcut::Clip::volume)
      .field("effects", &capcut::Clip::effects)
      .field("transitions", &capcut::Clip::transitions);

  value_object<capcut::Track>("Track")
      .field("id", &capcut::Track::id)
      .field("kind", &capcut::Track::kind)
      .field("allowOverlap", &capcut::Track::allowOverlap)
      .field("locked", &capcut::Track::locked)
      .field("muted", &capcut::Track::muted)
      .field("clips", &capcut::Track::clips);

  value_object<capcut::Sequence>("Sequence")
      .field("id", &capcut::Sequence::id)
      .field("name", &capcut::Sequence::name)
      .field("width", &capcut::Sequence::width)
      .field("height", &capcut::Sequence::height)
      .field("fps", &capcut::Sequence::fps)
      .field("sampleRate", &capcut::Sequence::sampleRate)
      .field("duration", &capcut::Sequence::duration)
      .field("tracks", &capcut::Sequence::tracks);

  class_<capcut::Timeline>("Timeline")
      .constructor<>()
      .function("setSequenceMetadata", &capcut::Timeline::setSequenceMetadata)
      .function("addTrack", &capcut::Timeline::addTrack)
      .function("updateTrack", &capcut::Timeline::updateTrack)
      .function("removeTrack", &capcut::Timeline::removeTrack)
      .function("upsertClip", &capcut::Timeline::upsertClip)
      .function("moveClip", &capcut::Timeline::moveClip)
      .function("trimClip", &capcut::Timeline::trimClip)
      .function("splitClip", &capcut::Timeline::splitClip)
      .function("rippleDelete", &capcut::Timeline::rippleDelete)
      .function("frameAt", &capcut::Timeline::frameAt)
      .function("serialize", &capcut::Timeline::serialize)
      .function("duration", &capcut::Timeline::duration)
      .function("sequence", &capcut::Timeline::sequence);

  class_<capcut::EffectsProcessor>("EffectsProcessor")
      .constructor<>()
      .function("setSimdEnabled", &capcut::EffectsProcessor::setSimdEnabled)
      .function("evaluate", &capcut::EffectsProcessor::evaluate);

  class_<capcut::Compositor>("Compositor")
      .constructor<>()
      .function("compose", &capcut::Compositor::compose);

  value_object<capcut::TimelineFrameInfo>("TimelineFrameInfo")
      .field("clipId", &capcut::TimelineFrameInfo::clipId)
      .field("localTime", &capcut::TimelineFrameInfo::localTime)
      .field("globalTime", &capcut::TimelineFrameInfo::globalTime);

  value_object<capcut::EffectEvaluation>("EffectEvaluation")
      .field("clipId", &capcut::EffectEvaluation::clipId)
      .field("time", &capcut::EffectEvaluation::time)
      .field("values", &capcut::EffectEvaluation::values);

  value_object<capcut::CompositorFrame>("CompositorFrame")
      .field("time", &capcut::CompositorFrame::time)
      .field("clipStack", &capcut::CompositorFrame::clipStack);
}
