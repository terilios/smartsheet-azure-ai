import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  /**
   * The message to display while loading
   */
  message?: string;
  
  /**
   * The size of the loading spinner
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Whether to show a full-page loading state
   */
  fullPage?: boolean;
  
  /**
   * Whether to show a transparent overlay
   */
  overlay?: boolean;
  
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Loading state component with customizable appearance
 */
export function LoadingState({
  message = 'Loading...',
  size = 'md',
  fullPage = false,
  overlay = false,
  className = '',
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };
  
  const containerClasses = fullPage
    ? 'fixed inset-0 flex items-center justify-center z-50'
    : 'flex items-center justify-center p-4';
    
  const overlayClasses = overlay
    ? 'bg-background/80 backdrop-blur-sm'
    : '';
    
  return (
    <div className={`${containerClasses} ${overlayClasses} ${className}`}>
      <div className="flex flex-col items-center space-y-2">
        <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Skeleton loading component for content that's still loading
 */
export function SkeletonLoader({
  className = '',
  count = 1,
  height = '1rem',
  width = '100%',
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse bg-muted rounded ${className}`}
          style={{ height, width }}
        />
      ))}
    </>
  );
}

/**
 * Loading indicator for inline use
 */
export function InlineLoading({ className = '' }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <Loader2 className="w-3 h-3 animate-spin mr-2" />
      <span className="text-xs text-muted-foreground">Loading...</span>
    </span>
  );
}

/**
 * Progress indicator for operations with known progress
 */
export function ProgressLoading({
  progress,
  message,
  className = '',
}: {
  progress: number;
  message?: string;
  className?: string;
}) {
  // Ensure progress is between 0 and 100
  const normalizedProgress = Math.max(0, Math.min(100, progress));
  
  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{message || 'Loading...'}</span>
        <span>{normalizedProgress.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${normalizedProgress}%` }}
        />
      </div>
    </div>
  );
}