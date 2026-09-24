import type { AuthUser, Role } from "@/lib/auth/types";
import { ROLE_AREA, ROLE_HOME } from "./nav";

export * from "./nav";

export const homeFor = (role: Role) => ROLE_HOME[role];

export const hasPermission = (user: Pick<AuthUser, "permissions"> | null | undefined, key: string) =>
  !!user?.permissions.includes(key);

export const hasRole = (user: Pick<AuthUser, "role"> | null | undefined, ...roles: Role[]) =>
  !!user && roles.includes(user.role);

/** True when `pathname` belongs to another role's area (e.g. a teacher opening /admin/...). */
export const isForeignArea = (role: Role, pathname: string) => {
  const areas = Object.values(ROLE_AREA);
  return areas.some((a) => pathname === a || pathname.startsWith(`${a}/`)) && !(pathname === ROLE_AREA[role] || pathname.startsWith(`${ROLE_AREA[role]}/`));
};
