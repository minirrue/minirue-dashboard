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
    primaryAction: { label: 'View analytics', href: '/analytics' },
  },
  [Role.ADMIN]: {
    headline: 'Administration center',
    description: 'Manage catalog, customers, refunds, and store settings. Analytics reports are limited to owner and staff roles.',
    primaryAction: { label: 'Manage products', href: '/products' },
  },
  [Role.STAFF]: {
    headline: 'Operations workspace',
    description: 'Fulfill orders, manage inventory, and support day-to-day store operations.',
    primaryAction: { label: 'View orders', href: '/orders' },
  },
  [Role.COLLAB]: {
    headline: 'Partner workspace',
    description: 'Manage your brand profile, products, and orders scoped to your collaborator account.',
    primaryAction: { label: 'Open workspace', href: '/collab/workspace' },
  },
  [Role.DEV]: {
    headline: 'Developer session',
    description: 'Elevated access for local development. Production sessions downgrade developer privileges.',
    primaryAction: { label: 'Dashboard home', href: '/overview' },
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
    '/overview': 'Overview',
    '/products': 'Products',
    '/categories': 'Categories',
    '/orders': 'Orders',
    '/customers': 'Customers',
    '/fulfillment': 'Fulfillment',
    '/refunds': 'Refunds',
    '/inventory': 'Inventory',
    '/analytics': 'Analytics',
    '/loyalty': 'Loyalty',
    '/collaborators': 'Collaborators',
    '/collab': 'Partner workspace',
    '/collab/workspace': 'Partner workspace',
    '/collab/orders': 'Partner orders',
    '/collab/products': 'Partner products',
    '/collab/brand': 'Brand profile',
    '/collab/analytics': 'Partner analytics',
    '/settings': 'Settings',
    '/storefront-appearance': 'Storefront',
  };
  return labels[path] ?? 'this section';
}
