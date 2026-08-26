import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSpace, listMySpaces } from "@/lib/spaces.functions";
import { supabase } from "@/integrations/supabase/client";
import { PageNav } from "@/components/page-nav";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart3,
  CalendarDays,
  ChevronsUpDown,
  LayoutDashboard,
  ListChecks,
  Monitor,
  Settings,
  Users,
  UserSquare2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/s/$spaceId")({
  component: SpaceLayout,
});

const nav = [
  { to: "/s/$spaceId", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/s/$spaceId/events", label: "Events", icon: CalendarDays },
  { to: "/s/$spaceId/attendees", label: "Attendees", icon: UserSquare2 },
  { to: "/s/$spaceId/desks", label: "Desks", icon: Monitor },
  { to: "/s/$spaceId/templates", label: "Templates", icon: ListChecks },
  { to: "/s/$spaceId/members", label: "Members", icon: Users },
  { to: "/s/$spaceId/reports", label: "Reports", icon: BarChart3 },
  { to: "/s/$spaceId/settings", label: "Settings", icon: Settings },
] as const;

function SpaceLayout() {
  const { spaceId } = Route.useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const sectionLabel = nav.find(
    (item) =>
      !("exact" in item && item.exact) && location.pathname.startsWith(item.to.replace("$spaceId", spaceId)),
  )?.label;

  const spaceFn = useServerFn(getSpace);
  const listFn = useServerFn(listMySpaces);

  const space = useQuery({
    queryKey: ["space", spaceId],
    queryFn: () => spaceFn({ data: { spaceId } }),
    retry: false,
  });
  const spaces = useQuery({ queryKey: ["my-spaces"], queryFn: () => listFn() });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  if (space.isError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl">You don&apos;t have access to this space</h1>
        <Button onClick={() => navigate({ to: "/spaces" })}>Back to your spaces</Button>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className="bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0">
        <div className="p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center justify-between gap-2 rounded-lg bg-sidebar-accent px-3 py-2.5 text-left text-sm font-medium text-sidebar-accent-foreground transition-opacity duration-200 hover:opacity-90">
                <span className="truncate">
                  {space.data?.space.name ?? <Skeleton className="h-4 w-24" />}
                </span>
                <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {spaces.data?.map((item) => (
                <DropdownMenuItem key={item.id} asChild>
                  <Link to="/s/$spaceId" params={{ spaceId: item.id }}>
                    {item.name}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/create">Create a space</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <nav className="mt-4 flex gap-1 overflow-x-auto lg:mt-6 lg:flex-col lg:overflow-visible">
            {nav.map((item) => {
              const href = item.to.replace("$spaceId", spaceId);
              const active = "exact" in item && item.exact
                ? location.pathname === href || location.pathname === `${href}/`
                : location.pathname.startsWith(href);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  params={{ spaceId }}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
                  }`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 lg:px-10">
            <PageNav />
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
              <ol className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <li className="shrink-0">
                  <Link to="/spaces" className="hover:text-foreground">
                    Spaces
                  </Link>
                </li>
                <li aria-hidden className="shrink-0 opacity-50">
                  /
                </li>
                <li className="min-w-0 truncate">
                  <Link to="/s/$spaceId" params={{ spaceId }} className="hover:text-foreground">
                    {space.data?.space.name ?? "Space"}
                  </Link>
                </li>
                {sectionLabel && (
                  <>
                    <li aria-hidden className="shrink-0 opacity-50">
                      /
                    </li>
                    <li className="shrink-0 font-medium text-foreground">{sectionLabel}</li>
                  </>
                )}
              </ol>
            </nav>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-5 py-8 lg:px-10">
          <Outlet />
        </div>
      </main>

    </div>
  );
}
