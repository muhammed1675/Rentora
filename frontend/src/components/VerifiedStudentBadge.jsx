import { ShieldCheck } from 'lucide-react';

// Shown wherever a student's identity is displayed (profile, agent-facing
// viewing requests, reviews). Only rendered for approved students.
export function VerifiedStudentBadge({ verified, className = '', compact = false }) {
  if (!verified) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 ${className}`}
      title="This student's LAUTECH school document and selfie were verified by Rentora"
    >
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
      {compact ? 'Verified' : 'Verified LAUTECH Student'}
    </span>
  );
}

export default VerifiedStudentBadge;
