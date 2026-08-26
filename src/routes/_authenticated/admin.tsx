import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/kpc.functions";
import {
  assignRegistrarDesk,
  createEvent,
  createRegistrar,
  getAdminOverview,
  upsertDesk,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administration — KPC Registration System" },
      {
        name: "description",
        content:
          "Manage KPC events, registration desks, registrars and desk assignments from one console.",
      },
      { property: "og:title", content: "Administration — KPC Registration System" },
      {
        property: "og:description",
        content: "Manage KPC events, desks, registrars and assignments.",
      },
    ],
  }),
  component: AdminConsole,
});

function AdminConsole() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchContext = useServerFn(getMyContext);
  const fetchOverview = useServerFn(getAdminOverview);

  const context = useQuery({ queryKey: ["my-context"], queryFn: () => fetchContext() });
  const isStaff = context.data?.role === "ADMIN" || context.data?.role === "SUPER_ADMIN";

  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    enabled: !!isStaff,
  });

  const addRegistrar = useServerFn(createRegistrar);
  const assign = useServerFn(assignRegistrarDesk);
  const saveDesk = useServerFn(upsertDesk);
  const addEvent = useServerFn(createEvent);

  const [registrarForm, setRegistrarForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [assignForm, setAssignForm] = useState({ user_id: "", registration_desk_id: "", event_id: "" });
  const [deskForm, setDeskForm] = useState({ name: "", code: "", location: "" });
  const [eventForm, setEventForm] = useState({ name: "", venue: "", start_date: "", end_date: "" });
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      toast.success(message);
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (context.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>
              Administration is restricted to administrators and super administrators.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate({ to: "/desk" })}>
              Back to desk
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const data = overview.data;

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-sidebar px-4 py-6 text-sidebar-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] opacity-70">KPC Administration</p>
            <h1 className="mt-1 text-2xl font-semibold">Operations console</h1>
          </div>
          <Button asChild variant="ghost" className="text-sidebar-foreground hover:bg-sidebar-accent">
            <Link to="/desk">
              <ArrowLeft className="mr-2 size-4" /> Desk
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <Tabs defaultValue="registrars">
          <TabsList>
            <TabsTrigger value="registrars">Registrars</TabsTrigger>
            <TabsTrigger value="desks">Desks</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          <TabsContent value="registrars" className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Create registrar</CardTitle>
                <CardDescription>Registrars can only access the registration desk.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="Full name" value={registrarForm.name} onChange={(v) => setRegistrarForm({ ...registrarForm, name: v })} />
                <Field label="Email" type="email" value={registrarForm.email} onChange={(v) => setRegistrarForm({ ...registrarForm, email: v })} />
                <Field label="Phone" value={registrarForm.phone} onChange={(v) => setRegistrarForm({ ...registrarForm, phone: v })} />
                <Field label="Temporary password" type="password" value={registrarForm.password} onChange={(v) => setRegistrarForm({ ...registrarForm, password: v })} />
                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await addRegistrar({ data: registrarForm });
                      setRegistrarForm({ name: "", email: "", phone: "", password: "" });
                    }, "Registrar created.")
                  }
                >
                  Create registrar
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assign desk</CardTitle>
                <CardDescription>
                  Past registrations always keep the desk used at the time.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Picker
                  label="Registrar"
                  value={assignForm.user_id}
                  onChange={(v) => setAssignForm({ ...assignForm, user_id: v })}
                  options={(data?.registrars ?? []).map((r) => ({ value: r.id, label: `${r.name || r.email}` }))}
                />
                <Picker
                  label="Event"
                  value={assignForm.event_id}
                  onChange={(v) => setAssignForm({ ...assignForm, event_id: v })}
                  options={(data?.events ?? []).map((e) => ({ value: e.id, label: e.name }))}
                />
                <Picker
                  label="Desk"
                  value={assignForm.registration_desk_id}
                  onChange={(v) => setAssignForm({ ...assignForm, registration_desk_id: v })}
                  options={(data?.desks ?? []).map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
                />
                <Button
                  className="w-full"
                  disabled={busy || !assignForm.user_id || !assignForm.event_id || !assignForm.registration_desk_id}
                  onClick={() => run(() => assign({ data: assignForm }), "Registrar assigned.")}
                >
                  Assign
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Registrars</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data?.registrars ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No registrars yet.</p>
                )}
                {(data?.registrars ?? []).map((r) => {
                  const active = (data?.assignments ?? []).find((a) => a.user_id === r.id);
                  return (
                    <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{r.name || r.email}</p>
                        <p className="text-xs text-muted-foreground">{r.email}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="secondary">{r.status}</Badge>
                        <span className="text-muted-foreground">
                          {active ? `${active.desk?.code} · ${active.event?.name}` : "Unassigned"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="desks" className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Create desk</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="Name" value={deskForm.name} onChange={(v) => setDeskForm({ ...deskForm, name: v })} />
                <Field label="Code" value={deskForm.code} onChange={(v) => setDeskForm({ ...deskForm, code: v })} />
                <Field label="Location" value={deskForm.location} onChange={(v) => setDeskForm({ ...deskForm, location: v })} />
                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await saveDesk({ data: deskForm });
                      setDeskForm({ name: "", code: "", location: "" });
                    }, "Desk saved.")
                  }
                >
                  Create desk
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Registration desks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data?.desks ?? []).map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                    <div>
                      <p className="font-medium">
                        {d.code} — {d.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{d.location ?? "—"}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () =>
                            saveDesk({
                              data: {
                                id: d.id,
                                name: d.name,
                                code: d.code,
                                location: d.location ?? "",
                                status: d.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                              },
                            }),
                          "Desk status updated.",
                        )
                      }
                    >
                      {d.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Create event</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="Name" value={eventForm.name} onChange={(v) => setEventForm({ ...eventForm, name: v })} />
                <Field label="Venue" value={eventForm.venue} onChange={(v) => setEventForm({ ...eventForm, venue: v })} />
                <Field label="Start date" type="date" value={eventForm.start_date} onChange={(v) => setEventForm({ ...eventForm, start_date: v })} />
                <Field label="End date" type="date" value={eventForm.end_date} onChange={(v) => setEventForm({ ...eventForm, end_date: v })} />
                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await addEvent({ data: eventForm });
                      setEventForm({ name: "", venue: "", start_date: "", end_date: "" });
                    }, "Event created.")
                  }
                >
                  Create event
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Events</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data?.events ?? []).map((e) => (
                  <div key={e.id} className="rounded-lg border p-3">
                    <p className="font-medium">{e.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.venue ?? "—"} · {e.start_date ?? "no start date"}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Picker({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
