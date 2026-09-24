import React from 'react';

/**
 * Monitor Control's own mark: a rounded monitor outline, a small cursor
 * arrow riding on the screen, and a tiny sparkle for "AI". Original linework,
 * sized to sit next to the other lucide-react rail icons.
 */
export function MonitorControlIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="2.75" y="4" width="18.5" height="12.5" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 20h6M12 16.5V20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M11 8.2 15.2 10.1 13.2 10.9 15.2 12.9 13.9 14.2 12 12.2 11.1 14.4 11 8.2Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path
        d="M18.4 5.4l0.5 1.2 1.2 0.5-1.2 0.5-0.5 1.2-0.5-1.2-1.2-0.5 1.2-0.5z"
        fill="currentColor"
      />
    </svg>
  );
}
