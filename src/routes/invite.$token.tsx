import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { acceptInvitation } from "@/lib/spaces.functions";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Accept your invitation — Leepek" },
      {
        name: "description",
        content: "Accept an invitation to join an event registration workspace.",
      },
      { property: "og:title", content: "Accept your invitation — Leepek" },
      { property: "og:description", content: "Join an event registration workspace." },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const accept = useServerFn(acceptInvitation);
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !session || state !== "idle") return;
    setState("working");
    accept({ data: { token } })
      .then((result) => {
        navigate({ to: "/s/$spaceId", params: { spaceId: result.spaceId }, replace: true });
      })
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "This invitation could not be accepted.");
        setState("error");
      });
  }, [loading, session, state, accept, token, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-sm animate-rise">
        <CardContent className="py-10 text-center">
          {!session && !loading ? (
            <>
              <h1 className="text-xl">You&apos;ve been invited</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in to accept this workspace invitation.
              </p>
              <Button asChild className="mt-6 h-11 w-full">
                <Link to="/login">Sign in to continue</Link>
              </Button>
            </>
          ) : state === "error" ? (
            <>
              <h1 className="text-xl">Invitation not accepted</h1>
              <p className="mt-2 text-sm text-muted-foreground">{message}</p>
              <Button asChild variant="outline" className="mt-6 h-11 w-full">
                <Link to="/spaces">Go to your spaces</Link>
              </Button>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Accepting your invitation…
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
