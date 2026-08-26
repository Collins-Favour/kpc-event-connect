import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startDeskSession } from "@/lib/registration.functions";
import { saveDeskSession } from "@/lib/desk-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join a registration desk — Registry" },
      {
        name: "description",
        content:
          "Enter your desk token to start registering attendees. The token identifies your workspace, event and desk.",
      },
      { property: "og:title", content: "Join a registration desk — Registry" },
      {
        property: "og:description",
        content: "Enter a desk token to start registering attendees at your event.",
      },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const navigate = useNavigate();
  const start = useServerFn(startDeskSession);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await start({ data: { token } });
      saveDeskSession(session.sessionId, session.secret);
      navigate({ to: "/desk/$sessionId", params: { sessionId: session.sessionId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That token could not be verified.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            Registry
          </Link>
          <h1 className="mt-6 text-2xl">Join a desk</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the token your organiser gave you.
          </p>
        </div>

        <Card className="animate-rise">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">Desk token</Label>
                <Input
                  id="token"
                  required
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="XXXX-XXXX"
                  value={token}
                  onChange={(e) => setToken(e.target.value.toUpperCase())}
                  className="h-14 text-center font-mono text-xl tracking-[0.3em]"
                />
              </div>
              {error && (
                <p className="animate-fade text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Verify token
              </Button>
            </form>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Managing the event instead?{" "}
              <Link to="/login" className="underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
