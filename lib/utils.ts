import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatIso8601(dateString: string): string {
  return dateString.includes("T") ? dateString : dateString.replace(/(\d{4}-\d{2}-\d{2})(\d{2}:\d{2}:\d{2})/, "$1T$2Z");
}