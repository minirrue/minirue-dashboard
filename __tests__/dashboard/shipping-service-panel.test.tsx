import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import ShippingServicePanel from '@/app/dashboard/fulfillment/ShippingServicePanel';

describe('ShippingServicePanel', () => {
  it('states plainly that no shipping service is connected', () => {
    render(<ShippingServicePanel />);
    expect(screen.getByText(/not connected/i)).toBeInTheDocument();
  });

  it('disables every control so nothing can be submitted', () => {
    render(<ShippingServicePanel />);
    const controls = [
      ...screen.getAllByRole('button'),
      ...screen.getAllByRole('combobox'),
      ...screen.getAllByRole('textbox'),
    ];
    expect(controls.length).toBeGreaterThan(0);
    controls.forEach((el) => expect(el).toBeDisabled());
  });

  it('renders no form element, so there is nothing to POST', () => {
    const { container } = render(<ShippingServicePanel />);
    expect(container.querySelector('form')).toBeNull();
  });
});
