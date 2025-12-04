/**
 * CaptionModel (data only).
 *
 * Responsibility:
 *   - Convert Whisper JSON into internal segments.
 *   - Store timing and declarative styling/animation intent.
 *
 * Does NOT:
 *   - Know layout or rendering
 *   - Resolve styles
 *   - Apply animations
 */

export function whisperToCaptionSegments(whisperJson) {
  return whisperJson.segments.map(seg => ({
    start: seg.start,
    end: seg.end,

    // Segment-level static and animated styling
    override: [],
    animate: [],

    // Words carry all rendering/timing intent
    words: seg.words.map(w => ({
      start: w.start,
      end: w.end,
      text: w.word.trim(),

      override: [],
      animate: []
    }))
  }));
}

