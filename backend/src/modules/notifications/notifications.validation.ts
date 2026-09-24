import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const listNotificationsSchema = paginationSchema.extend({
  unread: z.enum(['true', 'false']).optional(),
  type: z.enum(['NOTICE', 'ATTENDANCE', 'ASSIGNMENT', 'ANNOUNCEMENT', 'SECURITY', 'SYSTEM']).optional(),
});
export const idParamSchema = z.object({ id: z.string().uuid() });
