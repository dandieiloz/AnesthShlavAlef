import { z } from "zod";

export const ScheduleSchema = z.object({
  examDate: z.coerce.date(),
  questionsPerWeek: z.coerce.number().int().min(1).max(500),
});

export type ScheduleInput = z.infer<typeof ScheduleSchema>;
