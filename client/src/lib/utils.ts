import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function parseCurrencyString(value: string): number {
  const clean = value.replace(/[,$\s]/g, "");
  if (clean.endsWith("M")) return parseFloat(clean) * 1_000_000;
  if (clean.endsWith("K")) return parseFloat(clean) * 1_000;
  if (clean.endsWith("B")) return parseFloat(clean) * 1_000_000_000;
  return parseFloat(clean) || 0;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
