import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Search, AlignLeft, AlignCenter, AlignRight, ArrowDown, ArrowUp, AlignJustify, GripVertical, WrapText, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EditableCell } from "./editable-cell";
import { type SheetData } from "@shared/schema";
import { type SheetError } from "@/lib/types";

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

interface ResizableHeaderProps {
  children: React.ReactNode;
  onResize: (width: number) => void;
  width: number;
}

function ResizableHeader({ children, onResize, width }: ResizableHeaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(width);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX);
    setStartWidth(width);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const diff = e.pageX - startX;
      const newWidth = Math.max(100, startWidth + diff);
      onResize(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="flex items-center" style={{ width: `${width}px` }}>
      <div className="flex-1">{children}</div>
      <div
        className="w-2 hover:bg-accent/50 cursor-col-resize"
        onMouseDown={handleMouseDown}
      >
        <GripVertical className="h-4 w-4" />
      </div>
    </div>
  );
}

interface SheetViewerProps {
  data?: SheetData;
  isLoading?: boolean;
  error?: SheetError | null;
  onRetry?: () => void;
}

function LoadingState() {
  return (
    <Card className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="h-6 w-48 bg-muted/50 animate-pulse rounded" />
      </div>
      <div className="flex-1 p-4">
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading sheet data...</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ErrorState({ error, onRetry }: { error: SheetError; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="h-6 w-48 bg-muted/50 animate-pulse rounded" />
      </div>
      <div className="flex-1 p-4">
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4 max-w-md mx-auto p-4">
            <div className="text-destructive">
              <AlertCircle className="h-8 w-8 mx-auto" />
              <p className="mt-2 font-semibold">Error Loading Sheet</p>
            </div>
            <p className="text-muted-foreground">
              {error.code ? `[${error.code}] ` : ''}{error.message}
              {error.statusCode ? ` (${error.statusCode})` : ''}
              {error.details ? (
                <span className="block mt-1 text-sm opacity-80">
                  {typeof error.details === 'string' ? error.details : JSON.stringify(error.details)}
                </span>
              ) : null}
            </p>
            {onRetry && (
              <Button 
                variant="outline" 
                onClick={onRetry}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="h-6 w-48 bg-muted/50 animate-pulse rounded" />
      </div>
      <div className="flex-1 p-4">
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">No sheet data available</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function SheetViewer({ data, isLoading, error, onRetry }: SheetViewerProps): JSX.Element {
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
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    data ? Object.fromEntries(data.columns.map(col => [col.id, 200])) : {}
  );
  const [wrapText, setWrapText] = useState(true);

  console.log('SheetViewer render:', {
    isLoading,
    hasError: !!error,
    hasData: !!data,
    dataDetails: data ? {
      sheetId: data.sheetId,
      sheetName: data.sheetName,
      columnCount: data.columns.length,
      rowCount: data.rows.length
    } : null
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    console.error('SheetViewer error:', error);
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  if (!data) {
    console.warn('SheetViewer: No data available');
    return <EmptyState />;
  }

  // Filter function
  const filteredRows = useMemo(() => {
    console.log(`Filtering ${data.rows.length} rows with search term: "${searchTerm}"`);
    
    if (!searchTerm) {
      return data.rows;
    }
    
    const filtered = data.rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    
    console.log(`Filtered to ${filtered.length} rows`);
    return filtered;
  }, [data.rows, searchTerm]);

  // Sort function
  const sortedRows = useMemo(() => {
    if (!sortConfig.column) {
      console.log(`No sorting applied, using ${filteredRows.length} filtered rows`);
      return filteredRows;
    }

    console.log(`Sorting by column: ${sortConfig.column} (${sortConfig.direction})`);
    
    const sorted = [...filteredRows].sort((a, b) => {
      const aVal = a[sortConfig.column!];
      const bVal = b[sortConfig.column!];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
    
    console.log(`Sorted ${sorted.length} rows`);
    return sorted;
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
      setSelection(prev => ({
        type: 'cell',
        rowIndices: Array.from(new Set([...prev.rowIndices, rowIndex])),
        columnIds: Array.from(new Set([...prev.columnIds, columnId]))
      }));
    } else {
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

  const handleColumnResize = (columnId: string, width: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [columnId]: width
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
                  <AlignJustify className="h-4 w-4" />
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWrapText(!wrapText)}
            className={wrapText ? 'bg-accent/50' : ''}
          >
            <WrapText className="h-4 w-4" />
          </Button>
          <p className="text-sm text-muted-foreground">
            {sortedRows.length} of {data.totalRows} rows
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div className="sheet-view h-full">
          <div className="overflow-auto h-full">
            <div className="inline-block min-w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="sticky left-0 top-0 z-50 w-[50px] bg-background border-r shadow-[1px_0_0_0_hsl(var(--border))]"
                      onClick={handleSelectAll}
                    >
                      #
                    </TableHead>
                    {data.columns.map((column) => (
                      <TableHead
                        key={column.id}
                        className="sticky top-0 z-40 min-w-[200px] bg-background"
                        style={{
                          width: columnWidths[column.id],
                          boxShadow: "0 1px 0 0 hsl(var(--border)), -1px 0 0 0 hsl(var(--border)), 1px 0 0 0 hsl(var(--border))"
                        }}
                      >
                        <ResizableHeader
                          width={columnWidths[column.id]}
                          onResize={(width) => handleColumnResize(column.id, width)}
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
                        </ResizableHeader>
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
                        className="sticky left-0 z-30 font-medium bg-background border-r shadow-[1px_0_0_0_hsl(var(--border))]"
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
                            className={`border min-w-[200px] p-0 ${
                              isSelected ? 'ring-2 ring-primary' : ''
                            }`}
                            style={{
                              width: columnWidths[column.id],
                              textAlign: alignment.horizontal,
                              verticalAlign: alignment.vertical,
                              whiteSpace: wrapText ? 'normal' : 'nowrap',
                            }}
                            onClick={(e) => handleCellClick(rowIndex, column.id, e)}
                          >
                            <EditableCell
                              value={row[column.title]}
                              columnType={column.type}
                              columnId={column.id}
                              rowId={row.id}
                              sheetId={data.sheetId}
                              isEditable={column.isEditable}
                              options={column.options}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
