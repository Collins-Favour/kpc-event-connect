import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getReportData, getSpaceOverview } from "@/lib/reports.functions";
import { listEvents } from "@/lib/events.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/s/$spaceId/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Leepek" },
      {
        name: "description",
        content: "Attendance, desk, time and demographic reports with CSV export.",
      },
      { property: "og:title", content: "Reports — Leepek" },
      {
        property: "og:description",
        content: "Attendance, desk and demographic reports with export.",
      },
    ],
  }),
  component: ReportsPage,
});

function toCsv(rows: Record<string, string>[]): string {
  if (rows.length === 0) return "";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value: string) => `"${(value ?? "").replace(/"/g, '""')}"`;
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header] ?? "")).join(",")),
  ].join("\n");
}

function ReportsPage() {
  const { spaceId } = Route.useParams();
  const reportFn = useServerFn(getReportData);
  const overviewFn = useServerFn(getSpaceOverview);
  const eventsFn = useServerFn(listEvents);

  const events = useQuery({
    queryKey: ["events", spaceId],
    queryFn: () => eventsFn({ data: { spaceId } }),
  });
  const [eventId, setEventId] = useState("all");
  const scope = eventId === "all" ? undefined : eventId;

  const report = useQuery({
    queryKey: ["report", spaceId, eventId],
    queryFn: () => reportFn({ data: { spaceId, eventId: scope } }),
  });
  const overview = useQuery({
    queryKey: ["overview", spaceId, eventId],
    queryFn: () => overviewFn({ data: { spaceId, eventId: scope } }),
  });

  function download() {
    const rows = (report.data?.rows ?? []).map((row) => {
      const base: Record<string, string> = {
        registration_number: row.registration_number,
        full_name: row.full_name,
        phone: row.phone ?? "",
        email: row.email ?? "",
        location: row.location ?? "",
        event: row.event?.name ?? "",
        desk: row.desk?.name ?? "",
        registered_at: row.registered_at,
      };
      for (const value of row.values ?? []) base[value.field_key] = value.value ?? "";
      return base;
    });
    if (rows.length === 0) {
      toast.error("Nothing to export yet.");
      return;
    }
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const maxHour = Math.max(1, ...(overview.data?.hourly ?? []).map((h) => h.count));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Attendance, desk activity, time-of-day and your configured fields.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {(events.data ?? []).map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={download}>
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="py-6">
            <h2 className="text-sm font-semibold">Registrations by hour (UTC)</h2>
            {overview.isLoading ? (
              <Skeleton className="mt-6 h-32 w-full" />
            ) : (
              <div className="mt-6 flex h-32 items-end gap-1">
                {(overview.data?.hourly ?? []).map((point) => (
                  <div
                    key={point.hour}
                    className="flex-1 rounded-t bg-chart-2 transition-all duration-300"
                    style={{ height: `${Math.max(2, (point.count / maxHour) * 100)}%` }}
                    title={`${point.hour}:00 — ${point.count}`}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6">
            <h2 className="text-sm font-semibold">Desk performance</h2>
            <ul className="mt-4 space-y-3">
              {(overview.data?.deskBreakdown ?? []).map((desk) => (
                <li key={desk.name} className="flex items-center justify-between text-sm">
                  <span className="truncate text-muted-foreground">{desk.name}</span>
                  <span className="font-medium tabular-nums">{desk.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(report.data?.breakdowns ?? []).map((breakdown) => (
          <Card key={breakdown.field} className="animate-rise">
            <CardContent className="py-6">
              <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                {breakdown.field}
              </h2>
              <ul className="mt-3 space-y-2">
                {breakdown.counts.map((entry) => (
                  <li key={entry.label} className="flex items-center justify-between text-sm">
                    <span className="truncate">{entry.label}</span>
                    <span className="font-medium tabular-nums">{entry.count}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
        {report.data?.breakdowns.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Add custom fields to your template to see demographic breakdowns here.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
