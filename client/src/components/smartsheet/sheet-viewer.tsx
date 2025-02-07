import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Column {
  id: string;
  title: string;
  type: string;
  index: number;
}

interface SheetData {
  columns: Column[];
  rows: Record<string, any>[];
  sheetName: string;
  totalRows: number;
}

interface SheetViewerProps {
  data: SheetData;
}

export default function SheetViewer({ data }: SheetViewerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    column: string | null;
    direction: "asc" | "desc";
  }>({ column: null, direction: "asc" });
  
  // Filter function
  const filteredRows = useMemo(() => {
    return data.rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data.rows, searchTerm]);

  // Sort function
  const sortedRows = useMemo(() => {
    if (!sortConfig.column) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const aVal = a[sortConfig.column!];
      const bVal = b[sortConfig.column!];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [filteredRows, sortConfig]);

  const handleSort = (columnTitle: string) => {
    setSortConfig((current) => ({
      column: columnTitle,
      direction:
        current.column === columnTitle && current.direction === "asc"
          ? "desc"
          : "asc",
    }));
  };

  return (
    <Card className="flex flex-col h-full">
      <div className="p-4 border-b space-y-4">
        <h2 className="text-2xl font-bold">{data.sheetName}</h2>
        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search all columns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {sortedRows.length} of {data.totalRows} rows
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              {data.columns.map((column) => (
                <TableHead key={column.id}>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort(column.title)}
                    className="flex items-center gap-2"
                  >
                    {column.title}
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => (
              <TableRow key={row.id}>
                {data.columns.map((column) => (
                  <TableCell key={`${row.id}-${column.id}`}>
                    {row[column.title]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </Card>
  );
}
