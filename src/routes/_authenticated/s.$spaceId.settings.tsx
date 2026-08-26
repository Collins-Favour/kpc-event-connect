import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { deleteSpace, getSpace, setMySpaceStatus, updateSpace } from "@/lib/spaces.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Archive, Loader2, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/s/$spaceId/settings")({
  head: () => ({
    meta: [
      { title: "Space settings — Leepek" },
      {
        name: "description",
        content: "Rename your space, set its timezone and update its description.",
      },
      { property: "og:title", content: "Space settings — Leepek" },
      { property: "og:description", content: "Rename your space and update its details." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { spaceId } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const spaceFn = useServerFn(getSpace);
  const updateFn = useServerFn(updateSpace);
  const statusFn = useServerFn(setMySpaceStatus);
  const deleteFn = useServerFn(deleteSpace);

  const space = useQuery({
    queryKey: ["space", spaceId],
    queryFn: () => spaceFn({ data: { spaceId } }),
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    if (space.data?.space) {
      setName(space.data.space.name);
      setDescription(space.data.space.description ?? "");
      setTimezone(space.data.space.timezone ?? "UTC");
    }
  }, [space.data]);

  const save = useMutation({
    mutationFn: () => updateFn({ data: { spaceId, name, description, timezone } }),
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["space", spaceId] });
      queryClient.invalidateQueries({ queryKey: ["my-spaces"] });
    },
    onError: (error: unknown) => toast.error(friendlyError(error, "Could not save the settings.")),
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const archived = space.data?.space.status === "ARCHIVED";

  const changeStatus = useMutation({
    mutationFn: (status: "ACTIVE" | "ARCHIVED") => statusFn({ data: { spaceId, status } }),
    onSuccess: (_result, status) => {
      toast.success(status === "ARCHIVED" ? "Space archived" : "Space reactivated");
      queryClient.invalidateQueries({ queryKey: ["space", spaceId] });
      queryClient.invalidateQueries({ queryKey: ["my-spaces"] });
    },
    onError: (error: unknown) => toast.error(friendlyError(error, "Could not update the space.")),
  });

  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { spaceId, confirmName } }),
    onSuccess: () => {
      toast.success("Space deleted");
      queryClient.invalidateQueries({ queryKey: ["my-spaces"] });
      navigate({ to: "/spaces", replace: true });
    },
    onError: (error: unknown) => toast.error(friendlyError(error, "Could not delete the space.")),
  });

  const canEdit = space.data?.role === "SPACE_SUPER_ADMIN";

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {canEdit
            ? "Only space super admins can change these."
            : "Read-only — ask a super admin to make changes."}
        </p>
      </header>

      <Card>
        <CardContent className="space-y-5 py-6">
          {space.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="space-name">Space name</Label>
                <Input
                  id="space-name"
                  value={name}
                  disabled={!canEdit}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="space-description">Description</Label>
                <Textarea
                  id="space-description"
                  rows={3}
                  value={description}
                  disabled={!canEdit}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="space-timezone">Timezone</Label>
                <Input
                  id="space-timezone"
                  value={timezone}
                  disabled={!canEdit}
                  placeholder="Africa/Nairobi"
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Type: {space.data?.space.space_type}</span>
                <span>Status: {space.data?.space.status}</span>
              </div>
              {canEdit && (
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending && <Loader2 className="size-4 animate-spin" />}
                  Save changes
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <Card className="border-destructive/40">
          <CardContent className="space-y-5 py-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 text-destructive" />
              <div>
                <h2 className="text-sm font-semibold">Manage this space</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Archiving hides the space from everyday use but keeps all data. Deleting removes
                  the space and every event, desk, form and attendee record inside it.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={changeStatus.isPending}
                onClick={() => changeStatus.mutate(archived ? "ACTIVE" : "ARCHIVED")}
              >
                {changeStatus.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Archive className="size-4" />
                )}
                {archived ? "Reactivate space" : "Archive space"}
              </Button>
              <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                <Trash2 className="size-4" />
                Delete space
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this space?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes <strong>{space.data?.space.name}</strong> with all of its
            events, desks, forms, attendees and reports. This cannot be undone.
          </p>
          <div className="space-y-2">
            <Label htmlFor="confirm-name">
              Type <span className="font-medium">{space.data?.space.name}</span> to confirm
            </Label>
            <Input
              id="confirm-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                remove.isPending ||
                confirmName.trim().toLowerCase() !==
                  (space.data?.space.name ?? "").trim().toLowerCase()
              }
              onClick={() => remove.mutate()}
            >
              {remove.isPending && <Loader2 className="size-4 animate-spin" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
