import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSpaceOverview } from "@/lib/reports.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/s/$spaceId/")({
  head: () => ({
    meta: [
      { title: "Space overview — Registry" },
      { name: "description", content: "Live registration totals, desk activity and recent attendees." },
      { property: "og:title", content: "Space overview — Registry" },
      { property: "og:description", content: "Live registration totals and desk activity." },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const { spaceId } = Route.useParams();
  const overviewFn = useServerFn(getSpaceOverview);
  const overview = useQuery({
    queryKey: ["overview", spaceId],
    queryFn: () => overviewFn({ data: { spaceId } }),
    refetchInterval: 30_000,
  });

  const totals = overview.data?.totals;
  const cards = [
    { label: "Registrations", value: totals?.registrations },
    { label: "Today", value: totals?.today },
    { label: "Active events", value: totals?.activeEvents },
    { label: "Active desks", value: totals?.activeDesks },
    { label: "Live sessions", value: totals?.liveSessions },
  ];
  const maxTrend = Math.max(1, ...(overview.data?.trend ?? []).map((t) => t.count));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live picture of registration activity.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/s/$spaceId/desks" params={{ spaceId }}>
            Manage desks
          </Link>
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card, index) => (
          <Card key={card.label} className={`animate-rise stagger-${index}`}>
            <CardContent className="py-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
              {overview.isLoading ? (
                <Skeleton className="mt-2 h-7 w-12" />
              ) : (
                <p className="mt-1 text-2xl font-semibold tabular-nums">{card.value ?? 0}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="py-6">
            <h2 className="text-sm font-semibold">Last 14 days</h2>
            <div className="mt-6 flex h-40 items-end gap-1.5">
              {(overview.data?.trend ?? []).map((point) => (
                <div key={point.date} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t bg-chart-1 transition-all duration-300"
                    style={{ height: `${Math.max(2, (point.count / maxTrend) * 100)}%` }}
                    title={`${point.date}: ${point.count}`}
                  />
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Peak day: {maxTrend} registration{maxTrend === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6">
            <h2 className="text-sm font-semibold">By desk</h2>
            <ul className="mt-4 space-y-3">
              {(overview.data?.deskBreakdown ?? []).map((desk) => (
                <li key={desk.name} className="flex items-center justify-between text-sm">
                  <span className="truncate text-muted-foreground">{desk.name}</span>
                  <span className="font-medium tabular-nums">{desk.count}</span>
                </li>
              ))}
              {overview.data?.deskBreakdown.length === 0 && (
                <li className="text-sm text-muted-foreground">No desks yet.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-6">
          <h2 className="text-sm font-semibold">Recent registrations</h2>
          <ul className="mt-4 divide-y">
            {(overview.data?.recent ?? []).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="truncate font-medium">{row.full_name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {row.desk?.name ?? "—"} · {new Date(row.registered_at).toLocaleTimeString()}
                </span>
              </li>
            ))}
            {overview.data?.recent.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                Nobody has registered yet.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
