import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSpace, updateSpace } from "@/lib/spaces.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/s/$spaceId/settings")({
  head: () => ({
    meta: [
      { title: "Space settings — Registry" },
      { name: "description", content: "Rename your space, set its timezone and update its description." },
      { property: "og:title", content: "Space settings — Registry" },
      { property: "og:description", content: "Rename your space and update its details." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { spaceId } = Route.useParams();
  const queryClient = useQueryClient();
  const spaceFn = useServerFn(getSpace);
  const updateFn = useServerFn(updateSpace);

  const space = useQuery({ queryKey: ["space", spaceId], queryFn: () => spaceFn({ data: { spaceId } }) });
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
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not save the settings."),
  });

  const canEdit = space.data?.role === "SPACE_SUPER_ADMIN";

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {canEdit ? "Only space super admins can change these." : "Read-only — ask a super admin to make changes."}
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
                <span>Type: {space.data?.space.type}</span>
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
    </div>
  );
}
