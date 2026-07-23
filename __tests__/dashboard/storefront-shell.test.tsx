import { render, screen } from '@testing-library/react';
import SectionCard from '@/app/dashboard/storefront-appearance/SectionCard';
import { newSection } from '@/lib/api/storefront';

describe('SectionCard', () => {
  it('names the section by type and shows its position', () => {
    render(
      <SectionCard
        section={newSection('journal', 2)}
        index={2}
        total={5}
        onChange={() => {}}
        onMove={() => {}}
        onRemove={() => {}}
      >
        <div />
      </SectionCard>,
    );
    expect(screen.getByText(/The Journal/)).toBeInTheDocument();
    expect(screen.getByText('3 of 5')).toBeInTheDocument();
  });

  it('disables Move up on the first section', () => {
    render(
      <SectionCard
        section={newSection('ribbon', 0)}
        index={0}
        total={3}
        onChange={() => {}}
        onMove={() => {}}
        onRemove={() => {}}
      >
        <div />
      </SectionCard>,
    );
    expect(screen.getByRole('button', { name: /move up/i })).toBeDisabled();
  });
});
