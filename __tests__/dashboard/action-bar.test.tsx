import { render, screen, waitFor } from '@testing-library/react';
import DashboardActionBar from '@/components/dashboard/DashboardActionBar';

beforeEach(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });

it('portals actions outside transformed content while reserving space in their main', async () => {
  const { container, rerender } = render(<div className="dash-shell"><main className="dash-main"><div style={{transform:'translateY(0)'}}><DashboardActionBar title="Accounting"><button>Save</button></DashboardActionBar></div></main></div>);
  const footer = await screen.findByRole('contentinfo', {name:'Page actions'});
  expect(footer.parentElement).toBe(container.querySelector('.dash-shell'));
  expect(container.querySelector('.dash-main')).not.toContainElement(footer);
  await waitFor(() => expect(container.querySelector('.dash-main')).toHaveAttribute('data-has-action-bar','true'));
  rerender(<div className="dash-shell"><main className="dash-main"><p>Another page</p></main></div>);
  expect(container.querySelector('.dash-main')).not.toHaveAttribute('data-has-action-bar');
  expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
});
