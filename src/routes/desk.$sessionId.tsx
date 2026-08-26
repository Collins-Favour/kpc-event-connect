import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  endDeskSession,
  getSessionContext,
  submitRegistration,
} from "@/lib/registration.functions";
import { clearDeskSession, readDeskSession } from "@/lib/desk-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, LogOut } from "lucide-react";

export const Route = createFileRoute("/desk/$sessionId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Registration desk — Leepek" },
      { name: "description", content: "Register attendees at your event registration desk." },
      { property: "og:title", content: "Registration desk — Leepek" },
      { property: "og:description", content: "Register attendees at your event desk." },
    ],
  }),
  component: DeskPage,
});

type FieldValue = string | string[] | boolean;

function DeskPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const context = useServerFn(getSessionContext);
  const submit = useServerFn(submitRegistration);
  const end = useServerFn(endDeskSession);

  const [secret, setSecret] = useState<string | null>(null);
  useEffect(() => {
    const stored = readDeskSession(sessionId);
    if (!stored) {
      navigate({ to: "/join", replace: true });
      return;
    }
    setSecret(stored);
  }, [sessionId, navigate]);

  const query = useQuery({
    queryKey: ["desk-session", sessionId],
    enabled: Boolean(secret),
    queryFn: () => context({ data: { sessionId, secret: secret! } }),
    retry: false,
  });

  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{
    full_name: string;
    registration_number: string;
  } | null>(null);
  const [done, setDone] = useState<{ registration_number: string; full_name: string } | null>(null);
  const [count, setCount] = useState(0);

  const fields = useMemo(() => query.data?.fields ?? [], [query.data]);
  const groups = useMemo(() => {
    const chunks: (typeof fields)[] = [];
    for (let i = 0; i < fields.length; i += 3) chunks.push(fields.slice(i, i + 3));
    return chunks;
  }, [fields]);

  useEffect(() => {
    if (query.data) setCount(query.data.registeredHere);
  }, [query.data]);

  if (query.isError) {
    return (
      <Centered>
        <h1 className="text-xl">This desk session is no longer valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {query.error instanceof Error
            ? query.error.message
            : "Ask your organiser for a new token."}
        </p>
        <Button className="mt-6" onClick={() => navigate({ to: "/join" })}>
          Enter a new token
        </Button>
      </Centered>
    );
  }

  if (!secret || query.isLoading || !query.data) {
    return (
      <Centered>
        <Skeleton className="h-8 w-52" />
        <Skeleton className="mt-4 h-40 w-full max-w-md" />
      </Centered>
    );
  }

  const data = query.data;
  const group = groups[step] ?? [];
  const isLast = step === groups.length - 1;

  function setValue(key: string, value: FieldValue) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function groupIsValid() {
    return group.every((field) => {
      if (!field.required) return true;
      const value = values[field.field_key];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "boolean") return value;
      return Boolean(value && String(value).trim());
    });
  }

  async function save(confirmDuplicate = false) {
    setBusy(true);
    setError(null);
    try {
      const result = await submit({
        data: { sessionId, secret: secret!, values, confirmDuplicate },
      });
      if (result.duplicate) {
        setDuplicate(result.match);
        setBusy(false);
        return;
      }
      setDuplicate(null);
      setDone(result.registration);
      setCount((c) => c + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Check your connection.");
    }
    setBusy(false);
  }

  function next() {
    setValues({});
    setStep(0);
    setDone(null);
    setDuplicate(null);
    setError(null);
  }

  async function finish() {
    await end({ data: { sessionId, secret: secret! } }).catch(() => undefined);
    clearDeskSession(sessionId);
    toast.success("Desk session closed");
    navigate({ to: "/join", replace: true });
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{data.event}</p>
            <p className="truncate text-xs opacity-75">
              {data.space} · {data.desk} ({data.deskCode})
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{count} registered</Badge>
            <Button size="icon" variant="ghost" onClick={finish} aria-label="End desk session">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-8">
        {done ? (
          <Card className="animate-pop">
            <CardContent className="py-12 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success text-success-foreground">
                <Check className="size-6" />
              </div>
              <p className="mt-6 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Registration number
              </p>
              <p className="mt-2 font-mono text-3xl font-semibold">{done.registration_number}</p>
              <p className="mt-2 text-sm text-muted-foreground">{done.full_name} is registered.</p>
              <Button className="mt-8 h-12 w-full text-base" onClick={next}>
                Register next person
                <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-2" aria-hidden>
              {groups.map((_, index) => (
                <span
                  key={index}
                  className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                    index <= step ? "bg-accent" : "bg-muted"
                  }`}
                />
              ))}
            </div>

            <Card className="animate-rise" key={step}>
              <CardContent className="space-y-6 py-8">
                {group.map((field) => {
                  const options = Array.isArray(field.options) ? (field.options as string[]) : [];
                  const value = values[field.field_key];
                  return (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={field.id} className="text-base">
                        {field.label}
                        {field.required ? <span className="text-destructive"> *</span> : null}
                      </Label>
                      {field.help_text && (
                        <p className="text-xs text-muted-foreground">{field.help_text}</p>
                      )}

                      {["TEXT", "EMAIL", "PHONE", "NUMBER", "DATE"].includes(field.field_type) && (
                        <Input
                          id={field.id}
                          className="h-12 text-base"
                          type={
                            field.field_type === "EMAIL"
                              ? "email"
                              : field.field_type === "PHONE"
                                ? "tel"
                                : field.field_type === "NUMBER"
                                  ? "number"
                                  : field.field_type === "DATE"
                                    ? "date"
                                    : "text"
                          }
                          value={typeof value === "string" ? value : ""}
                          onChange={(e) => setValue(field.field_key, e.target.value)}
                        />
                      )}

                      {field.field_type === "BOOLEAN" && (
                        <div
                          className="grid grid-cols-2 gap-2"
                          role="group"
                          aria-labelledby={field.id}
                        >
                          {["Yes", "No"].map((option) => (
                            <button
                              key={option}
                              type="button"
                              aria-pressed={value === option}
                              onClick={() => setValue(field.field_key, option)}
                              className={`h-12 rounded-lg border text-base font-medium transition-colors duration-200 ${
                                value === option
                                  ? "border-accent bg-accent text-accent-foreground"
                                  : "hover:bg-muted"
                              }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}

                      {field.field_type === "CHECKBOX" && (
                        <label className="flex h-12 items-center gap-3 rounded-lg border px-4">
                          <Checkbox
                            id={field.id}
                            checked={value === true}
                            onCheckedChange={(checked) =>
                              setValue(field.field_key, checked === true)
                            }
                          />
                          <span className="text-sm">Yes</span>
                        </label>
                      )}

                      {field.field_type === "RADIO" && (
                        <RadioGroup
                          value={typeof value === "string" ? value : ""}
                          onValueChange={(next) => setValue(field.field_key, next)}
                          className="grid gap-2"
                        >
                          {options.map((option) => (
                            <label
                              key={option}
                              className="flex h-12 items-center gap-3 rounded-lg border px-4"
                            >
                              <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                              <span className="text-sm">{option}</span>
                            </label>
                          ))}
                        </RadioGroup>
                      )}

                      {field.field_type === "SELECT" && (
                        <Select
                          value={typeof value === "string" ? value : ""}
                          onValueChange={(next) => setValue(field.field_key, next)}
                        >
                          <SelectTrigger className="h-12" id={field.id}>
                            <SelectValue placeholder="Select an option" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {field.field_type === "MULTISELECT" && (
                        <div className="grid gap-2">
                          {options.map((option) => {
                            const list = Array.isArray(value) ? value : [];
                            return (
                              <label
                                key={option}
                                className="flex h-12 items-center gap-3 rounded-lg border px-4"
                              >
                                <Checkbox
                                  checked={list.includes(option)}
                                  onCheckedChange={(checked) =>
                                    setValue(
                                      field.field_key,
                                      checked === true
                                        ? [...list, option]
                                        : list.filter((item) => item !== option),
                                    )
                                  }
                                />
                                <span className="text-sm">{option}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {duplicate && (
                  <div className="animate-fade rounded-lg border border-accent bg-accent/10 p-4 text-sm">
                    <p className="font-medium">Possible duplicate</p>
                    <p className="mt-1 text-muted-foreground">
                      {duplicate.full_name} ({duplicate.registration_number}) already used this
                      phone number at this event.
                    </p>
                    <Button className="mt-3" size="sm" onClick={() => save(true)} disabled={busy}>
                      Register anyway
                    </Button>
                  </div>
                )}

                {error && (
                  <p className="animate-fade text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  {step > 0 && (
                    <Button
                      variant="outline"
                      className="h-12"
                      onClick={() => setStep((s) => s - 1)}
                      disabled={busy}
                    >
                      <ArrowLeft className="size-4" />
                      Back
                    </Button>
                  )}
                  <Button
                    className="h-12 flex-1 text-base"
                    disabled={busy || !groupIsValid()}
                    onClick={() => (isLast ? save() : setStep((s) => s + 1))}
                  >
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    {isLast ? "Save registration" : "Continue"}
                    {!isLast && <ArrowRight className="size-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-6 text-center">
      {children}
    </main>
  );
}
