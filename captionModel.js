// =============================
// captionModel.js
// Core caption architecture
// =============================

// -------- STYLE REGISTRY --------
// Styles are pure data: no rendering logic.
export const CaptionStyles = {
  default: {
    fill: "#FFFFFF",
    stroke: "#000000",
    strokeWidth: 4,
    font: "48px sans-serif",
    background: null,       // later: rgba, gradients, etc.
  },

  highlightPrimary: {
    fill: "#000000",
    stroke: null,
    background: "yellow"
  },

  highlightSecondary: {
    fill: "#000000",
    stroke: null,
    background: "orange"
  }
};


// -------- DATA MODEL --------
// A CaptionSegment is:
// { start, end, words:[{start,end,text}], style }

export function whisperToCaptionSegments(whisperJson) {
  return whisperJson.segments.map(seg => ({
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
    style: "default",
    words: seg.words.map(w => ({
      start: w.start,
      end: w.end,
      text: w.word.trim()
    }))
  }));
}


// -------- QUERY HELPERS --------

// NOTE: Linear now, binary later. See comment in renderer.
export function findActiveSegment(segments, t) {
  return segments.find(seg => t >= seg.start && t < seg.end) || null;
}

export function findActiveWord(words, t) {
  return words.findIndex(w => t >= w.start && t < w.end);
}

