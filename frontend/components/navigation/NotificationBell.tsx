"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { notificationApi, type NotificationRow } from "@/lib/api/resources";
import { useAuth } from "@/lib/auth";
import { ROLE_AREA } from "@/lib/permissions/nav";
import { cn } from "@/lib/utils";

/** Where a notification leads. Older ones saved without a link are resolved from their type and title. */
const targetFor = (n: NotificationRow, role: string): string | null => {
  let link = n.link;
  if (!link) {
    if (n.type === "ASSIGNMENT") link = "/assignments";
    else if (n.type === "NOTICE") link = "/notices";
    else if (n.type === "ATTENDANCE") link = "/attendance";
    else if (/^leave/i.test(n.title)) link = "/leave";
    else if (/enrolled|added to|^new class/i.test(`${n.title} ${n.message}`)) link = "/academics";
  }
  if (!link) return null;
  if (role === "PARENT" && link === "/assignments") link = "/academics"; // parents have no assignments page
  const area = ROLE_AREA[role as keyof typeof ROLE_AREA];
  return area ? `${area}${link}` : null;
};

export function NotificationBell() {
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { data, isError } = useQuery({ queryKey: ["notifications"], queryFn: notificationApi.list, retry: false, refetchInterval: 60_000 });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  const markRead = useMutation({ mutationFn: notificationApi.markRead, onSuccess: invalidate });
  const markAll = useMutation({ mutationFn: notificationApi.markAllRead, onSuccess: invalidate });

  const unread = data?.unread ?? 0;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} />}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-medium">Notifications</span>
          <Button variant="link" size="sm" className="h-auto p-0" disabled={!unread} onClick={() => markAll.mutate()}>
            Mark all as read
          </Button>
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {isError && <li className="p-4 text-sm text-muted-foreground">Notifications are unavailable.</li>}
          {!isError && !data?.items.length && <li className="p-4 text-sm text-muted-foreground">You’re all caught up.</li>}
          {data?.items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  if (!n.read) markRead.mutate(n.id);
                  const target = user ? targetFor(n, user.role) : null;
                  if (target) { setOpen(false); router.push(target); }
                }}
                className={cn("block w-full border-b px-4 py-3 text-left last:border-0 hover:bg-muted", !n.read && "bg-primary/5")}
              >
                <span className="block text-sm font-medium">{n.title}</span>
                <span className="block text-xs text-muted-foreground">{n.message}</span>
              </button>
            </li>
          ))}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
