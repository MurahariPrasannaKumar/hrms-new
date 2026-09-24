import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { GlobalSearch } from "@/components/navigation/GlobalSearch";
import { NotificationBell } from "@/components/navigation/NotificationBell";
import { UserMenu } from "@/components/navigation/UserMenu";

export function Topbar() {
  return (
    <div className="sticky top-0 z-30 hidden h-16 items-center justify-between gap-4 border-b bg-card/95 px-6 backdrop-blur md:flex">
      <div className="flex min-w-0 flex-1 items-center gap-6">
        <Breadcrumb />
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserMenu />
      </div>
    </div>
  );
}
