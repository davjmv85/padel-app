import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  className?: string;
}

export function Spinner({ className = 'h-8 w-8' }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className={`animate-spin text-blue-600 ${className}`} />
    </div>
  );
}
