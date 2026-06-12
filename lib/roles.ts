export enum UserRole {
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
  SUPERADMIN = 'superadmin',
  SUPER_ADMIN_SPACE = 'super admin',
  AGENT = 'agent',
}

export const ADMIN_ROLES = [
  'ADMIN',
  'SUPER ADMIN',
  'SUPER_ADMIN',
  'SUPERADMIN'
] as const;

export function isAdmin(role?: string): boolean {
  if (!role) return false;
  const clean = role.toUpperCase().trim().replace(/[\s_-]/g, '');
  return clean === 'ADMIN' || clean === 'SUPERADMIN';
}
