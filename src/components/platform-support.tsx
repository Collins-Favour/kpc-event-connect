import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTicket, listTickets, replyToTicket, setTicketStatus } from "@/lib/support.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};

/** Platform-wide inbox of requests raised by space admins. */
export function PlatformSupport() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listTickets);
  const getFn = useServerFn(getTicket);
  const replyFn = useServerFn(replyToTicket);
  const statusFn = useServerFn(setTicketStatus);

  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const tickets = useQuery({
    queryKey: ["platform-tickets"],
    queryFn: () => listFn({ data: { scope: "PLATFORM" } }),
  });
  const thread = useQuery({
    queryKey: ["ticket", openId],
    enabled: Boolean(openId),
    queryFn: () => getFn({ data: { ticketId: openId! } }),
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
      void queryClient.invalidateQueries({ queryKey: ["platform-tickets"] });
    },
  });

  const openCount = (tickets.data ?? []).filter((t) => t.status !== "RESOLVED").length;

  return (
    <section className="mt-10">
      <div className="flex items-center gap-3">
        <h2 className="text-lg">Support inbox</h2>
        {openCount > 0 && <Badge>{openCount} open</Badge>}
      </div>

      <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
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
                  {ticket.space?.name ?? "Space"} · {ticket.created_by_label ?? "Admin"} ·{" "}
                  {new Date(ticket.created_at).toLocaleString()}
                </p>
              </button>
            ))}
            {tickets.data?.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No requests from space admins yet.
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
                  <h3 className="text-lg">{thread.data.ticket.subject}</h3>
                  <p className="text-xs text-muted-foreground">
                    {thread.data.ticket.space?.name ?? "Space"} ·{" "}
                    {thread.data.ticket.created_by_label ?? "Admin"}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm">{thread.data.ticket.body}</p>
                </div>
                <div className="space-y-3 border-t border-border pt-3">
                  {thread.data.messages.map((message) => (
                    <div key={message.id} className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs font-medium">{message.author_label ?? "Platform"}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(message.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
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
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
