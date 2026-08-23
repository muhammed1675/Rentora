import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Normalizes a Nigerian phone/WhatsApp number to plain international
// digits with no "+", e.g. for wa.me/<digits> links and DB storage.
// Handles the formats people actually type:
//   "08012345678"      -> "2348012345678"  (leading 0, 11 digits)
//   "8012345678"        -> "2348012345678" (no leading 0, 10 digits)
//   "+2348012345678"    -> "2348012345678"
//   "2348012345678"      -> "2348012345678" (already correct)
//   "234 801 234 5678"  -> "2348012345678" (spaces/dashes stripped)
// Returns the input's digits-only form unchanged if it doesn't match any
// of the above shapes, rather than guessing.
export function normalizeNgPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('234') && digits.length === 13) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`;
  if (digits.length === 10 && /^[789]/.test(digits)) return `234${digits}`;
  return digits;
}
