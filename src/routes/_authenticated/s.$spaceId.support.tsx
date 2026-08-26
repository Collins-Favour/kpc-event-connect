import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createTicket,
  getTicket,
  listTickets,
  replyToTicket,
  setTicketStatus,
} from "@/lib/support.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { LifeBuoy, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/s/$spaceId/support")({
  head: () => ({
    meta: [
      { title: "Support — Leepek" },
      {
        name: "description",
        content: "Answer help requests from your registration desks and contact the platform team.",
      },
      { property: "og:title", content: "Support — Leepek" },
      { property: "og:description", content: "Desk help requests and platform support." },
    ],
  }),
  component: SupportPage,
});

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};

function SupportPage() {
  const { spaceId } = Route.useParams();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listTickets);
  const createFn = useServerFn(createTicket);
  const getFn = useServerFn(getTicket);
  const replyFn = useServerFn(replyToTicket);
  const statusFn = useServerFn(setTicketStatus);

  const [scope, setScope] = useState<"SPACE" | "PLATFORM">("SPACE");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);

  const tickets = useQuery({
    queryKey: ["tickets", spaceId, scope],
    queryFn: () => listFn({ data: { spaceId, scope } }),
  });
  const thread = useQuery({
    queryKey: ["ticket", openId],
    enabled: Boolean(openId),
    queryFn: () => getFn({ data: { ticketId: openId! } }),
  });

  const create = useMutation({
    mutationFn: () => createFn({ data: { spaceId, scope: "PLATFORM", subject, body } }),
    onSuccess: () => {
      toast.success("Sent to the platform team.");
      setSubject("");
      setBody("");
      setComposeOpen(false);
      setScope("PLATFORM");
      void queryClient.invalidateQueries({ queryKey: ["tickets", spaceId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const postReply = useMutation({
    mutationFn: () => replyFn({ data: { ticketId: openId!, body: reply } }),
    onSuccess: () => {
      setReply("");
      void queryClient.invalidateQueries({ queryKey: ["ticket", openId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changeStatus = useMutation({
    mutationFn: (status: "OPEN" | "IN_PROGRESS" | "RESOLVED") =>
      statusFn({ data: { ticketId: openId!, status } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ticket", openId] });
      void queryClient.invalidateQueries({ queryKey: ["tickets", spaceId] });
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Support</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Help requests raised at your desks, and your own requests to the platform team.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={scope} onValueChange={(v) => setScope(v as "SPACE" | "PLATFORM")}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SPACE">Desk &amp; member requests</SelectItem>
              <SelectItem value="PLATFORM">Sent to platform team</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
            <DialogTrigger asChild>
              <Button>
                <LifeBuoy className="size-4" />
                Contact platform
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Contact the platform team</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Billing, a bug, a feature request…"
                  />
                </div>
                <div>
                  <Label htmlFor="body">Message</Label>
                  <Textarea
                    id="body"
                    rows={6}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  Send request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardContent className="space-y-2 py-4">
            {tickets.isLoading && <Skeleton className="h-24 w-full" />}
            {(tickets.data ?? []).map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => setOpenId(ticket.id)}
                className={`w-full rounded-lg border p-3 text-left transition-colors duration-150 hover:bg-accent ${
                  openId === ticket.id ? "border-primary" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{ticket.subject}</span>
                  <Badge variant={ticket.status === "RESOLVED" ? "secondary" : "default"}>
                    {STATUS_LABEL[ticket.status] ?? ticket.status}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {ticket.created_by_label ?? "Member"} ·{" "}
                  {new Date(ticket.created_at).toLocaleString()}
                </p>
              </button>
            ))}
            {tickets.data?.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No requests here yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            {!openId && (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Select a request to read and reply.
              </p>
            )}
            {openId && thread.isLoading && <Skeleton className="h-40 w-full" />}
            {openId && thread.data && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg">{thread.data.ticket.subject}</h2>
                  <p className="text-xs text-muted-foreground">
                    {thread.data.ticket.created_by_label ?? "Member"}
                    {thread.data.ticket.desk?.name ? ` · ${thread.data.ticket.desk.name}` : ""}
                    {thread.data.ticket.event?.name ? ` · ${thread.data.ticket.event.name}` : ""}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm">{thread.data.ticket.body}</p>
                </div>

                <div className="space-y-3 border-t border-border pt-3">
                  {thread.data.messages.map((message) => (
                    <div key={message.id} className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs font-medium">{message.author_label ?? "Admin"}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(message.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Textarea
                    rows={3}
                    placeholder="Write a reply…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => postReply.mutate()}
                      disabled={!reply.trim() || postReply.isPending}
                    >
                      <Send className="size-4" />
                      Reply
                    </Button>
                    <Select
                      value={thread.data.ticket.status}
                      onValueChange={(v) =>
                        changeStatus.mutate(v as "OPEN" | "IN_PROGRESS" | "RESOLVED")
                      }
                    >
                      <SelectTrigger className="h-9 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPEN">Open</SelectItem>
                        <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                        <SelectItem value="RESOLVED">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
