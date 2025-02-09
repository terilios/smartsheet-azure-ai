import { useEffect } from 'react';
import { Progress } from './progress';
import { useJobStatus } from '@/hooks/use-job-status';
import { Button } from './button';
import { Loader2, XCircle, CheckCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface JobProgressProps {
  jobId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function JobProgress({ jobId, onComplete, onError }: JobProgressProps) {
  const {
    status,
    isConnected,
    progress,
    isComplete,
    isFailed,
    error
  } = useJobStatus(jobId, { onComplete, onError });

  useEffect(() => {
    if (isComplete) {
      onComplete?.();
    }
    if (isFailed && error) {
      onError?.(error);
    }
  }, [isComplete, isFailed, error, onComplete, onError]);

  const handleCancel = async () => {
    try {
      await apiRequest('POST', `/api/jobs/${jobId}/cancel`);
    } catch (error) {
      console.error('Failed to cancel job:', error);
    }
  };

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Connecting...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status.status === 'processing' && (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          )}
          {isComplete && (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
          {isFailed && (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
          <span className="font-medium">
            {status.status === 'queued' && 'Queued'}
            {status.status === 'processing' && 'Processing...'}
            {isComplete && 'Complete'}
            {isFailed && 'Failed'}
          </span>
        </div>
        {status.status === 'processing' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
          >
            Cancel
          </Button>
        )}
      </div>

      {status.status === 'processing' && (
        <div className="space-y-2">
          <Progress value={progress} />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>
              {status.progress.processed} / {status.progress.total} rows
            </span>
            <span>
              {status.progress.failed > 0 && (
                <span className="text-destructive">
                  {status.progress.failed} failed
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {isFailed && error && (
        <div className="text-sm text-destructive">
          {error}
        </div>
      )}

      {!isConnected && (
        <div className="text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
          Reconnecting...
        </div>
      )}
    </div>
  );
}
