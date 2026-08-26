import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/kpc.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, LogOut, MapPin, UserPlus, LayoutDashboard, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/desk")({
  head: () => ({
    meta: [
      { title: "Registration desk — KPC" },
      {
        name: "description",
        content: "Registrar desk home showing the active event, assigned desk and registration action.",
      },
      { property: "og:title", content: "Registration desk — KPC" },
      { property: "og:description", content: "Registrar desk home for KPC event registration." },
    ],
  }),
  component: DeskHome,
});

function DeskHome() {
  const fetchContext = useServerFn(getMyContext);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-context"], queryFn: () => fetchContext() });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const firstName = (data.profile?.name || "there").split(" ")[0];
  const isStaff = data.role === "ADMIN" || data.role === "SUPER_ADMIN";
  const assignment = data.assignment;

  return (
    <main className="min-h-screen bg-sidebar px-4 py-10 text-sidebar-foreground">
      <div className="mx-auto w-full max-w-lg">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.25em] opacity-70">KPC Registration</p>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="mr-2 size-4" /> Sign out
          </Button>
        </div>

        <h1 className="mt-8 text-3xl font-semibold">Welcome, {firstName} 👋</h1>
        <p className="mt-1 text-sm opacity-80">{data.profile?.email}</p>

        <Card className="mt-8">
          <CardContent className="space-y-5 pt-6">
            {assignment ? (
              <>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Event</p>
                  <p className="text-lg font-semibold text-card-foreground">{assignment.event?.name}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Registration desk
                  </p>
                  <p className="text-lg font-semibold text-card-foreground">
                    {assignment.desk?.name?.toUpperCase()} — {assignment.desk?.code}
                  </p>
                  {assignment.desk?.location && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" /> {assignment.desk.location}
                    </p>
                  )}
                </div>
                <Button asChild className="h-16 w-full text-base font-semibold">
                  <Link to="/desk/register">
                    <UserPlus className="mr-2 size-5" /> REGISTER ATTENDEE
                  </Link>
                </Button>
              </>
            ) : (
              <div className="flex gap-3 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                <AlertTriangle className="size-5 shrink-0 text-accent" />
                <p>
                  You have no active desk assignment yet. An administrator must assign you to an
                  event and registration desk before you can register attendees.
                </p>
              </div>
            )}

            {isStaff && (
              <Button asChild variant="outline" className="h-12 w-full">
                <Link to="/admin">
                  <LayoutDashboard className="mr-2 size-4" /> Administration
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
