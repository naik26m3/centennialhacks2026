// Centralized motion constants — components should reference these rather
// than hardcoding durations/easing, so the whole app moves with one
// consistent rhythm (spec §43).

export const motionTokens = {
  duration: {
    fast: 0.16,
    standard: 0.32,
    slow: 0.65,
    cinematic: 1.1,
  },
  easeOut: [0.22, 1, 0.36, 1] as const,
  springSoft: { type: "spring" as const, stiffness: 220, damping: 26 },
  springSnappy: { type: "spring" as const, stiffness: 340, damping: 24 },
};
