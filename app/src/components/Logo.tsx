// The brand mark: a radical sign whose bar becomes the top edge of a document
// frame. Drawn to match lucide-react's icon conventions (stroke-based,
// currentColor, 24x24 viewBox) so it drops in anywhere a lucide icon was used.
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="4" width="11" height="13" rx="1.2" />
      <polyline points="3,13 5.5,17 9,4" />
    </svg>
  )
}
