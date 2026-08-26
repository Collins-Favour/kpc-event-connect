import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSetupStatus, runSetup } from "@/lib/kpc.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "System setup — KPC Registration System" },
      {
        name: "description",
        content:
          "One-time protected setup that provisions the two Kagumo People's Church super administrator accounts.",
      },
      { property: "og:title", content: "System setup — KPC Registration System" },
      {
        property: "og:description",
        content: "One-time protected provisioning of KPC super administrator accounts.",
      },
    ],
  }),
  component: SetupPage,
});

type AccountForm = { name: string; email: string; phone: string; password: string };

const emptyAccount = (): AccountForm => ({ name: "", email: "", phone: "", password: "" });

function SetupPage() {
  const navigate = useNavigate();
  const status = useQuery({ queryKey: ["setup-status"], queryFn: () => getSetupStatus() });
  const submitSetup = useServerFn(runSetup);
  const [accounts, setAccounts] = useState<AccountForm[]>([emptyAccount(), emptyAccount()]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status.data?.completed) {
      const timer = setTimeout(() => navigate({ to: "/login", replace: true }), 2500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status.data, navigate]);

  function update(index: number, field: keyof AccountForm, value: string) {
    setAccounts((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (accounts.some((a) => a.password.length < 10)) {
      toast.error("Each password must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await submitSetup({ data: { accounts } });
      toast.success("Super administrator accounts created.");
      navigate({ to: "/login", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Setup failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status.data?.completed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sidebar px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Setup already completed</CardTitle>
            <CardDescription>
              Super administrator accounts exist. This page is now closed. Redirecting to sign in…
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-sidebar px-4 py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 text-center text-sidebar-foreground">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <ShieldCheck className="size-7" />
          </div>
          <h1 className="text-3xl font-semibold">First-time system setup</h1>
          <p className="mt-2 text-sm opacity-80">
            Create the two protected super administrator accounts. This page permanently closes
            once setup is complete.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {accounts.map((account, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {index === 0 ? "Main administration super admin" : "Technical super admin"}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input
                    required
                    value={account.name}
                    onChange={(e) => update(index, "name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    required
                    type="email"
                    value={account.email}
                    onChange={(e) => update(index, "email", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone (optional)</Label>
                  <Input
                    value={account.phone}
                    onChange={(e) => update(index, "phone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password (min 10 characters)</Label>
                  <Input
                    required
                    type="password"
                    value={account.password}
                    onChange={(e) => update(index, "password", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <Button type="submit" className="h-12 w-full text-base" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create super administrators
          </Button>
        </form>
      </div>
    </main>
  );
}
