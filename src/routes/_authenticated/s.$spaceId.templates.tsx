import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listEvents } from "@/lib/events.functions";
import {
  deleteTemplateField,
  getTemplate,
  reorderTemplateFields,
  upsertTemplateField,
} from "@/lib/events.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/s/$spaceId/templates")({
  head: () => ({
    meta: [
      { title: "Registration templates — Leepek" },
      { name: "description", content: "Design the registration form for each event with custom fields." },
      { property: "og:title", content: "Registration templates — Leepek" },
      { property: "og:description", content: "Design custom registration forms for your events." },
    ],
  }),
  component: TemplatesPage,
});

const FIELD_TYPES = [
  { value: "TEXT", label: "Text" },
  { value: "NUMBER", label: "Number" },
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone" },
  { value: "DATE", label: "Date" },
  { value: "BOOLEAN", label: "Yes / No" },
  { value: "SELECT", label: "Single select" },
  { value: "MULTISELECT", label: "Multiple select" },
  { value: "CHECKBOX", label: "Checkbox" },
  { value: "RADIO", label: "Choice buttons" },
] as const;
type FieldType = (typeof FIELD_TYPES)[number]["value"];

/** One-click starters for the questions almost every event asks. */
const PRESETS = [
  {
    name: "Gender",
    label: "Gender",
    field_key: "gender",
    field_type: "RADIO" as FieldType,
    optionsText: "Male\nFemale",
  },
  {
    name: "Yes / No question",
    label: "First time attending?",
    field_key: "first_time",
    field_type: "BOOLEAN" as FieldType,
    optionsText: "",
  },
  {
    name: "Age group",
    label: "Age group",
    field_key: "age_group",
    field_type: "SELECT" as FieldType,
    optionsText: "Under 18\n18-24\n25-34\n35-49\n50+",
  },
];


function TemplatesPage() {
  const { spaceId } = Route.useParams();
  const queryClient = useQueryClient();
  const eventsFn = useServerFn(listEvents);
  const templateFn = useServerFn(getTemplate);
  const upsertFn = useServerFn(upsertTemplateField);
  const deleteFn = useServerFn(deleteTemplateField);
  const reorderFn = useServerFn(reorderTemplateFields);

  const events = useQuery({ queryKey: ["events", spaceId], queryFn: () => eventsFn({ data: { spaceId } }) });
  const [eventId, setEventId] = useState<string | undefined>();
  const activeEvent = eventId ?? events.data?.[0]?.id;

  const template = useQuery({
    queryKey: ["template", spaceId, activeEvent],
    enabled: Boolean(activeEvent),
    queryFn: () => templateFn({ data: { spaceId, eventId: activeEvent! } }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | undefined>();
  const [form, setForm] = useState({
    label: "",
    field_key: "",
    field_type: "TEXT" as FieldType,
    required: false,
    help_text: "",
    optionsText: "",
    active: true,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["template", spaceId, activeEvent] });

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          spaceId,
          templateId: template.data!.id,
          id: editing,
          label: form.label,
          field_key: form.field_key,
          field_type: form.field_type,
          required: form.required,
          help_text: form.help_text,
          active: form.active,
          options: form.optionsText
            .split("\n")
            .map((o) => o.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: () => {
      toast.success("Field saved");
      setOpen(false);
      invalidate();
    },
    onError: (error: unknown) =>
      toast.error(friendlyError(error, "Could not save the field.")),
  });

  const remove = useMutation({
    mutationFn: (fieldId: string) => deleteFn({ data: { spaceId, fieldId } }),
    onSuccess: () => {
      toast.success("Field removed");
      invalidate();
    },
    onError: (error: unknown) =>
      toast.error(friendlyError(error, "Could not remove the field.")),
  });

  const reorder = useMutation({
    mutationFn: (order: string[]) => reorderFn({ data: { spaceId, order } }),
    onSuccess: invalidate,
  });

  function move(index: number, direction: -1 | 1) {
    const fields = template.data?.fields ?? [];
    const next = [...fields];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    reorder.mutate(next.map((f) => f.id));
  }

  const needsOptions = ["SELECT", "MULTISELECT", "RADIO"].includes(form.field_type);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Registration template</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The form your desks fill in. Core fields stay; add anything else you need.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={activeEvent ?? ""} onValueChange={setEventId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Choose an event" />
            </SelectTrigger>
            <SelectContent>
              {(events.data ?? []).map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={!template.data}
            onClick={() => {
              setEditing(undefined);
              setForm({
                label: "",
                field_key: "",
                field_type: "TEXT",
                required: false,
                help_text: "",
                optionsText: "",
                active: true,
              });
              setOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add field
          </Button>
        </div>
      </header>

      {template.data && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Quick add:</span>
          {PRESETS.map((preset) => (
            <Button
              key={preset.name}
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(undefined);
                setForm({
                  label: preset.label,
                  field_key: preset.field_key,
                  field_type: preset.field_type,
                  required: false,
                  help_text: "",
                  optionsText: preset.optionsText,
                  active: true,
                });
                setOpen(true);
              }}
            >
              <Plus className="size-3.5" />
              {preset.name}
            </Button>
          ))}
        </div>
      )}


      {!activeEvent && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Create an event first — its template is generated automatically.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(template.data?.fields ?? []).map((field, index) => (
          <Card key={field.id} className="animate-rise">
            <CardContent className="flex flex-wrap items-center gap-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{field.label}</span>
                  {field.is_primary && <Badge variant="secondary">Core</Badge>}
                  {field.required && <Badge>Required</Badge>}
                  {!field.active && <Badge variant="outline">Hidden</Badge>}
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {field.field_key} · {field.field_type}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => move(index, -1)} aria-label="Move up">
                  <ArrowUp className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => move(index, 1)} aria-label="Move down">
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(field.id);
                    setForm({
                      label: field.label,
                      field_key: field.field_key,
                      field_type: field.field_type as FieldType,
                      required: field.required,
                      help_text: field.help_text ?? "",
                      optionsText: Array.isArray(field.options)
                        ? (field.options as string[]).join("\n")
                        : "",
                      active: field.active,
                    });
                    setOpen(true);
                  }}
                >
                  Edit
                </Button>
                {!field.is_primary && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove.mutate(field.id)}
                    aria-label="Delete field"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit field" : "Add field"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="field-label">Label</Label>
              <Input
                id="field-label"
                value={form.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    label,
                    field_key:
                      editing || prev.field_key
                        ? prev.field_key
                        : label
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "_")
                            .replace(/^_+|_+$/g, "")
                            .slice(0, 40),
                  }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="field-key">Key</Label>
              <Input
                id="field-key"
                className="font-mono"
                disabled={Boolean(editing)}
                value={form.field_key}
                onChange={(e) => setForm({ ...form, field_key: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.field_type}
                onValueChange={(value) => setForm({ ...form, field_type: value as FieldType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}

                </SelectContent>
              </Select>
            </div>
            {needsOptions && (
              <div className="space-y-2">
                <Label htmlFor="field-options">Options (one per line)</Label>
                <textarea
                  id="field-options"
                  rows={4}
                  className="w-full rounded-md border bg-background p-3 text-sm"
                  value={form.optionsText}
                  onChange={(e) => setForm({ ...form, optionsText: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="field-help">Helper text</Label>
              <Input
                id="field-help"
                value={form.help_text}
                onChange={(e) => setForm({ ...form, help_text: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="field-required">Required</Label>
              <Switch
                id="field-required"
                checked={form.required}
                onCheckedChange={(checked) => setForm({ ...form, required: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="field-active">Shown on the form</Label>
              <Switch
                id="field-active"
                checked={form.active}
                onCheckedChange={(checked) => setForm({ ...form, active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" />}
              Save field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
