import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSpaceFields, listSegments, saveSegment, deleteSegment } from "@/lib/segments.functions";
import { listEvents } from "@/lib/events.functions";
import {
  BUILTIN_FILTER_FIELDS,
  QUICK_RANGES,
  encodeFilterSet,
  opForType,
  type AttendeeFilter,
  type FilterSet,
} from "@/lib/filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Bookmark, Link2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  spaceId: string;
  value: FilterSet;
  onChange: (next: FilterSet) => void;
};

export function AttendeeFilters({ spaceId, value, onChange }: Props) {
  const queryClient = useQueryClient();
  const fieldsFn = useServerFn(listSpaceFields);
  const eventsFn = useServerFn(listEvents);
  const segmentsFn = useServerFn(listSegments);
  const saveFn = useServerFn(saveSegment);
  const deleteFn = useServerFn(deleteSegment);

  const fields = useQuery({
    queryKey: ["space-fields", spaceId],
    queryFn: () => fieldsFn({ data: { spaceId } }),
  });
  const events = useQuery({
    queryKey: ["events", spaceId],
    queryFn: () => eventsFn({ data: { spaceId } }),
  });
  const segments = useQuery({
    queryKey: ["segments", spaceId],
    queryFn: () => segmentsFn({ data: { spaceId } }),
  });

  const [segmentName, setSegmentName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { spaceId, name: segmentName, definition: value } }),
    onSuccess: () => {
      toast.success("Segment saved — reuse it any time.");
      setSegmentName("");
      setSaveOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["segments", spaceId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { spaceId, id } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["segments", spaceId] }),
  });

  const fieldList = useMemo(() => {
    const builtins = BUILTIN_FILTER_FIELDS.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type as string,
      options: [] as string[],
      builtin: true,
    }));
    const custom = (fields.data ?? []).filter(
      (field) => !builtins.some((builtin) => builtin.key === field.key),
    );
    return [...builtins, ...custom];
  }, [fields.data]);
  const labelFor = (key: string) => fieldList.find((f) => f.key === key)?.label ?? key;

  function patch(next: Partial<FilterSet>) {
    onChange({ ...value, ...next });
  }

  function addFilter(key: string) {
    const meta = fieldList.find((f) => f.key === key);
    if (!meta) return;
    if (value.filters.some((f) => f.key === key)) return;
    const filter: AttendeeFilter = {
      key,
      source: meta.builtin ? "builtin" : "custom",
      op: opForType(meta.type),
      values: [],
    };
    patch({ filters: [...value.filters, filter] });
  }

  function updateFilter(key: string, values: string[]) {
    patch({ filters: value.filters.map((f) => (f.key === key ? { ...f, values } : f)) });
  }

  function removeFilter(key: string) {
    patch({ filters: value.filters.filter((f) => f.key !== key) });
  }

  async function shareView() {
    const url = `${window.location.origin}${window.location.pathname}?view=${encodeFilterSet(value)}`;
    await navigator.clipboard.writeText(url);
    toast.success("Shareable link copied to your clipboard.");
  }

  const activeCount = value.filters.length + (value.eventId ? 1 : 0) + (value.search ? 1 : 0);

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search name, phone, email, number…"
            className="h-10 min-w-56 flex-1"
            value={value.search ?? ""}
            onChange={(e) => patch({ search: e.target.value || undefined })}
          />
          <Select
            value={value.eventId ?? "all"}
            onValueChange={(v) => patch({ eventId: v === "all" ? undefined : v })}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {(events.data ?? []).map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10">
                <Plus className="size-4" />
                Add filter
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-2">
              <p className="px-2 py-1 text-xs uppercase tracking-wide text-muted-foreground">
                Filter by field
              </p>
              <div className="max-h-72 overflow-y-auto">
                {fieldList.length === 0 && (
                  <p className="px-2 py-3 text-sm text-muted-foreground">
                    Add fields to a registration form first.
                  </p>
                )}
                {fieldList.map((field) => (
                  <button
                    key={field.key}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-accent"
                    onClick={() => addFilter(field.key)}
                  >
                    <span className="truncate">{field.label}</span>
                    <span className="ml-2 shrink-0 text-[10px] uppercase text-muted-foreground">
                      {field.type}
                    </span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_RANGES.map((range) => (
            <Button
              key={range.id}
              size="sm"
              variant={(value.range ?? "all") === range.id ? "default" : "outline"}
              className="h-8"
              onClick={() => patch({ range: range.id, from: undefined, to: undefined })}
            >
              {range.label}
            </Button>
          ))}
          <Input
            type="date"
            className="h-8 w-36"
            value={value.from?.slice(0, 10) ?? ""}
            onChange={(e) => patch({ from: e.target.value || undefined, range: "all" })}
          />
          <Input
            type="date"
            className="h-8 w-36"
            value={value.to?.slice(0, 10) ?? ""}
            onChange={(e) => patch({ to: e.target.value || undefined, range: "all" })}
          />
        </div>

        {value.filters.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {value.filters.map((filter) => {
              const meta = fieldList.find((f) => f.key === filter.key);
              return (
                <div key={filter.key} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs font-semibold">{labelFor(filter.key)}</Label>
                    <button
                      onClick={() => removeFilter(filter.key)}
                      aria-label={`Remove ${labelFor(filter.key)} filter`}
                      className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  {filter.op === "in" && (
                    <div className="mt-2 max-h-32 space-y-1.5 overflow-y-auto">
                      {(meta?.options.length ? meta.options : ["Yes", "No"]).map((option) => {
                        const checked = filter.values.includes(option);
                        return (
                          <label key={option} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() =>
                                updateFilter(
                                  filter.key,
                                  checked
                                    ? filter.values.filter((v) => v !== option)
                                    : [...filter.values, option],
                                )
                              }
                            />
                            <span className="truncate">{option}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {filter.op === "contains" && (
                    <Input
                      className="mt-2 h-9"
                      placeholder="Contains…"
                      value={filter.values[0] ?? ""}
                      onChange={(e) => updateFilter(filter.key, [e.target.value])}
                    />
                  )}

                  {filter.op === "between" && (
                    <div className="mt-2 flex gap-2">
                      <Input
                        className="h-9"
                        type={meta?.type === "DATE" ? "date" : "number"}
                        placeholder="From"
                        value={filter.values[0] ?? ""}
                        onChange={(e) =>
                          updateFilter(filter.key, [e.target.value, filter.values[1] ?? ""])
                        }
                      />
                      <Input
                        className="h-9"
                        type={meta?.type === "DATE" ? "date" : "number"}
                        placeholder="To"
                        value={filter.values[1] ?? ""}
                        onChange={(e) =>
                          updateFilter(filter.key, [filter.values[0] ?? "", e.target.value])
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Segments</span>
          {(segments.data ?? []).map((segment) => (
            <Badge
              key={segment.id}
              variant="secondary"
              className="group cursor-pointer gap-1 py-1"
              onClick={() => onChange(segment.definition as unknown as FilterSet)}
            >
              {segment.name}
              <button
                aria-label={`Delete ${segment.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  remove.mutate(segment.id);
                }}
                className="opacity-50 transition-opacity duration-150 hover:opacity-100"
              >
                <Trash2 className="size-3" />
              </button>
            </Badge>
          ))}
          {segments.data?.length === 0 && (
            <span className="text-xs text-muted-foreground">None saved yet</span>
          )}

          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={shareView}>
              <Link2 className="size-4" />
              Share view
            </Button>
            <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={activeCount === 0}>
                  <Bookmark className="size-4" />
                  Save segment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save this segment</DialogTitle>
                </DialogHeader>
                <Label htmlFor="segment-name">Name</Label>
                <Input
                  id="segment-name"
                  value={segmentName}
                  placeholder="e.g. Youth — Nakuru"
                  onChange={(e) => setSegmentName(e.target.value)}
                />
                <DialogFooter>
                  <Button onClick={() => save.mutate()} disabled={save.isPending || !segmentName}>
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
