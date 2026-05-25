import { z } from "zod";
import { HOSPITALS } from "@/lib/hospitals";

export const ProfileSchema = z.object({
  fullName: z.string().min(2, "שם מלא נדרש"),
  hospitalName: z.enum(HOSPITALS as unknown as [string, ...string[]], {
    errorMap: () => ({ message: "יש לבחור בית חולים מהרשימה" }),
  }),
  residencyYear: z.coerce.number().int().min(1).max(5),
});
