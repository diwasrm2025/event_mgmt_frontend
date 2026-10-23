"use client";
import { Loader } from './Loader';
import { LoadingWords } from './LoadingWords';
export function ProgressLoader({ label = 'Loading', compact = false }: { label?: string; compact?: boolean }) {
 return <div className={compact ? 'progress-loader compact' : 'progress-loader'} role="status" aria-live="polite"><Loader size={compact ? 20 : 32} /><LoadingWords label={label} /></div>;
}
