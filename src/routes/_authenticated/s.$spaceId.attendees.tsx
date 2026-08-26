import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRegistrations } from "@/lib/reports.functions";
import { decodeFilterSet, emptyFilterSet, type FilterSet } from "@/lib/filters";
import { AttendeeFilters } from "@/components/attendee-filters";
import { ExportMenu } from "@/components/export-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/s/$spaceId/attendees")({
  head: () => ({
    meta: [
      { title: "Attendees — Leepek" },
      {
        name: "description",
        content: "Search, segment and export everyone registered across your events and desks.",
      },
      { property: "og:title", content: "Attendees — Leepek" },
      { property: "og:description", content: "Search, segment and export your registrations." },
    ],
  }),
  component: AttendeesPage,
});

function AttendeesPage() {
  const { spaceId } = Route.useParams();
  const listFn = useServerFn(listRegistrations);

  const [filters, setFilters] = useState<FilterSet>(() => {
    if (typeof window === "undefined") return emptyFilterSet();
    const params = new URLSearchParams(window.location.search);
    return decodeFilterSet(params.get("view")) ?? emptyFilterSet();
  });
  const [page, setPage] = useState(1);

  function updateFilters(next: FilterSet) {
    setFilters(next);
    setPage(1);
  }

  const rows = useQuery({
    queryKey: ["registrations", spaceId, filters, page],
    placeholderData: keepPreviousData,
    queryFn: () => listFn({ data: { spaceId, ...filters, page, pageSize: 25 } }),
  });

  const total = rows.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Attendees</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} record{total === 1 ? "" : "s"} match your filters
          </p>
        </div>
        <ExportMenu spaceId={spaceId} filters={filters} title="Attendees" />
      </header>

      <AttendeeFilters spaceId={spaceId} value={filters} onChange={updateFilters} />

      <Card>
        <CardContent className="p-0">
          {rows.isLoading ? (
            <div className="space-y-2 p-6">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Desk</TableHead>
                    <TableHead>Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(rows.data?.rows ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.registration_number}</TableCell>
                      <TableCell className="font-medium">{row.full_name}</TableCell>
                      <TableCell>{row.phone ?? "—"}</TableCell>
                      <TableCell>{row.location ?? "—"}</TableCell>
                      <TableCell>{row.event?.name ?? "—"}</TableCell>
                      <TableCell>{row.desk?.code ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.registered_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.data?.rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-12 text-center text-sm text-muted-foreground"
                      >
                        No registrations match these filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {page} of {pages}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
