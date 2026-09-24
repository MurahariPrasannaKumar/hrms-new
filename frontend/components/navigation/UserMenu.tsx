"use client";

import { KeyRound, LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { ROLE_AREA } from "@/lib/permissions/nav";

export function UserMenu({ compact }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  if (!user) return null;
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Account menu"
      >
        <Avatar><AvatarFallback className="bg-primary/10 font-medium text-primary">{initials}</AvatarFallback></Avatar>
        {!compact && (
          <span className="hidden text-left leading-tight lg:block">
            <span className="block text-sm font-medium">{user.firstName} {user.lastName}</span>
            <span className="block text-xs capitalize text-muted-foreground">{user.role.replace("_", " ").toLowerCase()}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-2">
          <p className="truncate text-sm font-medium">{user.firstName} {user.lastName}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          {user.school && <p className="truncate text-xs text-muted-foreground">{user.school.name}</p>}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(`${ROLE_AREA[user.role]}/profile`)}>
          <UserRound className="size-4" /> My profile
        </DropdownMenuItem>
        {(user.role === "SUPER_ADMIN" || user.role === "SCHOOL_ADMIN") && (
          <DropdownMenuItem onClick={() => router.push("/change-password")}>
            <KeyRound className="size-4" /> Change password
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={async () => { await logout(); router.replace("/login"); }}>
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
