import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names, last-write-wins on conflicting Tailwind utilities.
 *
 * `clsx` flattens conditionals and arrays; `twMerge` then resolves genuine
 * conflicts — `cn('p-2', 'p-4')` is `p-4`, not both. That second step is the
 * reason this exists rather than a template literal: every shadcn component
 * takes a `className` prop meant to override its own defaults, and without
 * twMerge the override and the default both land in the class list and the
 * winner is decided by stylesheet order rather than by the caller.
 *
 * Required by every shadcn component. Kept here (not in a `components/ui`
 * barrel) because it is a plain utility, and `components.json` points the
 * generator at this path.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
