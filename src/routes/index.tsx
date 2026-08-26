import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, KeyRound, LayoutGrid, ShieldCheck, Timer } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Registry — Event registration & attendance platform" },
      {
        name: "description",
        content:
          "Run event registration across many desks from one workspace: secure desk tokens, custom registration forms, live attendance dashboards and reports.",
      },
      { property: "og:title", content: "Registry — Event registration & attendance platform" },
      {
        property: "og:description",
        content:
          "Multi-workspace event registration with secure desk tokens, custom forms and live reporting.",
      },
    ],
  }),
  component: Landing,
});

const pillars = [
  {
    icon: KeyRound,
    title: "Desk tokens, not accounts",
    body: "Registration staff enter a short-lived token. It resolves the workspace, event and desk for them.",
  },
  {
    icon: LayoutGrid,
    title: "Forms you define",
    body: "Start from name, phone, email and location, then add any field your event actually needs.",
  },
  {
    icon: Timer,
    title: "Built for the queue",
    body: "One question group at a time, large controls and confirmed saves before the next person steps up.",
  },
  {
    icon: ShieldCheck,
    title: "Isolated by design",
    body: "Every request is checked against your membership on the server. Workspaces never see each other.",
  },
];

function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-sm font-semibold tracking-tight">Registry</span>
        <Link
          to="/login"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-20 pt-16 text-center sm:pt-24">
        <p className="animate-fade text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
          Event registration platform
        </p>
        <h1 className="animate-rise mt-5 text-balance text-4xl leading-tight sm:text-6xl">
          Register everyone at the door, without the queue.
        </h1>
        <p className="animate-rise stagger-1 mx-auto mt-6 max-w-xl text-pretty text-base text-muted-foreground">
          One workspace for your events, registration desks and attendance data — for organizations,
          teams, schools, conferences and communities alike.
        </p>
        <div className="animate-rise stagger-2 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 w-full px-8 sm:w-auto">
            <Link to="/join">
              Join a desk
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 w-full px-8 sm:w-auto">
            <Link to="/create">Create a space</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Joining a desk needs only a token. Creating a space needs an account.
        </p>
      </section>

      <section className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="bg-card p-8">
              <pillar.icon className="size-5 text-accent" />
              <h2 className="mt-5 text-base font-semibold">{pillar.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-xs text-muted-foreground">
        Registry — working name for this platform.
      </footer>
    </main>
  );
}
