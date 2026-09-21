export { cn } from 'cn';

/**
 * `cn` — merge class names, last-write-wins on conflicting Tailwind utilities.
 *
 * `cn('p-2', 'p-4')` is `p-4`, not both. That conflict resolution is the whole
 * point: every shadcn component takes a `className` meant to override its own
 * defaults, and without it the override and the default both land in the class
 * list and stylesheet order picks the winner instead of the caller.
 *
 * WHY THIS FILE IS A RE-EXPORT AND NOT AN IMPLEMENTATION
 * -----------------------------------------------------
 * There were briefly two of these. `components.json` aliases `utils` to
 * `@/lib/utils`, so the primitives under components/storefront-appearance/
 * import from here — but shadcn's current registry emits `import { cn } from
 * "cn"` and installed that package, so all eight files in components/ui/ used
 * a different one. Two implementations of the same function, both live.
 *
 * Re-exporting settles it without fighting the generator: there is now exactly
 * one implementation, both import paths reach it, and the next `shadcn add`
 * still produces code that works. The `cn` package is a compiled drop-in for
 * clsx + tailwind-merge, so nothing is lost by preferring it.
 */
