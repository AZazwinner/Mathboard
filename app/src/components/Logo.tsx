


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
