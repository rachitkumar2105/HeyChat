import type { SVGProps } from 'react';

/** Hand-drawn icon set for HeyChat: 24px grid, 1.75 stroke, round joins. */
type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconSend = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 12.5 20 4.5l-4.3 15.2-4-6.1-7.2-1.1Z" />
    <path d="m11.7 13.6 3.6-3.9" />
  </Svg>
);
export const IconMic = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
  </Svg>
);
export const IconImage = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4.5 17.5 4.8-4.6 3.2 3 2.4-2.2 4.6 4.3" />
  </Svg>
);
export const IconBack = (p: P) => (
  <Svg {...p}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
  </Svg>
);
export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 5 5" />
  </Svg>
);
export const IconCompose = (p: P) => (
  <Svg {...p}>
    <path d="M12 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V12" />
    <path d="M17.6 3.9a1.6 1.6 0 0 1 2.3 2.3l-7.4 7.4-3 .7.7-3 7.4-7.4Z" />
  </Svg>
);
export const IconSettings = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Svg>
);
export const IconMore = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="5.5" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="18.5" r="1" fill="currentColor" />
  </Svg>
);
export const IconPlay = (p: P) => (
  <Svg {...p}>
    <path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l9.6-6.2a.8.8 0 0 0 0-1.4L9.2 5.1a.8.8 0 0 0-1.2.7Z" fill="currentColor" />
  </Svg>
);
export const IconPause = (p: P) => (
  <Svg {...p}>
    <rect x="7" y="5.5" width="3.4" height="13" rx="1" fill="currentColor" />
    <rect x="13.6" y="5.5" width="3.4" height="13" rx="1" fill="currentColor" />
  </Svg>
);
export const IconStop = (p: P) => (
  <Svg {...p}>
    <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
  </Svg>
);
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 7h15M10 4.5h4M6.5 7l.8 11.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7" />
    <path d="M10 11v5M14 11v5" />
  </Svg>
);
export const IconReply = (p: P) => (
  <Svg {...p}>
    <path d="M9.5 6 4.5 11l5 5" />
    <path d="M4.5 11h9a6 6 0 0 1 6 6v1" />
  </Svg>
);
export const IconCopy = (p: P) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.2" />
    <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </Svg>
);
export const IconEdit = (p: P) => (
  <Svg {...p}>
    <path d="M15.8 4.7a2 2 0 0 1 2.9 2.9L8.4 17.9l-3.9 1 1-3.9L15.8 4.7Z" />
  </Svg>
);
export const IconSmile = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 14.2a4.4 4.4 0 0 0 7 0" />
    <path d="M9.2 9.6h.01M14.8 9.6h.01" strokeWidth={2.4} />
  </Svg>
);
/** Single tick (sent) */
export const IconTick = (p: P) => (
  <Svg {...p} viewBox="0 0 18 12" strokeWidth={1.6}>
    <path d="m2.5 6.3 3.3 3.2L12.5 2.5" />
  </Svg>
);
/** Double tick (delivered / read) */
export const IconTicks = (p: P) => (
  <Svg {...p} viewBox="0 0 18 12" strokeWidth={1.6}>
    <path d="m1.5 6.3 3.3 3.2L11.5 2.5" />
    <path d="m8.4 9.4.3.1 6.8-7" />
  </Svg>
);
export const IconClock = (p: P) => (
  <Svg {...p} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const IconAlert = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.8v5M12 16.2h.01" strokeWidth={2.2} />
  </Svg>
);
export const IconBlock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m6 6 12 12" />
  </Svg>
);
export const IconBroom = (p: P) => (
  <Svg {...p}>
    <path d="m14.5 4 5.5 5.5M17.2 6.8l-5.9 5.9" />
    <path d="M11.3 12.7c-2.5-.6-5 .2-6.3 2.4l-.5.9 4 4 .9-.5c2.2-1.3 3-3.8 2.4-6.3" />
  </Svg>
);
export const IconLogout = (p: P) => (
  <Svg {...p}>
    <path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" />
    <path d="m15 8 4 4-4 4M19 12H9.5" />
  </Svg>
);
export const IconCamera = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 8.5a2 2 0 0 1 2-2h1.8l1.4-2h4.6l1.4 2h1.8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-8Z" />
    <circle cx="12" cy="12.5" r="3.2" />
  </Svg>
);
export const IconArrowDown = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Svg>
);
export const IconRetry = (p: P) => (
  <Svg {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4.5v4h-4" />
  </Svg>
);
export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5l1.5-1.5Z" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </Svg>
);
export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </Svg>
);
export const IconWave = (p: P) => (
  <Svg {...p}>
    <path d="M4 12h1.5M7.5 8.5v7M11 5.5v13M14.5 9v6M18 7v10M21 12h-.5" />
  </Svg>
);

/** The HeyChat mark: two speech shapes overlapping, the inner one a sound wave. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M8 10a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v15a6 6 0 0 1-6 6H22l-8.5 7v-7H14a6 6 0 0 1-6-6V10Z" fill="var(--logo, var(--ink))" />
      <path d="M16 17.5h2.2M20.2 13v9M24.4 10.5v14M28.6 14.5v6M32 17.5h.6" stroke="var(--ochre)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
