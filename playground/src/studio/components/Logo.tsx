import { useId } from 'react';

export function LogoMark({ size = 36 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="NexVora PDF Studio logo">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path d="M10 4h20l10 10v28a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="#0B1020" stroke={`url(#${id}-g)`} strokeWidth="2.4" />
      <path d="M30 4v8a2 2 0 0 0 2 2h8" fill="none" stroke={`url(#${id}-g)`} strokeWidth="2.4" />
      <path d="M15 36V20l18 16V20" fill="none" stroke={`url(#${id}-g)`} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <LogoMark />
      {!collapsed && (
        <div className="nx-logo-word nx-label">
          <span className="nx-grad-text">NexVora</span> PDF Studio
          <small>by NexVora Lab&rsquo;s Ofc</small>
        </div>
      )}
    </div>
  );
}
