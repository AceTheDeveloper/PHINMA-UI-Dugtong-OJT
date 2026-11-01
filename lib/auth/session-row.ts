import { z } from "zod";
import { roles } from "@/lib/auth/roles";

// One row from the resolve_session database function, checked at the boundary.
export const sessionRowSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(roles),
  is_active: z.boolean(),
  student_id: z.string().uuid().nullable(),
  course_ids: z.array(z.string().uuid()),
  company_id: z.string().uuid().nullable(),
  is_company_owner: z.boolean(),
  has_consent: z.boolean(),
});

export type SessionRow = z.infer<typeof sessionRowSchema>;
