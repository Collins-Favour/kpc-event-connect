import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Church, ClipboardCheck, ShieldCheck, Gauge } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KPC Registration & Attendance System" },
      {
        name: "description",
        content:
          "Kagumo People's Church registration and attendance platform: multi-desk check-in, live event statistics and secure role-based access.",
      },
      { property: "og:title", content: "KPC Registration & Attendance System" },
      {
        property: "og:description",
        content:
          "Multi-desk church event registration with live statistics and secure role-based access.",
      },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: ClipboardCheck,
    title: "Fast desk registration",
    body: "One question at a time, large controls, and an automatic registration number for every attendee.",
  },
  {
    icon: Gauge,
    title: "Live event insight",
    body: "Every registration records its desk, registrar and exact time so reporting stays accurate forever.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "Registrars only register. Admins manage. Super admins govern. Enforced on the server, not just the screen.",
  },
];

function Index() {
  return (
    <main className="min-h-screen bg-background">
      <section className="bg-sidebar px-4 py-20 text-sidebar-foreground">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Church className="size-8" />
          </div>
          <p className="text-sm uppercase tracking-[0.3em] opacity-70">
            Kagumo People&apos;s Church
          </p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">
            Registration &amp; Attendance Management
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base opacity-85">
            Run every conference, service and gathering from one secure system — multiple
            registration desks, one central database, live statistics.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="h-12 bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/login">Sign in to your desk</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-2xl border bg-card p-6">
              <feature.icon className="size-6 text-accent" />
              <h2 className="mt-4 text-lg font-semibold text-card-foreground">{feature.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
