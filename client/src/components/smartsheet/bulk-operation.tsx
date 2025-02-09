import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { JobProgress } from '@/components/ui/job-progress';
import { apiRequest } from '@/lib/queryClient';

interface BulkOperationProps {
  sheetId: string;
  columns: Array<{ id: string; title: string }>;
  onComplete?: () => void;
}

type OperationType = 'SUMMARIZE' | 'SCORE_ALIGNMENT' | 'EXTRACT_TERMS';

export function BulkOperation({ sheetId, columns, onComplete }: BulkOperationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<OperationType>('SUMMARIZE');
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [targetColumn, setTargetColumn] = useState<string>('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setError(null);
      
      const response = await apiRequest('POST', '/api/jobs', {
        sheetId,
        sourceColumns,
        targetColumn,
        operation: {
          type: selectedOperation
        }
      });
      
      const data = await response.json();
      if (data.jobId) {
        setJobId(data.jobId);
      } else {
        throw new Error('No job ID returned');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to start operation');
    }
  };

  const handleComplete = () => {
    setJobId(null);
    setIsOpen(false);
    onComplete?.();
  };

  const handleError = (error: string) => {
    setError(error);
    setJobId(null);
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Bulk Operations
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Operation</DialogTitle>
          </DialogHeader>

          {jobId ? (
            <JobProgress
              jobId={jobId}
              onComplete={handleComplete}
              onError={handleError}
            />
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Operation Type</label>
                <Select
                  value={selectedOperation}
                  onValueChange={(value) => setSelectedOperation(value as OperationType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUMMARIZE">Summarize Content</SelectItem>
                    <SelectItem value="SCORE_ALIGNMENT">Score BCH Alignment</SelectItem>
                    <SelectItem value="EXTRACT_TERMS">Extract Key Terms</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Source Columns</label>
                <Select
                  value={sourceColumns[0]}
                  onValueChange={(value) => setSourceColumns([value])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Target Column</label>
                <Select
                  value={targetColumn}
                  onValueChange={setTargetColumn}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns
                      .filter((col) => !sourceColumns.includes(col.id))
                      .map((col) => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <div className="text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedOperation || !sourceColumns.length || !targetColumn}
                >
                  Start Processing
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
