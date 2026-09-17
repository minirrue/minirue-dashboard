import { fireEvent, render, screen } from '@testing-library/react';
import { ReasonPicker } from '@/components/dashboard/ReasonPicker';

const shortOptions = [
  { value: 'COUNT', label: 'Stock count' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'OTHER', label: 'Other' },
] as const;

describe('ReasonPicker', () => {
  it('uses radios for short lists and keeps Other last', () => {
    render(<ReasonPicker label="Reason" options={shortOptions} value="COUNT" onChange={jest.fn()} note="" onNoteChange={jest.fn()} otherValue="OTHER" />);
    expect(screen.getAllByRole('radio').map((item) => item.getAttribute('value'))).toEqual(['COUNT', 'DAMAGED', 'OTHER']);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('opens a required explanation for Other', () => {
    const onChange = jest.fn();
    render(<ReasonPicker label="Reason" options={shortOptions} value="OTHER" onChange={onChange} note="" onNoteChange={jest.fn()} otherValue="OTHER" error="Explain this choice." />);
    expect(screen.getByRole('textbox')).toBeRequired();
    expect(screen.getByRole('alert')).toHaveTextContent('Explain this choice.');
    fireEvent.click(screen.getByRole('radio', { name: 'Damaged' }));
    expect(onChange).toHaveBeenCalledWith('DAMAGED');
  });

  it('uses a select when there are more than six choices', () => {
    const options = Array.from({ length: 7 }, (_, index) => ({ value: `R${index}`, label: `Reason ${index}` }));
    render(<ReasonPicker label="Reason" options={options} value="R0" onChange={jest.fn()} note="" onNoteChange={jest.fn()} otherValue="R6" />);
    expect(screen.getByRole('combobox', { name: 'Reason' })).toBeInTheDocument();
  });
});
