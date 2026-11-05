// Accessibility problems the signed-in tests found that are not fixed yet
// (ticket-36). Each is a recorded follow-up in the ticket's notes, not a
// shrug: the test still fails for any other rule or any other screen, and an
// entry here is removed when its fix lands. The key is `<role> <path>` and the
// value the axe rule ids allowed on it.
//
// Empty means every checked screen passes.
export const knownIssues: Record<string, readonly string[]> = {};
