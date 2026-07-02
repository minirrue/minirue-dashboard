import { Role, type Role as RoleType } from './role';

export interface RoleBrief {
  headline: string;
  description: string;
  primaryAction: { label: string; href: string };
}

const BRIEFS: Record<RoleType, RoleBrief> = {
  [Role.OWNER]: {
    headline: 'Store overview',
    description: 'Revenue, customer growth, and order flow at a glance. You have full access across catalog, operations, and settings.',
    primaryAction: { label: 'View analytics', href: '/dashboard/analytics' },
  },
  [Role.ADMIN]: {
    headline: 'Administration center',
    description: 'Manage catalog, customers, refunds, and store settings. Analytics reports are limited to owner and staff roles.',
    primaryAction: { label: 'Manage products', href: '/dashboard/products' },
  },
  [Role.STAFF]: {
    headline: 'Operations workspace',
    description: 'Fulfill orders, manage inventory, and support day-to-day store operations.',
    primaryAction: { label: 'View orders', href: '/dashboard/orders' },
  },
  [Role.COLLAB]: {
    headline: 'Partner workspace',
    description: 'Manage your brand profile, products, and orders scoped to your collaborator account.',
    primaryAction: { label: 'Open workspace', href: '/dashboard/collab' },
  },
  [Role.DEV]: {
    headline: 'Developer session',
    description: 'Elevated access for local development. Production sessions downgrade developer privileges.',
    primaryAction: { label: 'Dashboard home', href: '/dashboard' },
  },
  [Role.CUSTOMER]: {
    headline: 'Customer account',
    description: 'This surface is for store staff only.',
    primaryAction: { label: 'Return to storefront', href: '/' },
  },
};

export function roleBrief(role: RoleType): RoleBrief {
  return BRIEFS[role];
}

export function routeSectionLabel(path: string): string {
  const labels: Record<string, string> = {
    '/dashboard': 'Overview',
    '/dashboard/products': 'Products',
    '/dashboard/categories': 'Categories',
    '/dashboard/orders': 'Orders',
    '/dashboard/customers': 'Customers',
    '/dashboard/fulfillment': 'Fulfillment',
    '/dashboard/refunds': 'Refunds',
    '/dashboard/inventory': 'Inventory',
    '/dashboard/analytics': 'Analytics',
    '/dashboard/loyalty': 'Loyalty',
    '/dashboard/collaborators': 'Collaborators',
    '/dashboard/collab': 'Partner workspace',
    '/dashboard/collab/orders': 'Partner orders',
    '/dashboard/collab/products': 'Partner products',
    '/dashboard/collab/brand': 'Brand profile',
    '/dashboard/collab/analytics': 'Partner analytics',
    '/dashboard/settings': 'Settings',
  };
  return labels[path] ?? 'this section';
}
