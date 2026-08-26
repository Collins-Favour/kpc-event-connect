import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  addPlatformAdmin,
  getPlatformOverview,
  getSpaceDetailForPlatform,
  listPlatformAdmins,
  removePlatformAdmin,
  setSpaceStatus,
} from "@/lib/spaces.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { PageNav } from "@/components/page-nav";
import { Loader2, Plus, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/platform")({
  head: () => ({
    meta: [
      { title: "Platform administration — Leepek" },
      {
        name: "description",
        content: "Oversee every space on the platform, review activity and suspend abuse.",
      },
      { property: "og:title", content: "Platform administration — Leepek" },
      { property: "og:description", content: "Oversee every space on the platform." },
    ],
  }),
  component: PlatformPage,
});

type StatusFilter = "ALL" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";

function PlatformPage() {
  const queryClient = useQueryClient();
  const overviewFn = useServerFn(getPlatformOverview);
  const statusFn = useServerFn(setSpaceStatus);
  const adminsFn = useServerFn(listPlatformAdmins);
  const addAdminFn = useServerFn(addPlatformAdmin);
  const removeAdminFn = useServerFn(removePlatformAdmin);
  const detailFn = useServerFn(getSpaceDetailForPlatform);

  const overview = useQuery({
    queryKey: ["platform-overview"],
    queryFn: () => overviewFn(),
    retry: false,
  });
  const admins = useQuery({
    queryKey: ["platform-admins"],
    queryFn: () => adminsFn(),
    retry: false,
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [openSpace, setOpenSpace] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("");

  const detail = useQuery({
    queryKey: ["platform-space", openSpace],
    enabled: Boolean(openSpace),
    queryFn: () => detailFn({ data: { spaceId: openSpace! } }),
  });

  const setStatusMutation = useMutation({
    mutationFn: (input: { spaceId: string; status: "ACTIVE" | "SUSPENDED" | "ARCHIVED" }) =>
      statusFn({ data: input }),
    onSuccess: () => {
      toast.success("Space updated");
      queryClient.invalidateQueries({ queryKey: ["platform-overview"] });
    },
    onError: (error: unknown) => toast.error(friendlyError(error, "Could not update the space.")),
  });

  const addAdmin = useMutation({
    mutationFn: () => addAdminFn({ data: { email: adminEmail } }),
    onSuccess: () => {
      toast.success("Platform administrator added");
      setAdminEmail("");
      queryClient.invalidateQueries({ queryKey: ["platform-admins"] });
    },
    onError: (error: unknown) =>
      toast.error(friendlyError(error, "Could not add that administrator.")),
  });

  const removeAdmin = useMutation({
    mutationFn: (userId: string) => removeAdminFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Platform administrator removed");
      queryClient.invalidateQueries({ queryKey: ["platform-admins"] });
    },
    onError: (error: unknown) =>
      toast.error(friendlyError(error, "Could not remove that administrator.")),
  });

  const spaces = (overview.data?.spaces ?? []).filter((space) => {
    const matchesSearch = space.name.toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus = status === "ALL" || space.status === status;
    return matchesSearch && matchesStatus;
  });

  const peak = Math.max(1, ...(overview.data?.trend ?? []).map((point) => point.count));

  if (overview.isError) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <PageNav className="-ml-2" />
        <Card className="mt-6">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            You don&apos;t have platform administrator access.
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <PageNav className="-ml-2" />

      <header className="mt-4 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-sidebar text-sidebar-foreground">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl">Platform administration</h1>
          <p className="text-sm text-muted-foreground">
            Full oversight of every space, member and registration on Leepek.
          </p>
        </div>
      </header>

      <section className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Spaces", value: overview.data?.totals.spaces },
          { label: "Users", value: overview.data?.totals.users },
          { label: "Events", value: overview.data?.totals.events },
          { label: "Desks", value: overview.data?.totals.desks },
          { label: "Registrations", value: overview.data?.totals.registrations },
          { label: "Last 30 days", value: overview.data?.totals.last30 },
        ].map((stat) => (
          <Card key={stat.label} className="animate-rise">
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <div className="mt-1 text-2xl font-semibold">
                {overview.isLoading ? <Skeleton className="h-7 w-12" /> : (stat.value ?? 0)}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-6">
        <Card>
          <CardContent className="py-5">
            <h2 className="text-sm font-semibold">Registrations · last 30 days</h2>
            <div className="mt-4 flex h-28 items-end gap-1">
              {(overview.data?.trend ?? []).map((point) => (
                <div
                  key={point.day}
                  title={`${point.day}: ${point.count}`}
                  className="flex-1 rounded-t bg-accent/70 transition-all duration-300"
                  style={{ height: `${Math.max(4, (point.count / peak) * 100)}%` }}
                />
              ))}
              {(overview.data?.trend ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No registrations in this period yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg">Spaces</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-9 w-48"
              placeholder="Search spaces"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {overview.isLoading && <Skeleton className="h-24 w-full" />}
          {spaces.map((space) => (
            <Card key={space.id} className="animate-rise">
              <CardContent className="flex flex-wrap items-center gap-3 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{space.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {space.space_type} · created {new Date(space.created_at).toLocaleDateString()} ·{" "}
                    {space.registrations_last30} registrations in 30 days
                  </p>
                </div>
                <Badge variant={space.status === "ACTIVE" ? "secondary" : "outline"}>
                  {space.status}
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => setOpenSpace(space.id)}>
                  View
                </Button>
                {space.status === "ACTIVE" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setStatusMutation.mutate({ spaceId: space.id, status: "SUSPENDED" })
                    }
                  >
                    Suspend
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setStatusMutation.mutate({ spaceId: space.id, status: "ACTIVE" })
                    }
                  >
                    Reactivate
                  </Button>
                )}
                {space.status !== "ARCHIVED" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setStatusMutation.mutate({ spaceId: space.id, status: "ARCHIVED" })
                    }
                  >
                    Archive
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {!overview.isLoading && spaces.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No spaces match that filter.
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg">Platform administrators</h2>
          <Card className="mt-3">
            <CardContent className="divide-y p-0">
              {(admins.data ?? []).map((admin) => (
                <div key={admin.user_id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {admin.profile?.name || admin.profile?.email || "Unknown user"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{admin.profile?.email}</p>
                  </div>
                  {admin.isSelf ? (
                    <Badge variant="secondary">You</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeAdmin.mutate(admin.user_id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <div className="space-y-2 px-5 py-4">
                <Label htmlFor="admin-email">Add by email</Label>
                <div className="flex gap-2">
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="person@example.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                  />
                  <Button
                    onClick={() => addAdmin.mutate()}
                    disabled={addAdmin.isPending || !adminEmail}
                  >
                    {addAdmin.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  They must have signed in at least once before they can be granted access.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-lg">Recent activity</h2>
          <Card className="mt-3">
            <CardContent className="divide-y p-0">
              {(overview.data?.audit ?? []).map((entry) => (
                <div key={entry.id} className="px-5 py-3">
                  <p className="text-sm">{entry.description || entry.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.action} · {new Date(entry.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
              {(overview.data?.audit ?? []).length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Nothing logged yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <PlatformSupport />

      <Dialog open={Boolean(openSpace)} onOpenChange={() => setOpenSpace(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail.data?.space.name ?? "Space"}</DialogTitle>
          </DialogHeader>
          {detail.isLoading && <Skeleton className="h-32 w-full" />}
          {detail.data && (
            <div className="space-y-5 text-sm">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Members", value: detail.data.counts.members },
                  { label: "Desks", value: detail.data.counts.desks },
                  { label: "Registrations", value: detail.data.counts.registrations },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-lg font-semibold">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Events</h3>
                <ul className="mt-2 space-y-1">
                  {detail.data.events.map((event) => (
                    <li key={event.id} className="flex items-center justify-between gap-3">
                      <span className="truncate">{event.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {event.status} · {event.registration_counter} registered
                      </span>
                    </li>
                  ))}
                  {detail.data.events.length === 0 && (
                    <li className="text-muted-foreground">No events yet.</li>
                  )}
                </ul>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Members</h3>
                <ul className="mt-2 space-y-1">
                  {detail.data.members.map((member) => (
                    <li key={member.id} className="flex items-center justify-between gap-3">
                      <span className="truncate">
                        {member.profile?.email || member.profile?.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{member.role}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSpace(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
