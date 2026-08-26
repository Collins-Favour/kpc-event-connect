import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createSpace } from "@/lib/spaces.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Building2, User, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({
    meta: [
      { title: "Create a space — Leepek" },
      { name: "description", content: "Create a workspace for your events, registration desks and attendance data." },
      { property: "og:title", content: "Create a space — Leepek" },
      { property: "og:description", content: "Create a workspace for your events and registration desks." },
    ],
  }),
  component: CreateSpacePage,
});

const types = [
  { value: "INDIVIDUAL", label: "Individual", icon: User, hint: "Just you, running your own events" },
  { value: "ORGANIZATION", label: "Organization", icon: Building2, hint: "A company, school, church or NGO" },
  { value: "TEAM", label: "Team", icon: Users, hint: "A group inside a larger organization" },
] as const;

function CreateSpacePage() {
  const navigate = useNavigate();
  const create = useServerFn(createSpace);
  const [spaceType, setSpaceType] = useState<(typeof types)[number]["value"]>("ORGANIZATION");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const space = await create({
        data: {
          name,
          space_type: spaceType,
          category,
          contact_email: contactEmail,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        },
      });
      toast.success("Space created");
      navigate({ to: "/s/$spaceId", params: { spaceId: space.id }, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the space.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-lg">
        <Link to="/spaces" className="text-sm text-muted-foreground underline underline-offset-4">
          Back to your spaces
        </Link>
        <h1 className="mt-6 text-3xl">Create a space</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You become its super admin. You can invite others afterwards.
        </p>

        <Card className="mt-8 animate-rise">
          <CardContent className="py-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Space type</legend>
                <div className="grid gap-2">
                  {types.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setSpaceType(type.value)}
                      aria-pressed={spaceType === type.value}
                      className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors duration-200 ${
                        spaceType === type.value ? "border-accent bg-accent/10" : "hover:bg-muted"
                      }`}
                    >
                      <type.icon className="size-5 text-accent" />
                      <span>
                        <span className="block text-sm font-medium">{type.label}</span>
                        <span className="block text-xs text-muted-foreground">{type.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="name">Space name</Label>
                <Input
                  id="name"
                  required
                  className="h-11"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category (optional)</Label>
                <Input
                  id="category"
                  className="h-11"
                  placeholder="Conference, school, community…"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Contact email (optional)</Label>
                <Input
                  id="contact"
                  type="email"
                  className="h-11"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>

              <Button type="submit" className="h-11 w-full" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Create space
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
