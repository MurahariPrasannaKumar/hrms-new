import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

const LEAVE_TYPES = ['CASUAL', 'SICK', 'EARNED', 'UNPAID', 'OTHER'] as const;
const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const applyLeaveSchema = z.object({
  type: z.enum(LEAVE_TYPES),
  startDate: day,
  endDate: day,
  reason: z.string().trim().min(5, 'Please give a short reason').max(1000),
});

export const listMyLeaveSchema = paginationSchema.extend({ status: z.enum(LEAVE_STATUSES).optional() });

export const listLeaveSchema = paginationSchema.extend({
  status: z.enum(LEAVE_STATUSES).optional(),
  type: z.enum(LEAVE_TYPES).optional(),
  schoolId: z.string().uuid().optional(), // honoured only for SUPER_ADMIN
});

export const reviewLeaveSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'CANCELLED']),
  note: z.string().trim().max(500).optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });
