import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { issueDeskToken, listDesks, listEvents, revokeDeskToken, upsertDesk } from "@/lib/events.functions";
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
import { Copy, KeyRound, Loader2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/s/$spaceId/desks")({
  head: () => ({
    meta: [
      { title: "Registration desks — Registry" },
      { name: "description", content: "Create registration desks and issue secure, expiring desk tokens." },
      { property: "og:title", content: "Registration desks — Registry" },
      { property: "og:description", content: "Create desks and issue secure desk tokens." },
    ],
  }),
  component: DesksPage,
});

function DesksPage() {
  const { spaceId } = Route.useParams();
  const queryClient = useQueryClient();
  const eventsFn = useServerFn(listEvents);
  const desksFn = useServerFn(listDesks);
  const upsertFn = useServerFn(upsertDesk);
  const issueFn = useServerFn(issueDeskToken);
  const revokeFn = useServerFn(revokeDeskToken);

  const events = useQuery({ queryKey: ["events", spaceId], queryFn: () => eventsFn({ data: { spaceId } }) });
  const [eventId, setEventId] = useState<string | undefined>();
  const activeEvent = eventId ?? events.data?.[0]?.id;

  const desks = useQuery({
    queryKey: ["desks", spaceId, activeEvent],
    enabled: Boolean(activeEvent),
    queryFn: () => desksFn({ data: { spaceId, eventId: activeEvent! } }),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", location: "" });
  const [issued, setIssued] = useState<{ token: string; expires_at: string } | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["desks", spaceId, activeEvent] });

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          spaceId,
          eventId: activeEvent!,
          name: form.name,
          code: form.code.trim() || deskCodeFromName(form.name),

          location: form.location,
          status: "ACTIVE",
        },
      }),
    onSuccess: () => {
      toast.success("Desk created");
      setOpen(false);
      setForm({ name: "", code: "", location: "" });
      invalidate();
    },
    onError: (error: unknown) =>
      toast.error(friendlyError(error, "Could not create the desk.")),
  });

  const issue = useMutation({
    mutationFn: (deskId: string) => issueFn({ data: { spaceId, deskId, hours: 24 } }),
    onSuccess: (result) => {
      setIssued({ token: result.token, expires_at: result.expires_at });
      invalidate();
    },
    onError: (error: unknown) =>
      toast.error(friendlyError(error, "Could not issue a token.")),
  });

  const revoke = useMutation({
    mutationFn: (tokenId: string) => revokeFn({ data: { spaceId, tokenId } }),
    onSuccess: () => {
      toast.success("Token revoked");
      invalidate();
    },
  });

  const toggleStatus = useMutation({
    mutationFn: (desk: { id: string; name: string; code: string; location: string | null; status: string }) =>
      upsertFn({
        data: {
          spaceId,
          eventId: activeEvent!,
          id: desk.id,
          name: desk.name,
          code: desk.code,
          location: desk.location ?? "",
          status: desk.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        },
      }),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Desks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Issue a token per desk. Staff enter it at <span className="font-mono">/join</span> — no
            account needed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={activeEvent ?? ""} onValueChange={setEventId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Choose an event" />
            </SelectTrigger>
            <SelectContent>
              {(events.data ?? []).map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={!activeEvent} onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            New desk
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {desks.isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        {desks.data?.desks.map((desk) => {
          const token = desks.data.tokens.find((t) => t.desk_id === desk.id && t.status === "ACTIVE");
          const live = desks.data.sessions.some((s) => s.desk_id === desk.id);
          return (
            <Card key={desk.id} className="animate-rise">
              <CardContent className="py-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{desk.name}</h2>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {desk.code} · {desk.location || "No location"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={desk.status === "ACTIVE" ? "default" : "outline"}>
                      {desk.status}
                    </Badge>
                    {live && <Badge variant="secondary">Live</Badge>}
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-muted p-3 text-xs">
                  {token ? (
                    <>
                      Active token ending{" "}
                      <span className="font-mono font-medium">{token.token_hint}</span> · expires{" "}
                      {new Date(token.expires_at).toLocaleString()}
                    </>
                  ) : (
                    "No active token."
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => issue.mutate(desk.id)} disabled={issue.isPending}>
                    <KeyRound className="size-4" />
                    {token ? "Regenerate token" : "Issue token"}
                  </Button>
                  {token && (
                    <Button size="sm" variant="outline" onClick={() => revoke.mutate(token.id)}>
                      Revoke
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      toggleStatus.mutate({
                        id: desk.id,
                        name: desk.name,
                        code: desk.code,
                        location: desk.location,
                        status: desk.status,
                      })
                    }
                  >
                    {desk.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {desks.data?.desks.length === 0 && (
          <Card className="sm:col-span-2">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No desks for this event yet.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New desk</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="desk-name">Name</Label>
              <Input
                id="desk-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desk-code">Code</Label>
              <Input
                id="desk-code"
                placeholder="DESK-01"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desk-location">Location</Label>
              <Input
                id="desk-location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" />}
              Create desk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(issued)} onOpenChange={() => setIssued(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desk token</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Shown once. Give it to the person working this desk — they enter it at /join.
          </p>
          <p className="rounded-lg bg-muted py-6 text-center font-mono text-2xl tracking-[0.2em]">
            {issued?.token}
          </p>
          <p className="text-xs text-muted-foreground">
            Expires {issued ? new Date(issued.expires_at).toLocaleString() : ""}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (issued) navigator.clipboard.writeText(issued.token);
                toast.success("Token copied");
              }}
            >
              <Copy className="size-4" />
              Copy
            </Button>
            <Button onClick={() => setIssued(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
