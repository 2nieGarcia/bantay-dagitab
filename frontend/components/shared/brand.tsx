'use client';

import Link from 'next/link';
import { useLang } from '@/lib/i18n';

export function BrandMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden
      className={className}
      role="presentation"
    >
      <rect
        x="2.5"
        y="2.5"
        width="35"
        height="35"
        rx="6"
        fill="var(--color-surface)"
        stroke="var(--color-ink)"
        strokeWidth="1.5"
      />
      <line x1="8" y1="26" x2="32" y2="26" stroke="var(--color-ink)" strokeWidth="1.25" strokeLinecap="round" />
      <path
        d="M8 26 L14 24 L18 16 L22 22 L26 13 L32 26"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="26" cy="13" r="1.8" fill="var(--color-accent)" />
    </svg>
  );
}

export function Brand({
  href = '/',
  showTagline = false,
  className = '',
  size = 'md',
}: {
  href?: string | null;
  showTagline?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const { t } = useLang();
  const markSize = size === 'sm' ? 22 : size === 'lg' ? 34 : 28;
  const wordmarkClass =
    size === 'sm'
      ? 'text-base'
      : size === 'lg'
      ? 'text-2xl'
      : 'text-lg';

  const inner = (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <BrandMark size={markSize} />
      <span className="leading-none">
        <span className={`font-display font-medium text-ink tracking-tight block ${wordmarkClass}`}>
          {t('brand.name')}
        </span>
        {showTagline && (
          <span className="block text-xs text-ink-3 mt-1.5 leading-tight">
            {t('brand.tagline')}
          </span>
        )}
      </span>
    </span>
  );

  if (href === null) return inner;
  return (
    <Link href={href} className="inline-flex group">
      {inner}
    </Link>
  );
}
