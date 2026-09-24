import type { PermissionKey, RoleName } from '../config/permissions';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  schoolId: string | null;
  permissions: PermissionKey[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
