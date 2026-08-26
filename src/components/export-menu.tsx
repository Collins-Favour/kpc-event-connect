import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { exportRegistrations } from "@/lib/reports.functions";
import type { FilterSet } from "@/lib/filters";
import {
  copyTable,
  exportCsv,
  exportPdf,
  exportXlsx,
  flattenRows,
  printRows,
  type ExportRow,
} from "@/lib/export-data";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Clipboard, Download, FileSpreadsheet, FileText, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

type Format = "csv" | "xlsx" | "pdf" | "print" | "copy";

export function ExportMenu({
  spaceId,
  filters,
  title = "Registrations",
}: {
  spaceId: string;
  filters: FilterSet;
  title?: string;
}) {
  const exportFn = useServerFn(exportRegistrations);
  const [busy, setBusy] = useState(false);

  async function run(format: Format) {
    setBusy(true);
    try {
      const result = await exportFn({ data: { spaceId, ...filters } });
      const rows = flattenRows(result.rows as unknown as ExportRow[]);
      if (rows.length === 0) {
        toast.error("No records match these filters.");
        return;
      }
      if (result.truncated) {
        toast.warning("Only the first 20,000 records are included. Narrow your filters for more.");
      }
      const name = `${title.toLowerCase().replace(/\s+/g, "-")}-${new Date()
        .toISOString()
        .slice(0, 10)}`;
      if (format === "csv") exportCsv(rows, name);
      else if (format === "xlsx") await exportXlsx(rows, name);
      else if (format === "pdf") await exportPdf(rows, name, title);
      else if (format === "print") printRows(rows, title);
      else {
        await copyTable(rows);
        toast.success("Copied — paste into Sheets, Excel or Word.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Universal formats</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => run("csv")}>
          <FileText className="size-4" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("xlsx")}>
          <FileSpreadsheet className="size-4" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("pdf")}>
          <FileText className="size-4" /> PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => run("print")}>
          <Printer className="size-4" /> Print view
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("copy")}>
          <Clipboard className="size-4" /> Copy table
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
