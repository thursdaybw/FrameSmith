import { animations } from "./animationRegistry.js";

export function validateCaption(seg) {
  if (!Array.isArray(seg.words)) {
    console.warn("Caption segment missing `.words` array:", seg);
  }

  for (const word of seg.words) {
    if (word.override && word.override.some(name => animations[name])) {
      console.warn(
        `Misuse: animation names found in "override". Move to "animate".`,
        word
      );
    }

    if (word.animate && word.animate.some(name => !animations[name])) {
      console.warn(
        `Unknown animation name found in "animate" array.`,
        word
      );
    }
  }
}

