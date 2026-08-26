import { createFileRoute, Link } from "@tanstack/react-router";
import { AmbientBackground } from "@/components/ambient-background";
import { Button } from "@/components/ui/button";
import { ArrowRight, KeyRound, LayoutGrid, ShieldCheck, Timer } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Registry — Event Registration & Attendance Platform" },
      {
        name: "description",
        content:
          "One workspace for events, registration desks and attendance data — for organizations, teams, schools, conferences and communities.",
      },
      { property: "og:title", content: "Registry — Event Registration & Attendance Platform" },
      {
        property: "og:description",
        content: "Run registration desks, define your own forms and keep every workspace isolated.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="relative min-h-screen bg-background px-6 py-10 lg:py-16">
      <AmbientBackground />
      <div className="mx-auto w-full max-w-6xl">
        <nav className="animate-fade flex items-center justify-between">
          <span className="font-display text-2xl font-bold tracking-tight text-primary">Registry</span>
          <Link
            to="/login"
            className="text-sm font-semibold text-success transition-colors duration-200 hover:text-primary"
          >
            Sign in
          </Link>
        </nav>

        <section className="mt-16 text-center lg:mt-20">
          <span className="animate-pop inline-block rounded-full border border-accent/40 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Event registration platform
          </span>
          <h1 className="animate-rise stagger-1 mx-auto mt-6 max-w-4xl font-display text-4xl font-bold leading-tight text-primary sm:text-5xl md:text-6xl">
            Register everyone <span className="text-success">at the door.</span>
          </h1>
          <p className="animate-rise stagger-2 mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            One workspace for your events, registration desks and attendance data — for
            organizations, teams, schools, conferences and communities alike.
          </p>
          <div className="animate-rise stagger-3 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-14 rounded-xl px-8 text-base font-semibold shadow-[var(--shadow-elegant)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-success"
            >
              <Link to="/join">
                Join a desk
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 rounded-xl border-2 border-primary px-8 text-base font-semibold text-primary transition-transform duration-200 hover:-translate-y-0.5"
            >
              <Link to="/create">Create a space</Link>
            </Button>
          </div>
          <p className="animate-fade stagger-4 mt-5 text-xs text-muted-foreground">
            Joining a desk needs only a token. Creating a space needs an account.
          </p>
        </section>

        <section className="mt-20 grid grid-cols-1 gap-4 md:grid-cols-6">
          <article className="animate-rise stagger-1 hover-lift group relative col-span-1 overflow-hidden rounded-3xl bg-primary p-8 text-primary-foreground md:col-span-4">
            <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-success opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-45" />
            <div className="relative z-10">
              <Timer className="size-7 text-accent" />
              <h2 className="mt-6 font-display text-2xl font-semibold">Built for the queue</h2>
              <p className="mt-3 max-w-md text-sm text-primary-foreground/75">
                One question group at a time, large controls and confirmed saves before the next
                person steps up — designed for speed at the door.
              </p>
            </div>
          </article>

          <article className="animate-rise stagger-2 hover-lift group col-span-1 rounded-3xl border border-primary/10 bg-card p-8 md:col-span-2">
            <div className="flex size-12 items-center justify-center rounded-xl bg-accent/10 transition-transform duration-300 group-hover:scale-110">
              <LayoutGrid className="size-5 text-accent" />
            </div>
            <h2 className="mt-6 font-display text-xl font-semibold text-primary">Forms you define</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Start from name, phone, email and location, then add any field your event needs.
            </p>
          </article>

          <article className="animate-rise stagger-3 hover-lift group col-span-1 rounded-3xl border border-primary/10 bg-card p-8 md:col-span-2">
            <div className="flex size-12 items-center justify-center rounded-xl bg-success/10 transition-transform duration-300 group-hover:scale-110">
              <KeyRound className="size-5 text-success" />
            </div>
            <h2 className="mt-6 font-display text-xl font-semibold text-primary">Desk tokens</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Registration staff enter a short-lived token — no accounts to create or clean up.
            </p>
          </article>

          <article className="animate-rise stagger-4 hover-lift col-span-1 rounded-3xl border-2 border-dashed border-accent/40 bg-accent/5 p-8 transition-colors duration-300 hover:bg-accent/10 md:col-span-4">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <ShieldCheck className="size-7 text-accent" />
                <h2 className="mt-4 font-display text-2xl font-semibold text-primary">
                  Isolated by design
                </h2>
                <p className="mt-3 max-w-sm text-sm text-muted-foreground">
                  Every request is checked against your membership on the server. Workspaces never
                  see each other.
                </p>
              </div>
              <div className="flex -space-x-3">
                <span className="size-10 rounded-full border-2 border-background bg-primary" />
                <span className="size-10 rounded-full border-2 border-background bg-success" />
                <span className="size-10 rounded-full border-2 border-background bg-accent" />
              </div>
            </div>
          </article>
        </section>

        <footer className="mt-16 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
            Registry — working name for this platform
          </p>
        </footer>
      </div>
    </main>
  );
}
