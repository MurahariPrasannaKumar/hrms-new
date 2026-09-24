import { z } from 'zod';

export const chatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(4000),
});
export const solveSchema = z.object({
  question: z.string().trim().min(1).max(4000),
  fileId: z.string().uuid().optional(),
});
export const studyPlanSchema = z.object({
  subject: z.string().trim().min(1).max(100),
  goal: z.string().trim().min(1).max(300),
  days: z.number().int().min(1).max(30).default(7),
});
export const idParamSchema = z.object({ id: z.string().uuid() });
