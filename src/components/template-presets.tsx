import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  applyTemplateFields,
  deleteTemplatePreset,
  listTemplatePresets,
  saveTemplatePreset,
} from "@/lib/events.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Copy, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

type EventOption = { id: string; name: string };

/** Reuse a form across events: save it once, apply it anywhere. */
export function TemplatePresets({
  spaceId,
  templateId,
  eventId,
  events,
  onApplied,
}: {
  spaceId: string;
  templateId: string;
  eventId: string;
  events: EventOption[];
  onApplied: () => void;
}) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listTemplatePresets);
  const saveFn = useServerFn(saveTemplatePreset);
  const deleteFn = useServerFn(deleteTemplatePreset);
  const applyFn = useServerFn(applyTemplateFields);

  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  const presets = useQuery({
    queryKey: ["template-presets", spaceId],
    queryFn: () => listFn({ data: { spaceId } }),
  });

  const savePreset = useMutation({
    mutationFn: () => saveFn({ data: { spaceId, name, templateId } }),
    onSuccess: () => {
      toast.success("Saved — reuse this form on any event.");
      setName("");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["template-presets", spaceId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removePreset = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { spaceId, id } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["template-presets", spaceId] }),
  });

  const apply = useMutation({
    mutationFn: (input: { presetId?: string; fromEventId?: string }) =>
      applyFn({ data: { spaceId, templateId, ...input } }),
    onSuccess: (result) => {
      toast.success(`Added ${result.added} field${result.added === 1 ? "" : "s"}.`);
      onApplied();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">Reusable forms</span>

      {(presets.data ?? []).map((preset) => (
        <Badge
          key={preset.id}
          variant="secondary"
          className="cursor-pointer gap-1 py-1"
          onClick={() => apply.mutate({ presetId: preset.id })}
        >
          {preset.name}
          <button
            aria-label={`Delete ${preset.name}`}
            onClick={(e) => {
              e.stopPropagation();
              removePreset.mutate(preset.id);
            }}
            className="opacity-50 transition-opacity duration-150 hover:opacity-100"
          >
            <Trash2 className="size-3" />
          </button>
        </Badge>
      ))}
      {presets.data?.length === 0 && (
        <span className="text-xs text-muted-foreground">None saved yet</span>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Select value="" onValueChange={(value) => apply.mutate({ fromEventId: value })}>
          <SelectTrigger className="h-9 w-52">
            <SelectValue placeholder="Copy fields from event…" />
          </SelectTrigger>
          <SelectContent>
            {events
              .filter((event) => event.id !== eventId)
              .map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  <span className="flex items-center gap-2">
                    <Copy className="size-3.5" />
                    {event.name}
                  </span>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Save className="size-4" />
              Save as reusable
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save this form for reuse</DialogTitle>
              <DialogDescription>
                Apply it to future events in one click, fields and options included.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={name}
              placeholder="e.g. Standard member intake"
              onChange={(e) => setName(e.target.value)}
            />
            <DialogFooter>
              <Button onClick={() => savePreset.mutate()} disabled={!name || savePreset.isPending}>
                Save preset
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
