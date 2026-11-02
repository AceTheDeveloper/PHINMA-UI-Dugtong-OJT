import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// After a sign-in the browser must load the app fresh. A client-side router push
// to /after-sign-in can replay the answer cached for the previous person (the
// page redirects to that person's role home), so a student who signs in after a
// supervisor lands on /supervisor, which is a 404 for them. The page that
// redirects by role is dynamic, so nothing server side is wrong: only the
// navigation is. This reads the three places that leave the sign-in screens and
// checks they use a full page load.

const files = [
  "components/auth/sign-in-form.tsx",
  "components/auth/accept-invitation-form.tsx",
  "app/(app)/sign-in/sso-callback/page.tsx",
];

describe("leaving the sign-in screens", () => {
  it.each(files)("%s loads the next page fresh, not with the client router", (file) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    const go = /function go\(url: string\) \{([\s\S]*?)\n  \}/.exec(source);
    expect(go, "a go() function").not.toBeNull();
    expect(go?.[1]).toContain("window.location.assign(url)");
    expect(go?.[1]).not.toContain("router.push");
  });

  it("does not hand the path after sign-in to the client router anywhere in the auth screens", () => {
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/router\.(push|replace)\([^)]*after-?[sS]ign-?[iI]n/);
      expect(source, file).not.toContain("router.push(url)");
    }
  });
});
