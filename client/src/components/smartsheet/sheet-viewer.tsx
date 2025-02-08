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
import { ArrowUpDown, Search, AlignLeft, AlignCenter, AlignRight, ArrowDown, ArrowUp, ArrowUpDown as AlignVerticalCenter } from "lucide-react";
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

type CellAlignment = {
  vertical: 'top' | 'middle' | 'bottom';
  horizontal: 'left' | 'center' | 'right';
};

type SelectionType = 'none' | 'cell' | 'row' | 'column' | 'all';

type Selection = {
  type: SelectionType;
  rowIndices: number[];
  columnIds: string[];
};

export default function SheetViewer({ data }: SheetViewerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    column: string | null;
    direction: "asc" | "desc";
  }>({ column: null, direction: "asc" });
  const [selection, setSelection] = useState<Selection>({
    type: 'none',
    rowIndices: [],
    columnIds: []
  });
  const [cellAlignments, setCellAlignments] = useState<Record<string, CellAlignment>>({});

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

  const handleCellClick = (rowIndex: number, columnId: string, event: React.MouseEvent) => {
    if (event.shiftKey) {
      // Add to existing selection
      setSelection(prev => ({
        type: 'cell',
        rowIndices: Array.from(new Set([...prev.rowIndices, rowIndex])),
        columnIds: Array.from(new Set([...prev.columnIds, columnId]))
      }));
    } else {
      // New single cell selection
      setSelection({
        type: 'cell',
        rowIndices: [rowIndex],
        columnIds: [columnId]
      });
    }
  };

  const handleRowHeaderClick = (rowIndex: number, event: React.MouseEvent) => {
    if (event.shiftKey) {
      setSelection(prev => ({
        type: 'row',
        rowIndices: Array.from(new Set([...prev.rowIndices, rowIndex])),
        columnIds: data.columns.map(col => col.id)
      }));
    } else {
      setSelection({
        type: 'row',
        rowIndices: [rowIndex],
        columnIds: data.columns.map(col => col.id)
      });
    }
  };

  const handleColumnHeaderClick = (columnId: string, event: React.MouseEvent) => {
    if (event.shiftKey) {
      setSelection(prev => ({
        type: 'column',
        rowIndices: Array.from({ length: sortedRows.length }, (_, i) => i),
        columnIds: Array.from(new Set([...prev.columnIds, columnId]))
      }));
    } else {
      setSelection({
        type: 'column',
        rowIndices: Array.from({ length: sortedRows.length }, (_, i) => i),
        columnIds: [columnId]
      });
    }
  };

  const handleSelectAll = () => {
    setSelection({
      type: 'all',
      rowIndices: Array.from({ length: sortedRows.length }, (_, i) => i),
      columnIds: data.columns.map(col => col.id)
    });
  };

  const isCellSelected = (rowIndex: number, columnId: string) => {
    return selection.rowIndices.includes(rowIndex) && selection.columnIds.includes(columnId);
  };

  const setAlignment = (type: 'vertical' | 'horizontal', value: string) => {
    if (selection.type === 'none') return;

    const newAlignments = { ...cellAlignments };
    selection.rowIndices.forEach(rowIndex => {
      selection.columnIds.forEach(columnId => {
        const key = `${rowIndex}-${columnId}`;
        newAlignments[key] = {
          ...newAlignments[key],
          [type]: value as any,
        };
      });
    });

    setCellAlignments(newAlignments);
  };

  const getCellAlignment = (rowIndex: number, columnId: string): CellAlignment => {
    const key = `${rowIndex}-${columnId}`;
    return cellAlignments[key] || { vertical: 'middle', horizontal: 'left' };
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
          {selection.type !== 'none' && (
            <div className="flex items-center gap-2">
              <div className="flex border rounded-md">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAlignment('horizontal', 'left')}
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAlignment('horizontal', 'center')}
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAlignment('horizontal', 'right')}
                >
                  <AlignRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex border rounded-md">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAlignment('vertical', 'top')}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAlignment('vertical', 'middle')}
                >
                  <AlignVerticalCenter className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setAlignment('vertical', 'bottom')}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {sortedRows.length} of {data.totalRows} rows
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <Table>
          <TableHeader className="bg-muted sticky top-0 z-10">
            <TableRow>
              <TableHead 
                className="w-[50px] bg-muted font-medium text-muted-foreground sticky left-0 cursor-pointer hover:bg-accent/50"
                onClick={handleSelectAll}
              >
                #
              </TableHead>
              {data.columns.map((column) => (
                <TableHead 
                  key={column.id} 
                  className="border-x border-border bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={(e) => handleColumnHeaderClick(column.id, e)}
                      className="flex-1 font-medium justify-between px-2"
                    >
                      {column.title}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSort(column.title)}
                    >
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row, rowIndex) => (
              <TableRow 
                key={row.id}
                className="hover:bg-muted/50"
              >
                <TableCell 
                  className="font-medium text-muted-foreground bg-muted sticky left-0 cursor-pointer hover:bg-accent/50"
                  onClick={(e) => handleRowHeaderClick(rowIndex, e)}
                >
                  {rowIndex + 1}
                </TableCell>
                {data.columns.map((column) => {
                  const alignment = getCellAlignment(rowIndex, column.id);
                  const isSelected = isCellSelected(rowIndex, column.id);

                  return (
                    <TableCell
                      key={`${row.id}-${column.id}`}
                      className={`border border-border cursor-pointer ${
                        isSelected ? 'ring-2 ring-primary' : ''
                      }`}
                      style={{
                        textAlign: alignment.horizontal,
                        verticalAlign: alignment.vertical,
                      }}
                      onClick={(e) => handleCellClick(rowIndex, column.id, e)}
                    >
                      {row[column.title]}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </Card>
  );
}