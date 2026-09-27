'use client';

import type { ReactNode } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/animate-ui/primitives/radix/dropdown-menu';
import { Dialog, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/animate-ui/primitives/radix/dialog';
import './animated-controls.css';

export function MenuSelect<T extends string>({ label, value, options, onChange, disabled = false }: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return <MotionConfig reducedMotion="user"><DropdownMenu><DropdownMenuTrigger disabled={disabled} className="dash-btn-secondary mr-menu-select" aria-label={label}>
    <span>{label}: <strong>{options.find((option) => option.value === value)?.label ?? value}</strong></span><ChevronDown size={16} />
  </DropdownMenuTrigger><DropdownMenuContent className="mr-animated-menu" sideOffset={6} collisionPadding={12} align="start">
    {options.map((option) => <DropdownMenuItem key={option.value} className="mr-animated-menu-item" onSelect={() => onChange(option.value)}>{option.label}{option.value === value && <Check size={16} />}</DropdownMenuItem>)}
  </DropdownMenuContent></DropdownMenu></MotionConfig>;
}

export function SideSheet({ open, onClose, title, description, children, footer, busy = false }: {
  open: boolean; onClose: () => void; title: string; description: string; children: ReactNode; footer?: ReactNode; busy?: boolean;
}) {
  return <MotionConfig reducedMotion="user"><Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}><DialogPortal><DialogOverlay className="mr-sheet-overlay" /><DialogContent className="mr-side-sheet" onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onInteractOutside={(event) => { if (busy) event.preventDefault(); }}>
    <header className="mr-sheet-head"><div><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></div><DialogClose disabled={busy} className="dash-icon-button" aria-label="Close panel"><X size={20}/></DialogClose></header>
    <div className="mr-sheet-body">{children}</div>{footer && <footer className="mr-sheet-footer">{footer}</footer>}
  </DialogContent></DialogPortal></Dialog></MotionConfig>;
}
