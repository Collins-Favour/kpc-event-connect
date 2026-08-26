import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getReportData, getSpaceOverview } from "@/lib/reports.functions";
import { listSpaceFields } from "@/lib/segments.functions";
import { decodeFilterSet, emptyFilterSet, type FilterSet } from "@/lib/filters";
import { AttendeeFilters } from "@/components/attendee-filters";
import { ExportMenu } from "@/components/export-menu";
import {
  copyTable,
  exportCsv,
  exportPdf,
  exportXlsx,
  printRows,
  type ExportRow,
} from "@/lib/export-data";
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
import { Clipboard, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/s/$spaceId/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Leepek" },
      {
        name: "description",
        content: "Build a report on any field, cross-tabulate it and export to CSV, Excel or PDF.",
      },
      { property: "og:title", content: "Reports — Leepek" },
      {
        property: "og:description",
        content: "Reports on every field, shareable and exportable.",
      },
    ],
  }),
  component: ReportsPage,
});

type Row = ExportRow & { location: string | null };

/** Reads any field off a registration row, built-in or configurable. */
function readField(row: Row, key: string): string {
  if (key === "location") return row.location ?? "";
  if (key === "event") return row.event?.name ?? "";
  if (key === "desk") return row.desk?.name ?? "";
  const match = (row.values ?? []).find((value) => value.field_key === key);
  return match?.value ?? "";
}

function ReportsPage() {
  const { spaceId } = Route.useParams();
  const reportFn = useServerFn(getReportData);
  const overviewFn = useServerFn(getSpaceOverview);
  const fieldsFn = useServerFn(listSpaceFields);

  const [filters, setFilters] = useState<FilterSet>(() => {
    if (typeof window === "undefined") return emptyFilterSet();
    const params = new URLSearchParams(window.location.search);
    return decodeFilterSet(params.get("view")) ?? emptyFilterSet();
  });
  const [groupBy, setGroupBy] = useState("none");
  const [splitBy, setSplitBy] = useState("none");

  const report = useQuery({
    queryKey: ["report", spaceId, filters],
    queryFn: () => reportFn({ data: { spaceId, ...filters } }),
  });
  const overview = useQuery({
    queryKey: ["overview", spaceId, filters.eventId],
    queryFn: () => overviewFn({ data: { spaceId, eventId: filters.eventId } }),
  });
  const fields = useQuery({
    queryKey: ["space-fields", spaceId],
    queryFn: () => fieldsFn({ data: { spaceId } }),
  });

  const fieldOptions = useMemo(() => {
    const custom = (fields.data ?? []).map((f) => ({ key: f.key, label: f.label }));
    return [
      { key: "event", label: "Event" },
      { key: "desk", label: "Desk" },
      ...custom.filter((f) => f.key !== "full_name" && f.key !== "phone" && f.key !== "email"),
    ];
  }, [fields.data]);

  const labelFor = (key: string) => fieldOptions.find((f) => f.key === key)?.label ?? key;

  // Group / cross-tab table built from the filtered rows.
  const table = useMemo(() => {
    const rows = (report.data?.rows ?? []) as unknown as Row[];
    if (groupBy === "none") return null;
    const columns = new Set<string>();
    const grouped = new Map<string, Map<string, number>>();

    for (const row of rows) {
      const group = readField(row, groupBy) || "—";
      const column = splitBy === "none" ? "Count" : readField(row, splitBy) || "—";
      columns.add(column);
      const bucket = grouped.get(group) ?? new Map<string, number>();
      bucket.set(column, (bucket.get(column) ?? 0) + 1);
      grouped.set(group, bucket);
    }

    const columnList = [...columns].sort();
    const body = [...grouped.entries()]
      .map(([group, counts]) => {
        const totals = columnList.reduce((sum, column) => sum + (counts.get(column) ?? 0), 0);
        return { group, counts, total: totals };
      })
      .sort((a, b) => b.total - a.total);
    const grandTotal = body.reduce((sum, entry) => sum + entry.total, 0);
    return { columnList, body, grandTotal };
  }, [report.data, groupBy, splitBy]);

  function tableRecords(): Record<string, string>[] {
    if (!table) return [];
    return table.body.map((entry) => {
      const record: Record<string, string> = { [labelFor(groupBy)]: entry.group };
      for (const column of table.columnList) {
        record[column] = String(entry.counts.get(column) ?? 0);
      }
      record["Total"] = String(entry.total);
      record["Share"] = `${((entry.total / Math.max(1, table.grandTotal)) * 100).toFixed(1)}%`;
      return record;
    });
  }

  async function exportTable(format: "csv" | "xlsx" | "pdf" | "print" | "copy") {
    const records = tableRecords();
    if (records.length === 0) {
      toast.error("Choose a field to report on first.");
      return;
    }
    const title = `${labelFor(groupBy)} report`;
    const name = `${groupBy}-report-${new Date().toISOString().slice(0, 10)}`;
    if (format === "csv") exportCsv(records, name);
    else if (format === "xlsx") await exportXlsx(records, name);
    else if (format === "pdf") await exportPdf(records, name, title);
    else if (format === "print") printRows(records, title);
    else {
      await copyTable(records);
      toast.success("Report copied to your clipboard.");
    }
  }

  const maxHour = Math.max(1, ...(overview.data?.hourly ?? []).map((h) => h.count));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Report on any field, cross-tabulate it, then share or export.
          </p>
        </div>
        <ExportMenu spaceId={spaceId} filters={filters} title="Report records" />
      </header>

      <AttendeeFilters spaceId={spaceId} value={filters} onChange={setFilters} />

      <Card>
        <CardContent className="space-y-4 py-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                Report on
              </p>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Choose a field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choose a field…</SelectItem>
                  {fieldOptions.map((field) => (
                    <SelectItem key={field.key} value={field.key}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                Broken down by
              </p>
              <Select value={splitBy} onValueChange={setSplitBy}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Just totals</SelectItem>
                  {fieldOptions
                    .filter((field) => field.key !== groupBy)
                    .map((field) => (
                      <SelectItem key={field.key} value={field.key}>
                        {field.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => exportTable("csv")}>
                <FileText className="size-4" /> CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportTable("xlsx")}>
                <FileSpreadsheet className="size-4" /> Excel
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportTable("pdf")}>
                <FileText className="size-4" /> PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportTable("print")}>
                <Printer className="size-4" /> Print
              </Button>
              <Button size="sm" variant="ghost" onClick={() => exportTable("copy")}>
                <Clipboard className="size-4" /> Copy
              </Button>
            </div>
          </div>

          {report.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : table ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4">{labelFor(groupBy)}</th>
                    {table.columnList.map((column) => (
                      <th key={column} className="py-2 pr-4 text-right">
                        {column}
                      </th>
                    ))}
                    <th className="py-2 pr-4 text-right">Total</th>
                    <th className="py-2 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {table.body.map((entry) => (
                    <tr key={entry.group} className="border-b border-border/60">
                      <td className="py-2 pr-4 font-medium">{entry.group}</td>
                      {table.columnList.map((column) => (
                        <td key={column} className="py-2 pr-4 text-right tabular-nums">
                          {entry.counts.get(column) ?? 0}
                        </td>
                      ))}
                      <td className="py-2 pr-4 text-right font-semibold tabular-nums">
                        {entry.total}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {((entry.total / Math.max(1, table.grandTotal)) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Pick a field above to generate a report on it.
            </p>
          )}
        </CardContent>
      </Card>

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
                {breakdown.counts.slice(0, 8).map((entry) => (
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
              No records match these filters yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
