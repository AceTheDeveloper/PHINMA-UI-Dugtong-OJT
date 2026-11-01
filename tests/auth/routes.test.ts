import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { roleHome, roles } from "@/lib/auth/roles";
import { isPublicPath, publicPaths, redirectFor } from "@/lib/auth/routes";
import { errorFromDatabase, type ErrorCode } from "@/lib/result";
import { sessionRowSchema } from "@/lib/auth/session-row";

describe("public routes", () => {
  it("are exactly the landing page, sign-in, and accept-invitation", () => {
    // Adding a public path is a security decision. Change this list on purpose.
    expect([...publicPaths]).toEqual(["/", "/sign-in", "/accept-invitation"]);
  });

  it.each([
    ["/", true],
    ["/sign-in", true],
    ["/sign-in/sso-callback", true],
    ["/accept-invitation", true],
    ["/accept-invitation/sso-callback", true],
    ["/consent", false],
    ["/no-access", false],
    ["/deactivated", false],
    ["/after-sign-in", false],
    ["/coordinator", false],
    ["/student", false],
    ["/supervisor", false],
    ["/admin", false],
    ["/sign-instructions", false],
    ["/accept-invitations-list", false],
    ["/api/anything", false],
  ])("%s is public: %s", (path, expected) => {
    expect(isPublicPath(path)).toBe(expected);
  });

  it("covers every page in the app folder: only the listed pages are public", () => {
    const appDir = join(process.cwd(), "app");
    const routes: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (/^page\.(tsx|ts|jsx|js)$/.test(name)) {
          const segments = relative(appDir, dir)
            .split(sep)
            .filter((segment) => segment && !/^\(.*\)$/.test(segment));
          routes.push("/" + segments.join("/"));
        }
      }
    };
    walk(appDir);

    expect(routes.length).toBeGreaterThan(3);
    // /sign-in/sso-callback is where Google returns the browser after sign-in.
    expect(routes.filter(isPublicPath).sort()).toEqual(
      ["/", "/accept-invitation", "/sign-in", "/sign-in/sso-callback"].sort(),
    );
  });
});

describe("redirectFor", () => {
  it.each([
    ["unauthenticated", "/sign-in"],
    ["not_provisioned", "/no-access"],
    ["google_required", "/no-access"],
    ["inactive", "/deactivated"],
    ["consent_required", "/consent"],
    ["forbidden", null],
    ["not_found", null],
    ["unexpected", null],
  ] as [ErrorCode, string | null][])("%s goes to %s", (code, destination) => {
    expect(redirectFor(code)).toBe(destination);
  });
});

describe("roleHome", () => {
  it("gives every role its own home", () => {
    const homes = roles.map((role) => roleHome(role));
    expect(homes).toEqual(["/admin", "/coordinator", "/supervisor", "/student"]);
    expect(new Set(homes).size).toBe(roles.length);
  });
});

describe("errorFromDatabase", () => {
  it.each([
    ["forbidden: only a company owner can invite", "forbidden"],
    ["not_found: invitation not found", "not_found"],
    ["conflict: invitation is used", "conflict"],
    ["invalid: email is required", "validation"],
  ])("maps %s to %s and keeps the readable part", (message, code) => {
    const error = errorFromDatabase(message);
    expect(error.code).toBe(code);
    expect(error.message).toBe(message.replace(/^[a-z_]+: /, ""));
  });

  it("hides the text of anything unexpected", () => {
    const error = errorFromDatabase('duplicate key value violates unique constraint "users_pkey"');
    expect(error).toEqual({
      code: "unexpected",
      message: "Something went wrong. Try again in a moment.",
    });
  });
});

describe("sessionRowSchema", () => {
  const valid = {
    user_id: "00000000-0000-4000-8000-000000000001",
    role: "coordinator",
    is_active: true,
    student_id: null,
    course_ids: ["00000000-0000-4000-8000-000000000002"],
    company_id: null,
    is_company_owner: false,
    has_consent: true,
  };

  it("accepts a well-formed row", () => {
    expect(sessionRowSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an unknown role, a bad id, or a missing field", () => {
    expect(sessionRowSchema.safeParse({ ...valid, role: "owner" }).success).toBe(false);
    expect(sessionRowSchema.safeParse({ ...valid, user_id: "nope" }).success).toBe(false);
    const missing: Record<string, unknown> = { ...valid };
    delete missing.has_consent;
    expect(sessionRowSchema.safeParse(missing).success).toBe(false);
  });
});
