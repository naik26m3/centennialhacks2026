// Ported from uxui/lib/motion/tokens.ts so both clients move with the same
// rhythm. Web durations are in seconds (framer-motion); Reanimated takes
// milliseconds, so the ms values are derived rather than retyped by hand.

export const motionTokens = {
  duration: {
    fast: 0.16,
    standard: 0.32,
    slow: 0.65,
    cinematic: 1.1,
  },
  /** Reanimated wants milliseconds. */
  ms: {
    fast: 160,
    standard: 320,
    slow: 650,
    cinematic: 1100,
  },
  /** cubic-bezier(0.22, 1, 0.36, 1) — the app's standard ease-out. */
  easeOut: [0.22, 1, 0.36, 1] as const,
  springSoft: { damping: 26, stiffness: 220 },
  springSnappy: { damping: 24, stiffness: 340 },
};
