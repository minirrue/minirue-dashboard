import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import DiscountsClient from '@/app/dashboard/discounts/DiscountsClient';

jest.mock('@/app/dashboard/discounts/CodesPanel', () => ({ __esModule: true, default: () => <div>Codes content</div> }));
jest.mock('@/app/dashboard/discounts/SitewidePanel', () => ({ __esModule: true, default: () => <div>Sitewide content</div> }));
jest.mock('@/app/dashboard/discounts/UsagePanel', () => ({ __esModule: true, default: () => <div>Usage content</div> }));

test('discount tabs follow roving keyboard navigation and keep the active panel associated', () => {
  render(<DiscountsClient />);
  const codes = screen.getByRole('tab', { name: 'Codes' });
  const sitewide = screen.getByRole('tab', { name: 'Sitewide' });
  const usage = screen.getByRole('tab', { name: 'Usage' });
  expect(codes).toHaveAttribute('tabindex', '0');
  expect(sitewide).toHaveAttribute('tabindex', '-1');
  codes.focus();
  fireEvent.keyDown(codes, { key: 'ArrowRight' });
  expect(sitewide).toHaveFocus();
  expect(sitewide).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', sitewide.id);
  fireEvent.keyDown(sitewide, { key: 'End' });
  expect(usage).toHaveFocus();
  fireEvent.keyDown(usage, { key: 'Home' });
  expect(codes).toHaveFocus();
});
