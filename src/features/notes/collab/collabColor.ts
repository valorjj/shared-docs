// A fixed, small palette — not a design-token color, since the whole point is
// a stable small set of visually distinct hues assigned deterministically per
// user, not a themeable brand color.
const PALETTE = ['#e06c75', '#61afef', '#98c379', '#e5c07b', '#c678dd', '#56b6c2', '#d19a66']

/** Deterministic color per user — the same person always renders as the same
 *  cursor color, stable across sessions, reconnects, and page reloads. */
export function collabColorForUser(userId: number): string {
  return PALETTE[userId % PALETTE.length]
}
