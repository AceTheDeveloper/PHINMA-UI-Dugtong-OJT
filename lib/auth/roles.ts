export const roles = ["admin", "coordinator", "supervisor", "student"] as const;

export type Role = (typeof roles)[number];

// Where each role lands after sign-in.
export function roleHome(role: Role): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "coordinator":
      return "/coordinator";
    case "supervisor":
      return "/supervisor";
    case "student":
      return "/student";
  }
}
