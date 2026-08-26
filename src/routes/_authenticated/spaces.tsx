import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMySpaces, getMyProfile } from "@/lib/spaces.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/spaces")({
  head: () => ({
    meta: [
      { title: "Your spaces — Registry" },
      { name: "description", content: "Switch between the event registration workspaces you belong to." },
      { property: "og:title", content: "Your spaces — Registry" },
      { property: "og:description", content: "Switch between your event registration workspaces." },
    ],
  }),
  component: SpacesPage,
});

function SpacesPage() {
  const navigate = useNavigate();
  const list = useServerFn(listMySpaces);
  const profileFn = useServerFn(getMyProfile);
  const spaces = useQuery({ queryKey: ["my-spaces"], queryFn: () => list() });
  const me = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <span className="text-sm font-semibold tracking-tight">Registry</span>
        <div className="flex items-center gap-2">
          {me.data?.isPlatformAdmin && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/platform">
                <ShieldCheck className="size-4" />
                Platform
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl">Your spaces</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A space holds your events, desks, forms and attendance data.
            </p>
          </div>
          <Button asChild>
            <Link to="/create">
              <Plus className="size-4" />
              New space
            </Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {spaces.isLoading &&
            [0, 1].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}

          {spaces.data?.map((space) => (
            <Link
              key={space.id}
              to="/s/$spaceId"
              params={{ spaceId: space.id }}
              className="animate-rise block"
            >
              <Card className="h-full transition-transform duration-200 hover:-translate-y-0.5">
                <CardContent className="py-6">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold">{space.name}</h2>
                    <Badge variant="secondary">
                      {space.role === "SPACE_SUPER_ADMIN" ? "Super admin" : "Admin"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {space.space_type.toLowerCase()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}

          {spaces.data?.length === 0 && (
            <Card className="sm:col-span-2">
              <CardContent className="py-12 text-center">
                <h2 className="text-lg font-semibold">No spaces yet</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create your first space to start running event registration.
                </p>
                <Button asChild className="mt-6">
                  <Link to="/create">Create a space</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </main>
  );
}
