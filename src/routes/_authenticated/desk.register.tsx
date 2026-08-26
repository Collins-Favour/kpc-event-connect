import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext, listMinistries, registerAttendee } from "@/lib/kpc.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Home, Loader2, UserPlus, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/desk/register")({
  head: () => ({
    meta: [
      { title: "Register attendee — KPC" },
      {
        name: "description",
        content: "Guided attendee registration for Kagumo People's Church events.",
      },
      { property: "og:title", content: "Register attendee — KPC" },
      { property: "og:description", content: "Guided attendee registration for KPC events." },
    ],
  }),
  component: RegisterAttendee,
});

type Step = "type" | "name" | "location" | "ministry" | "gender" | "contact" | "done";
type Form = {
  attendance_type: "HOME" | "GUEST" | null;
  full_name: string;
  location: string;
  ministry_id: string | null;
  gender: "male" | "female" | null;
  is_youth: boolean;
  phone: string;
  email: string;
};

const emptyForm = (): Form => ({
  attendance_type: null,
  full_name: "",
  location: "",
  ministry_id: null,
  gender: null,
  is_youth: false,
  phone: "",
  email: "",
});

function RegisterAttendee() {
  const navigate = useNavigate();
  const fetchContext = useServerFn(getMyContext);
  const fetchMinistries = useServerFn(listMinistries);
  const submit = useServerFn(registerAttendee);

  const context = useQuery({ queryKey: ["my-context"], queryFn: () => fetchContext() });
  const ministries = useQuery({ queryKey: ["ministries"], queryFn: () => fetchMinistries() });

  const [step, setStep] = useState<Step>("type");
  const [form, setForm] = useState<Form>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [duplicate, setDuplicate] = useState<{ full_name: string; registration_number: string } | null>(
    null,
  );
  const [result, setResult] = useState<{ registration_number: string; full_name: string } | null>(
    null,
  );

  const assignment = context.data?.assignment;

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setForm(emptyForm());
    setResult(null);
    setDuplicate(null);
    setStep("type");
  }

  async function finish(confirmDuplicate = false) {
    setSubmitting(true);
    try {
      const response = await submit({
        data: {
          full_name: form.full_name,
          phone: form.phone,
          email: form.email,
          location: form.location,
          attendance_type: form.attendance_type!,
          ministry_id: form.attendance_type === "GUEST" ? form.ministry_id : null,
          gender: form.gender!,
          is_youth: form.is_youth,
          confirm_duplicate: confirmDuplicate,
        },
      });

      if (response.duplicate) {
        setDuplicate(response.match as { full_name: string; registration_number: string });
        return;
      }
      setResult({
        registration_number: response.attendee.registration_number ?? "",
        full_name: response.attendee.full_name,
      });
      setStep("done");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (context.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sidebar px-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              You have no active desk assignment, so registration is unavailable.
            </p>
            <Button variant="outline" onClick={() => navigate({ to: "/desk" })}>
              Back to desk
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-sidebar px-4 py-8 text-sidebar-foreground">
      <div className="mx-auto w-full max-w-lg">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => navigate({ to: "/desk" })}
          >
            <ArrowLeft className="mr-2 size-4" /> Desk
          </Button>
          <p className="text-xs opacity-75">
            {assignment.desk?.code} · {assignment.event?.name}
          </p>
        </div>

        <Card className="mt-6">
          <CardContent className="space-y-6 pt-6">
            {step === "type" && (
              <div className="space-y-5 text-center">
                <div>
                  <h1 className="text-2xl font-semibold text-card-foreground">
                    Kagumo People&apos;s Church
                  </h1>
                  <p className="mt-2 text-muted-foreground">Welcome! Are you:</p>
                </div>
                <div className="grid gap-3">
                  <Button
                    className="h-20 text-lg font-semibold"
                    onClick={() => {
                      set("attendance_type", "HOME");
                      setStep("name");
                    }}
                  >
                    <Home className="mr-2 size-6" /> HOME
                  </Button>
                  <Button
                    variant="outline"
                    className="h-20 text-lg font-semibold"
                    onClick={() => {
                      set("attendance_type", "GUEST");
                      setStep("name");
                    }}
                  >
                    <Users className="mr-2 size-6" /> GUEST
                  </Button>
                </div>
              </div>
            )}

            {step === "name" && (
              <StepShell
                title="What is your full name?"
                onBack={() => setStep("type")}
                onNext={() => setStep("location")}
                nextDisabled={form.full_name.trim().length < 2}
              >
                <Input
                  autoFocus
                  className="h-14 text-lg"
                  value={form.full_name}
                  placeholder="e.g. John Mwangi"
                  onChange={(e) => set("full_name", e.target.value)}
                />
              </StepShell>
            )}

            {step === "location" && (
              <StepShell
                title="Where are you coming from?"
                onBack={() => setStep("name")}
                onNext={() => setStep(form.attendance_type === "GUEST" ? "ministry" : "gender")}
                nextDisabled={form.location.trim().length < 2}
              >
                <Input
                  autoFocus
                  className="h-14 text-lg"
                  value={form.location}
                  placeholder="e.g. Kagumo, Nyeri"
                  onChange={(e) => set("location", e.target.value)}
                />
              </StepShell>
            )}

            {step === "ministry" && (
              <StepShell
                title="Which ministry or church?"
                onBack={() => setStep("location")}
                onNext={() => setStep("gender")}
                nextDisabled={!form.ministry_id}
              >
                <Select
                  value={form.ministry_id ?? ""}
                  onValueChange={(value) => set("ministry_id", value)}
                >
                  <SelectTrigger className="h-14 text-base">
                    <SelectValue placeholder="Select ministry / church" />
                  </SelectTrigger>
                  <SelectContent>
                    {(ministries.data ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </StepShell>
            )}

            {step === "gender" && (
              <StepShell
                title="Gender"
                onBack={() => setStep(form.attendance_type === "GUEST" ? "ministry" : "location")}
                onNext={() => setStep("contact")}
                nextDisabled={!form.gender}
              >
                <RadioGroup
                  value={form.gender ?? ""}
                  onValueChange={(value) => set("gender", value as "male" | "female")}
                  className="grid gap-3"
                >
                  {(["male", "female"] as const).map((value) => (
                    <Label
                      key={value}
                      htmlFor={value}
                      className="flex h-14 cursor-pointer items-center gap-3 rounded-lg border px-4 text-base capitalize has-[:checked]:border-primary has-[:checked]:bg-secondary"
                    >
                      <RadioGroupItem id={value} value={value} />
                      {value}
                    </Label>
                  ))}
                </RadioGroup>

                <Label className="mt-4 flex h-14 cursor-pointer items-center gap-3 rounded-lg border px-4 text-base">
                  <Checkbox
                    checked={form.is_youth}
                    onCheckedChange={(checked) => set("is_youth", checked === true)}
                  />
                  Youth
                </Label>
              </StepShell>
            )}

            {step === "contact" && (
              <StepShell
                title="Contact (optional)"
                onBack={() => setStep("gender")}
                onNext={() => finish(false)}
                nextLabel="Complete registration"
                nextDisabled={submitting}
                loading={submitting}
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      className="h-14 text-lg"
                      inputMode="tel"
                      value={form.phone}
                      placeholder="07XX XXX XXX"
                      onChange={(e) => set("phone", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      className="h-14 text-lg"
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                    />
                  </div>
                </div>

                {duplicate && (
                  <div className="mt-4 space-y-3 rounded-lg border border-accent bg-secondary p-4 text-sm">
                    <p className="text-secondary-foreground">
                      A registration with this phone number already exists for this event:{" "}
                      <strong>{duplicate.full_name}</strong> ({duplicate.registration_number}).
                      Register this person anyway?
                    </p>
                    <Button size="sm" onClick={() => finish(true)} disabled={submitting}>
                      Yes, register anyway
                    </Button>
                  </div>
                )}
              </StepShell>
            )}

            {step === "done" && result && (
              <div className="space-y-6 py-4 text-center">
                <CheckCircle2 className="mx-auto size-14 text-success" />
                <div>
                  <h2 className="text-xl font-semibold text-card-foreground">
                    Registration successful
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{result.full_name}</p>
                </div>
                <div className="rounded-xl bg-secondary py-6">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Registration number
                  </p>
                  <p className="mt-1 text-3xl font-bold text-secondary-foreground">
                    {result.registration_number}
                  </p>
                </div>
                <Button className="h-16 w-full text-base font-semibold" onClick={reset}>
                  <UserPlus className="mr-2 size-5" /> REGISTER NEXT PERSON
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function StepShell({
  title,
  children,
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Continue",
  loading = false,
}: {
  title: string;
  children: React.ReactNode;
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  loading?: boolean;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-card-foreground">{title}</h2>
      {children}
      <div className="flex gap-3">
        <Button variant="outline" className="h-14 flex-1" onClick={onBack}>
          Back
        </Button>
        <Button className="h-14 flex-[2] text-base" onClick={onNext} disabled={nextDisabled}>
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
