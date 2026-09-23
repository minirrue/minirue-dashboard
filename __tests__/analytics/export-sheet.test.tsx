import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExportSheet from '@/app/dashboard/analytics/_ui/sheets/ExportSheet';
import * as exportLib from '@/lib/analytics/export';
import * as story from '@/lib/api/story';
import { Harness, shellApi } from './shell-harness';
import { tiktokNamed, person } from './people-fixture';

jest.mock('@/lib/analytics/export', () => ({ ...jest.requireActual('@/lib/analytics/export'), downloadFile: jest.fn() }));
jest.mock('@/lib/api/story', () => ({ ...jest.requireActual('@/lib/api/story'), downloadServerExport: jest.fn() }));

const download = exportLib.downloadFile as jest.Mock;
const serverExport = story.downloadServerExport as jest.Mock;

function renderSheet() {
  const api = shellApi([tiktokNamed({ visitorNumber: 1187 }), person({ visitorNumber: 1203 })]);
  render(
    <Harness api={api}>
      <ExportSheet section="people" onClose={jest.fn()} rangeLabel="23 Aug – 21 Sep 2026" filtersLabel="Source: Paid ads" whoCounts="Excluding you, staff & bots" extras={{}} />
    </Harness>,
  );
  return api;
}

/** dashboard#128: one Export for the whole dashboard, generated in the browser. */
describe('Export sheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('previews what will be exported: range, filters, who counts, sections and file', () => {
    renderSheet();
    const preview = screen.getByLabelText('Export includes');
    expect(preview).toHaveTextContent('23 Aug – 21 Sep 2026');
    expect(preview).toHaveTextContent('Source: Paid ads');
    expect(preview).toHaveTextContent('Excluding you, staff & bots');
    expect(preview).toHaveTextContent('People');
    expect(preview).toHaveTextContent('minirue-analytics_people_2026-08-23_2026-09-21.csv');
  });

  it('downloads the current section as CSV, every row, stamped in Cairo time', async () => {
    const api = renderSheet();
    fireEvent.click(screen.getAllByRole('button', { name: /^Export$/ }).at(-1)!);
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    const [name, body, format] = download.mock.calls[0];
    expect(name).toBe('minirue-analytics_people_2026-08-23_2026-09-21.csv');
    expect(format).toBe('csv');
    expect(body).toContain('Section: People');
    expect(body).toContain('Visitor #1187');
    expect(body).toContain('Visitor #1203');
    expect(body).toMatch(/Generated,"\d{1,2} \w{3} \d{4}, \d{1,2}:\d{2} (AM|PM) \(Cairo time\)"/);
    expect(await screen.findByText('Export ready')).toBeInTheDocument();
    expect(api.toast).toHaveBeenCalledWith('Export ready');
    expect(serverExport).not.toHaveBeenCalled();
  });

  it('exports the entire dashboard as JSON, plus raw events from the server when asked', async () => {
    serverExport.mockResolvedValue(true);
    renderSheet();
    fireEvent.click(screen.getByRole('radio', { name: /Entire dashboard/ }));
    fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Raw events/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /^Export$/ }).at(-1)!);
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    const [name, body] = download.mock.calls[0];
    expect(name).toBe('minirue-analytics_dashboard_2026-08-23_2026-09-21.json');
    expect(JSON.parse(body).sections).toEqual(['Overview', 'People', 'Journeys', 'Sources', 'Flow', 'Social ads quality', 'Data quality']);
    await waitFor(() => expect(serverExport).toHaveBeenCalledWith('story', 'json', expect.objectContaining({ from: '2026-08-23' }), {}, 'raw-events'));
  });

  it('selected sections: nothing picked means nothing to export', () => {
    renderSheet();
    fireEvent.click(screen.getByRole('radio', { name: /Selected sections/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'People' }));
    expect(screen.getByLabelText('Export includes')).toHaveTextContent('None selected');
    expect(screen.getAllByRole('button', { name: /^Export$/ }).at(-1)).toBeDisabled();
  });
});
