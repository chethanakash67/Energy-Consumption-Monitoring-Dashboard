/**
 * Icon set.
 *
 * Hand-rolled at a consistent 20x20 grid with a 1.6 stroke so the whole app
 * shares one drawing weight — mixing icon libraries is the fastest way to make
 * a dashboard look assembled rather than designed.
 */

type IconProps = { className?: string };

const base = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function IconDashboard({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2.5" y="2.5" width="6.5" height="7.5" rx="1.5" />
      <rect x="11" y="2.5" width="6.5" height="4.5" rx="1.5" />
      <rect x="11" y="9" width="6.5" height="8.5" rx="1.5" />
      <rect x="2.5" y="12" width="6.5" height="5.5" rx="1.5" />
    </svg>
  );
}

export function IconAnalytics({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.8 16.5h14.4" />
      <path d="M5.5 16.5v-4.8" />
      <path d="M9.2 16.5V6.8" />
      <path d="M12.9 16.5v-7.2" />
      <path d="M16.6 16.5V4.2" />
    </svg>
  );
}

export function IconDevices({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2.6" y="4.5" width="14.8" height="11" rx="2" />
      <path d="M6.2 8.2h3.1M6.2 11.5h5.6" />
      <circle cx="14.4" cy="8.4" r="1.1" />
    </svg>
  );
}

export function IconAlerts({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 2.6a4.9 4.9 0 0 0-4.9 4.9c0 3.6-1.3 4.9-1.3 4.9h12.4s-1.3-1.3-1.3-4.9A4.9 4.9 0 0 0 10 2.6Z" />
      <path d="M8.6 15.6a1.7 1.7 0 0 0 2.8 0" />
    </svg>
  );
}

export function IconSettings({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M15.9 12.3a1.3 1.3 0 0 0 .26 1.44l.05.05a1.6 1.6 0 1 1-2.26 2.26l-.05-.05a1.3 1.3 0 0 0-1.44-.26 1.3 1.3 0 0 0-.79 1.19v.13a1.6 1.6 0 0 1-3.2 0v-.07a1.3 1.3 0 0 0-.85-1.19 1.3 1.3 0 0 0-1.44.26l-.05.05a1.6 1.6 0 1 1-2.26-2.26l.05-.05a1.3 1.3 0 0 0 .26-1.44 1.3 1.3 0 0 0-1.19-.79H2.8a1.6 1.6 0 0 1 0-3.2h.07a1.3 1.3 0 0 0 1.19-.85 1.3 1.3 0 0 0-.26-1.44l-.05-.05a1.6 1.6 0 1 1 2.26-2.26l.05.05a1.3 1.3 0 0 0 1.44.26h.06a1.3 1.3 0 0 0 .79-1.19V2.8a1.6 1.6 0 0 1 3.2 0v.07a1.3 1.3 0 0 0 .79 1.19 1.3 1.3 0 0 0 1.44-.26l.05-.05a1.6 1.6 0 1 1 2.26 2.26l-.05.05a1.3 1.3 0 0 0-.26 1.44v.06a1.3 1.3 0 0 0 1.19.79h.13a1.6 1.6 0 0 1 0 3.2h-.07a1.3 1.3 0 0 0-1.19.79Z" />
    </svg>
  );
}

export function IconBolt({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M11 2.5 4.9 11h4.3l-.8 6.5L15 9h-4.3l.8-6.5Z" />
    </svg>
  );
}

export function IconCoins({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <ellipse cx="10" cy="5.4" rx="6.2" ry="2.6" />
      <path d="M3.8 5.4v4.3c0 1.44 2.78 2.6 6.2 2.6s6.2-1.16 6.2-2.6V5.4" />
      <path d="M3.8 9.7v4.3c0 1.44 2.78 2.6 6.2 2.6s6.2-1.16 6.2-2.6V9.7" />
    </svg>
  );
}

export function IconLeaf({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.8 16.2c-1.6-4.6.9-9.5 5.4-11 2.2-.75 5-.9 7.3-.5.5 4-.4 7.5-2.5 9.7-2.3 2.4-6.5 3-10.2 1.8Z" />
      <path d="M4.6 15.4c2.4-3 5.1-5.4 8.4-7.2" />
    </svg>
  );
}

export function IconPulse({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.5 10h3l2-5.5 3.4 11L13.4 10h4.1" />
    </svg>
  );
}

export function IconClock({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="10" r="7.3" />
      <path d="M10 5.8V10l2.8 1.7" />
    </svg>
  );
}

export function IconDownload({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 2.8v9.4" />
      <path d="m6.3 8.9 3.7 3.6 3.7-3.6" />
      <path d="M3.4 15.1v1.1a1.3 1.3 0 0 0 1.3 1.3h10.6a1.3 1.3 0 0 0 1.3-1.3v-1.1" />
    </svg>
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 4.2v11.6M4.2 10h11.6" />
    </svg>
  );
}

export function IconChevronRight({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m7.8 4.8 5 5.2-5 5.2" />
    </svg>
  );
}

export function IconSun({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="10" r="3.6" />
      <path d="M10 1.8v1.6M10 16.6v1.6M3.8 3.8l1.2 1.2M15 15l1.2 1.2M1.8 10h1.6M16.6 10h1.6M3.8 16.2 5 15M15 5l1.2-1.2" />
    </svg>
  );
}

export function IconMoon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M16.4 11.6A6.9 6.9 0 0 1 8.4 3.6a6.9 6.9 0 1 0 8 8Z" />
    </svg>
  );
}

export function IconMenu({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.2 5.6h13.6M3.2 10h13.6M3.2 14.4h13.6" />
    </svg>
  );
}

export function IconLogout({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7.4 17.2H4.6a1.6 1.6 0 0 1-1.6-1.6V4.4a1.6 1.6 0 0 1 1.6-1.6h2.8" />
      <path d="m12.6 13.8 3.8-3.8-3.8-3.8" />
      <path d="M16.4 10H7.2" />
    </svg>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="8.8" cy="8.8" r="5.4" />
      <path d="m12.8 12.8 4 4" />
    </svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m4.5 10.4 3.6 3.6 7.4-8" />
    </svg>
  );
}

export function IconInbox({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.8 11.5h3.6l1.2 2.2h4.8l1.2-2.2h3.6" />
      <path d="M4.6 3.8h10.8l1.8 7.7v3.4a1.6 1.6 0 0 1-1.6 1.6H4.4a1.6 1.6 0 0 1-1.6-1.6v-3.4Z" />
    </svg>
  );
}

export function IconTrash({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.6 5.4h12.8M8 5.4V4a1.2 1.2 0 0 1 1.2-1.2h1.6A1.2 1.2 0 0 1 12 4v1.4" />
      <path d="M15.1 5.4l-.6 10a1.4 1.4 0 0 1-1.4 1.3H6.9a1.4 1.4 0 0 1-1.4-1.3l-.6-10" />
    </svg>
  );
}

export function IconEdit({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M13.4 3.4a1.9 1.9 0 0 1 2.7 2.7L6.8 15.4l-3.6.9.9-3.6Z" />
    </svg>
  );
}

export function IconLocation({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M16.2 8.4c0 4.5-6.2 9-6.2 9s-6.2-4.5-6.2-9a6.2 6.2 0 1 1 12.4 0Z" />
      <circle cx="10" cy="8.4" r="2.1" />
    </svg>
  );
}

export function IconUsers({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M13.6 16.8v-1.5a3 3 0 0 0-3-3H5.4a3 3 0 0 0-3 3v1.5" />
      <circle cx="8" cy="6.2" r="2.9" />
      <path d="M17.6 16.8v-1.5a3 3 0 0 0-2.3-2.9M13.2 3.5a3 3 0 0 1 0 5.6" />
    </svg>
  );
}
