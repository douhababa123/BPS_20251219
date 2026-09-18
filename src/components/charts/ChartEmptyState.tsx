import { BarChart3 } from 'lucide-react';

export function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
      <BarChart3 className="h-8 w-8 text-slate-300" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
}
