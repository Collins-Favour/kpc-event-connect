import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listEvents, upsertEvent } from "@/lib/events.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Loader2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/s/$spaceId/events")({
  head: () => ({
    meta: [
      { title: "Events — Leepek" },
      { name: "description", content: "Create and manage the events people register for in this space." },
      { property: "og:title", content: "Events — Leepek" },
      { property: "og:description", content: "Create and manage your registration events." },
    ],
  }),
  component: EventsPage,
});

type EventStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";

function EventsPage() {
  const { spaceId } = Route.useParams();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listEvents);
  const upsertFn = useServerFn(upsertEvent);

  const events = useQuery({
    queryKey: ["events", spaceId],
    queryFn: () => listFn({ data: { spaceId } }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | undefined>();
  const [form, setForm] = useState({
    name: "",
    description: "",
    venue: "",
    start_date: "",
    end_date: "",
    registration_prefix: "REG",
    status: "ACTIVE" as EventStatus,
  });

  const save = useMutation({
    mutationFn: () => upsertFn({ data: { spaceId, id: editing, ...form } }),
    onSuccess: () => {
      toast.success(editing ? "Event updated" : "Event created");
      setOpen(false);
      setEditing(undefined);
      queryClient.invalidateQueries({ queryKey: ["events", spaceId] });
    },
    onError: (error: unknown) =>
      toast.error(friendlyError(error, "Could not save the event.")),
  });

  function openNew() {
    setEditing(undefined);
    setForm({
      name: "",
      description: "",
      venue: "",
      start_date: "",
      end_date: "",
      registration_prefix: "REG",
      status: "ACTIVE",
    });
    setOpen(true);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each event gets its own registration form, desks and numbering.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="size-4" />
              New event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit event" : "New event"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="event-name">Name</Label>
                <Input
                  id="event-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-desc">Description</Label>
                <Textarea
                  id="event-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="event-start">Start date</Label>
                  <Input
                    id="event-start"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-end">End date</Label>
                  <Input
                    id="event-end"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-venue">Venue</Label>
                <Input
                  id="event-venue"
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="event-prefix">Registration prefix</Label>
                  <Input
                    id="event-prefix"
                    value={form.registration_prefix}
                    onChange={(e) =>
                      setForm({ ...form, registration_prefix: e.target.value.toUpperCase() })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) => setForm({ ...form, status: value as EventStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"].map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending && <Loader2 className="size-4 animate-spin" />}
                Save event
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {events.isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        {events.data?.map((event) => (
          <Card key={event.id} className="animate-rise">
            <CardContent className="py-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{event.name}</h2>
                <Badge variant={event.status === "ACTIVE" ? "default" : "secondary"}>
                  {event.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {event.venue || "No venue"} ·{" "}
                {event.start_date ? new Date(event.start_date).toLocaleDateString() : "No date"}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Numbering prefix {event.registration_prefix}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setEditing(event.id);
                  setForm({
                    name: event.name,
                    description: event.description ?? "",
                    venue: event.venue ?? "",
                    start_date: event.start_date ?? "",
                    end_date: event.end_date ?? "",
                    registration_prefix: event.registration_prefix,
                    status: event.status as EventStatus,
                  });
                  setOpen(true);
                }}
              >
                Edit
              </Button>
            </CardContent>
          </Card>
        ))}
        {events.data?.length === 0 && (
          <Card className="sm:col-span-2">
            <CardContent className="py-12 text-center">
              <h2 className="text-lg font-semibold">No events yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create an event to start building its registration form and desks.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
