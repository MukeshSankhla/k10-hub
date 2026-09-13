import React from 'react';

export type UserTier = 'unknown' | 'user' | 'author' | 'admin';

interface UserBadgeProps {
  role?: string | null;
  size?: number;
  showLabel?: boolean;
  style?: React.CSSProperties;
}

/**
 * Checks whether an author identifier (name, email, role, or ID) belongs to a platform Administrator.
 */
export function isKnownAdmin(identifier?: {
  name?: string | null;
  email?: string | null;
  role?: string | null;
  id?: string | null;
}): boolean {
  if (!identifier) return false;
  const role = (identifier.role || '').trim().toLowerCase();
  if (role.includes('admin')) return true;

  const email = (identifier.email || '').trim().toLowerCase();
  if (
    email === 'mukeshdiy1@gmail.com' ||
    email === 'admin@k10hub.io' ||
    email === 'mukesh@makerbrains.com'
  ) {
    return true;
  }

  const name = (identifier.name || '').trim().toLowerCase();
  if (
    name === 'mukesh sankhla' ||
    name === 'mukesh admin' ||
    name === 'admin' ||
    name === 'mukesh'
  ) {
    return true;
  }

  return false;
}

/**
 * Normalizes any role string into one of the 4 strict user tiers.
 */
export function normalizeUserTier(role?: string | null): UserTier {
  if (!role) return 'unknown';
  const r = role.trim().toLowerCase();
  if (r.includes('admin')) return 'admin';
  if (r.includes('author') || r.includes('creator') || r.includes('maker') || r.includes('hardware')) return 'author';
  if (r.includes('user') || r.includes('member')) return 'user';
  return 'unknown';
}

/**
 * 4-Tier Verification Tick Mark System:
 * - Unknown: No tick mark (guest visitor).
 * - User: Blue hollow round tick mark (hover text: "User").
 * - Author: Filled blue round tick mark (hover text: "Author").
 * - Admin: Filled red round tick mark (hover text: "Admin").
 */
export default function UserBadge({
  role = 'unknown',
  size = 16,
  showLabel = false,
  style,
}: UserBadgeProps) {
  const normalizedRole = normalizeUserTier(role);

  // Unknown visitor: No tick mark
  if (normalizedRole === 'unknown' || !role) {
    if (showLabel) {
      return (
        <span
          style={{
            fontSize: '11px',
            color: 'var(--color-ink-tertiary)',
            fontWeight: 500,
            ...style,
          }}
        >
          Visitor
        </span>
      );
    }
    return null;
  }

  // 1. User: Blue hollow round tick mark
  if (normalizedRole === 'user') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          verticalAlign: 'middle',
          ...style,
        }}
        title="User"
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          style={{ flexShrink: 0 }}
          aria-label="User"
        >
          {/* Blue hollow circular outline */}
          <circle cx="12" cy="12" r="10" stroke="#0284c7" strokeWidth="2.2" fill="none" />
          {/* Blue inner tick mark */}
          <path
            d="M7.5 12.3L10.7 15.3L16.5 9.5"
            stroke="#0284c7"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {showLabel && (
          <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600 }}>
            User
          </span>
        )}
      </span>
    );
  }

  // 2. Author: Filled blue round tick mark
  if (normalizedRole === 'author') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          verticalAlign: 'middle',
          ...style,
        }}
        title="Author"
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          style={{ flexShrink: 0 }}
          aria-label="Author"
        >
          {/* Filled blue circular background */}
          <circle cx="12" cy="12" r="11" fill="#0284c7" />
          {/* Crisp white checkmark */}
          <path
            d="M7.5 12.2L10.5 15.2L16.5 9.2"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {showLabel && (
          <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700 }}>
            Author
          </span>
        )}
      </span>
    );
  }

  // 3. Admin: Filled red round tick mark
  if (normalizedRole === 'admin') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          verticalAlign: 'middle',
          ...style,
        }}
        title="Admin"
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          style={{ flexShrink: 0 }}
          aria-label="Admin"
        >
          {/* Filled red circular background */}
          <circle cx="12" cy="12" r="11" fill="#dc2626" />
          {/* Crisp white checkmark */}
          <path
            d="M7.5 12.2L10.5 15.2L16.5 9.2"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {showLabel && (
          <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700 }}>
            Admin
          </span>
        )}
      </span>
    );
  }

  return null;
}
