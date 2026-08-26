import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllSpaces, setSpaceStatus } from "@/lib/spaces.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/platform")({
  head: () => ({
    meta: [
      { title: "Platform administration — Registry" },
      { name: "description", content: "Oversee every space on the platform, review activity and suspend abuse." },
      { property: "og:title", content: "Platform administration — Registry" },
      { property: "og:description", content: "Oversee every space on the platform." },
    ],
  }),
  component: PlatformPage,
});

function PlatformPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listAllSpaces);
  const statusFn = useServerFn(setSpaceStatus);

  const spaces = useQuery({ queryKey: ["platform-spaces"], queryFn: () => listFn() });

  const setStatus = useMutation({
    mutationFn: (input: { spaceId: string; status: "ACTIVE" | "SUSPENDED" | "ARCHIVED" }) =>
      statusFn({ data: input }),
    onSuccess: () => {
      toast.success("Space updated");
      queryClient.invalidateQueries({ queryKey: ["platform-spaces"] });
    },
    onError: (error: unknown) =>
      toast.error(friendlyError(error, "You are not a platform administrator.")),
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link to="/spaces" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" />
        Back to spaces
      </Link>

      <header className="mt-6 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-sidebar text-sidebar-foreground">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl">Platform administration</h1>
          <p className="text-sm text-muted-foreground">
            {spaces.data
              ? `${spaces.data.totals.spaces} spaces · ${spaces.data.totals.users} users · ${spaces.data.totals.registrations} registrations`
              : "Every space on the platform."}
          </p>
        </div>
      </header>

      <div className="mt-8 space-y-3">
        {spaces.isLoading && <Skeleton className="h-24 w-full" />}
        {spaces.isError && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              You don&apos;t have platform administrator access.
            </CardContent>
          </Card>
        )}
        {(spaces.data?.spaces ?? []).map((space) => (
          <Card key={space.id} className="animate-rise">
            <CardContent className="flex flex-wrap items-center gap-3 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{space.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {space.space_type} · created {new Date(space.created_at).toLocaleDateString()}
                </p>
              </div>
              <Badge variant={space.status === "ACTIVE" ? "secondary" : "outline"}>{space.status}</Badge>
              {space.status === "ACTIVE" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus.mutate({ spaceId: space.id, status: "SUSPENDED" })}
                >
                  Suspend
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus.mutate({ spaceId: space.id, status: "ACTIVE" })}
                >
                  Reactivate
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
