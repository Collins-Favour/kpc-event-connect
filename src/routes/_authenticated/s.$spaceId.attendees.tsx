import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRegistrations } from "@/lib/reports.functions";
import { listEvents } from "@/lib/events.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/s/$spaceId/attendees")({
  head: () => ({
    meta: [
      { title: "Attendees — Registry" },
      { name: "description", content: "Search and filter everyone registered across your events and desks." },
      { property: "og:title", content: "Attendees — Registry" },
      { property: "og:description", content: "Search and filter your event registrations." },
    ],
  }),
  component: AttendeesPage,
});

function AttendeesPage() {
  const { spaceId } = Route.useParams();
  const listFn = useServerFn(listRegistrations);
  const eventsFn = useServerFn(listEvents);

  const events = useQuery({ queryKey: ["events", spaceId], queryFn: () => eventsFn({ data: { spaceId } }) });
  const [search, setSearch] = useState("");
  const [eventId, setEventId] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const rows = useQuery({
    queryKey: ["registrations", spaceId, search, eventId, from, to, page],
    placeholderData: keepPreviousData,
    queryFn: () =>
      listFn({
        data: {
          spaceId,
          page,
          pageSize: 25,
          search: search || undefined,
          eventId: eventId === "all" ? undefined : eventId,
          from: from || undefined,
          to: to || undefined,
        },
      }),
  });

  const total = rows.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl">Attendees</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} registration{total === 1 ? "" : "s"}</p>
      </header>

      <Card>
        <CardContent className="flex flex-wrap gap-3 py-4">
          <Input
            placeholder="Search name, phone, email, number…"
            className="h-10 min-w-56 flex-1"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={eventId}
            onValueChange={(value) => {
              setEventId(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48">
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
          <Input type="date" className="h-10 w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" className="h-10 w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </CardContent>
      </Card>

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
                      <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
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
