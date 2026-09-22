import type { Screen } from '@/src/cdrms/types';

export type RoleUser = {
  name?: string | null;
  userType?: string | null;
  role?: string | null;
  roleName?: string | null;
};

export type AppRole = 'engineer' | 'zc' | 'cao' | 'super_admin' | 'unknown';

export function roleBlob(user: RoleUser | null | undefined): string {
  if (!user) return '';
  return `${user.userType || ''} ${user.role || ''} ${user.roleName || ''}`.toLowerCase();
}

export function resolveAppRole(user: RoleUser | null | undefined): AppRole {
  const r = roleBlob(user);
  if (!r.trim()) return 'unknown';
  if (r.includes('super_admin')) return 'super_admin';
  if (r.includes('zonal_commissioner') || r.includes('zonal') || /\bzc\b/.test(r)) {
    return 'zc';
  }
  if (r.includes('cao')) return 'cao';
  if (r.includes('engineer')) return 'engineer';
  return 'unknown';
}

export function isMobileAllowedRole(user: RoleUser | null | undefined): boolean {
  const role = resolveAppRole(user);
  return role === 'engineer' || role === 'zc' || role === 'cao' || role === 'super_admin';
}

export function homeScreenForRole(user: RoleUser | null | undefined): Screen {
  const role = resolveAppRole(user);
  if (role === 'zc') return 'zc_home';
  if (role === 'cao' || role === 'super_admin') return 'cao_home';
  return 'dashboard';
}

/**
 * Geo validation / live location gate is engineer-only.
 * ZC and CAO skip permission + geo and go straight to their home.
 */
export function needsGeoValidation(user: RoleUser | null | undefined): boolean {
  return resolveAppRole(user) === 'engineer';
}

export function displayName(user: RoleUser | null | undefined): string {
  if (!user?.name?.trim()) return 'Officer';
  return user.name.trim();
}

const ROLE_ACRONYMS = new Set(['cao', 'zc', 'bda', 'pwd', 'ae', 'je']);

function titleCaseRoleWords(raw: string): string {
  return String(raw)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (ROLE_ACRONYMS.has(lower)) return lower.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/** Canonical role label shown in headers, profile, and menus. */
export function roleDisplayTitle(user: RoleUser | null | undefined): string {
  switch (resolveAppRole(user)) {
    case 'engineer':
      return 'Engineer';
    case 'zc':
      return 'Zonal Commissioner';
    case 'cao':
      return 'Chief Accounts Officer';
    case 'super_admin':
      return 'Administrator';
    default: {
      const raw = user?.roleName?.trim() || user?.role?.trim() || user?.userType?.trim();
      return raw ? titleCaseRoleWords(raw) : 'Officer';
    }
  }
}
