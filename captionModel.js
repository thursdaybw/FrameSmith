/**
 * CAPTION MODEL — ARCHITECTURE NOTES
 * ----------------------------------
 * This module converts input caption formats (e.g. Whisper JSON)
 * into a clean internal structure that the renderer understands.
 *
 * CURRENT STAGE (Phase A):
 *   - Each caption is a flat object:
 *       { start, end, words:[ {start,end,text}, ... ] }
 *   - No grouping, no nesting, no style system yet.
 *
 * WHY THIS MATTERS:
 *   The caption model MUST NOT:
 *     - know how captions are laid out
 *     - know how captions are styled
 *     - know how captions are drawn
 *
 *   It contains pure timing + text data only.
 *
 * FUTURE EVOLUTION:
 *   When styles, groups, or effects arrive, they extend the model
 *   but never mix rendering concerns into this file.
 *
 * DIRECTION OF TRAVEL:
 *   Later we will introduce StylePreset, InlineOverrides, and
 *   RenderPlan → but this file stays strictly about DATA.
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

