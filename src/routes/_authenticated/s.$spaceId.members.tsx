import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getSpace,
  inviteMember,
  listMembers,
  removeMember,
  revokeInvitation,
  updateMemberRole,
} from "@/lib/spaces.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { Copy, Loader2, UserPlus } from "lucide-react";
import { PageNav } from "@/components/page-nav";

export const Route = createFileRoute("/_authenticated/s/$spaceId/members")({
  head: () => ({
    meta: [
      { title: "Members — Leepek" },
      { name: "description", content: "Invite administrators and manage roles inside your space." },
      { property: "og:title", content: "Members — Leepek" },
      { property: "og:description", content: "Invite administrators and manage space roles." },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const { spaceId } = Route.useParams();
  const queryClient = useQueryClient();
  const spaceFn = useServerFn(getSpace);
  const listFn = useServerFn(listMembers);
  const inviteFn = useServerFn(inviteMember);
  const revokeFn = useServerFn(revokeInvitation);
  const roleFn = useServerFn(updateMemberRole);
  const removeFn = useServerFn(removeMember);

  const space = useQuery({ queryKey: ["space", spaceId], queryFn: () => spaceFn({ data: { spaceId } }) });
  const members = useQuery({ queryKey: ["members", spaceId], queryFn: () => listFn({ data: { spaceId } }) });
  const isSuper = space.data?.role === "SPACE_SUPER_ADMIN";

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["members", spaceId] });

  const invite = useMutation({
    mutationFn: () => inviteFn({ data: { spaceId, email, role: "SPACE_ADMIN" as const } }),
    onSuccess: (result) => {
      setLink(`${window.location.origin}/invite/${result.token}`);
      setOpen(false);
      setEmail("");
      invalidate();
    },
    onError: (error: unknown) =>
      toast.error(friendlyError(error, "Could not create the invitation.")),
  });

  const changeRole = useMutation({
    mutationFn: (input: { memberId: string }) =>
      roleFn({ data: { spaceId, ...input, role: "SPACE_ADMIN" as const } }),
    onSuccess: () => {
      toast.success("Role updated");
      invalidate();
    },
    onError: (error: unknown) =>
      toast.error(friendlyError(error, "Could not update the role.")),
  });

  const remove = useMutation({
    mutationFn: (memberId: string) => removeFn({ data: { spaceId, memberId } }),
    onSuccess: () => {
      toast.success("Member removed");
      invalidate();
    },
    onError: (error: unknown) =>
      toast.error(friendlyError(error, "Could not remove the member.")),
  });

  const revoke = useMutation({
    mutationFn: (invitationId: string) => revokeFn({ data: { spaceId, invitationId } }),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-8">
      <PageNav className="-ml-2 lg:hidden" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administrators of this space. Desk staff don&apos;t need membership.
          </p>
        </div>
        {isSuper && (
          <Button onClick={() => setOpen(true)}>
            <UserPlus className="size-4" />
            Invite admin
          </Button>
        )}
      </header>

      <Card>
        <CardContent className="divide-y p-0">
          {(members.data?.members ?? []).map((member) => (
            <div key={member.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{member.profile?.name || member.profile?.email}</p>
                <p className="truncate text-xs text-muted-foreground">{member.profile?.email}</p>
              </div>
              <Badge variant={member.role === "SPACE_SUPER_ADMIN" ? "default" : "secondary"}>
                {member.role === "SPACE_SUPER_ADMIN" ? "Super admin" : "Admin"}
              </Badge>
              {isSuper && (
                <div className="flex gap-2">
                  {member.role === "SPACE_SUPER_ADMIN" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => changeRole.mutate({ memberId: member.id })}
                    >
                      Make admin
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(member.id)}>
                    Remove
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {(members.data?.invitations ?? []).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold">Invitations</h2>
          <Card className="mt-3">
            <CardContent className="divide-y p-0">
              {members.data!.invitations.map((invitation) => (
                <div key={invitation.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm">{invitation.email}</span>
                  <Badge variant="outline">{invitation.status}</Badge>
                  <span className="text-xs text-muted-foreground">
                    expires {new Date(invitation.expires_at).toLocaleDateString()}
                  </span>
                  {isSuper && invitation.status === "PENDING" && (
                    <Button size="sm" variant="ghost" onClick={() => revoke.mutate(invitation.id)}>
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite an administrator</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              They join as a space admin. Only the space owner keeps super admin rights.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => invite.mutate()} disabled={invite.isPending}>
              {invite.isPending && <Loader2 className="size-4 animate-spin" />}
              Create invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(link)} onOpenChange={() => setLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitation link</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Share this link with the person you invited. It works once and expires in 14 days.
          </p>
          <p className="break-all rounded-lg bg-muted p-3 font-mono text-xs">{link}</p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (link) navigator.clipboard.writeText(link);
                toast.success("Link copied");
              }}
            >
              <Copy className="size-4" />
              Copy link
            </Button>
            <Button onClick={() => setLink(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
