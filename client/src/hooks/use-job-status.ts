import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';

interface JobStatus {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: {
    processed: number;
    total: number;
    failed: number;
  };
  error?: string;
}

interface UseJobStatusOptions {
  onComplete?: (status: JobStatus) => void;
  onError?: (error: string) => void;
}

export function useJobStatus(jobId: string | null, options: UseJobStatusOptions = {}) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (!jobId) return;

    const ws = new WebSocket(`ws://localhost:3000`);
    
    ws.onopen = () => {
      setIsConnected(true);
      // Subscribe to job updates
      ws.send(JSON.stringify({
        type: 'subscribe',
        jobId
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status' && data.jobId === jobId) {
          setStatus(data.status);

          // Handle completion
          if (data.status.status === 'completed') {
            options.onComplete?.(data.status);
            toast({
              title: 'Processing Complete',
              description: 'The sheet has been updated successfully.'
            });
          }

          // Handle failure
          if (data.status.status === 'failed') {
            const error = data.status.error || 'An unknown error occurred';
            options.onError?.(error);
            toast({
              title: 'Processing Failed',
              description: error,
              variant: 'destructive'
            });
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to status updates.',
        variant: 'destructive'
      });
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Attempt to reconnect after a delay
      setTimeout(connect, 5000);
    };

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, [jobId, options.onComplete, options.onError, toast]);

  useEffect(() => {
    const cleanup = connect();
    return () => cleanup?.();
  }, [connect]);

  const getProgressPercentage = useCallback(() => {
    if (!status?.progress.total) return 0;
    return Math.round((status.progress.processed / status.progress.total) * 100);
  }, [status]);

  return {
    status,
    isConnected,
    progress: getProgressPercentage(),
    isComplete: status?.status === 'completed',
    isFailed: status?.status === 'failed',
    error: status?.error
  };
}
