import { mapsLinkFor, formatDeliveryWindow } from '@/lib/orders/delivery-format';

describe('mapsLinkFor', () => {
  it('builds a Google Maps search URL from lat/lng', () => {
    expect(mapsLinkFor({ lat: 30.0444, lng: 31.2357 })).toBe(
      'https://www.google.com/maps/search/?api=1&query=30.0444,31.2357',
    );
  });

  it('returns the pasted mapsUrl verbatim', () => {
    const url = 'https://maps.app.goo.gl/abc123';
    expect(mapsLinkFor({ mapsUrl: url })).toBe(url);
  });

  it('returns null when there is no location', () => {
    expect(mapsLinkFor(null)).toBeNull();
    expect(mapsLinkFor(undefined)).toBeNull();
  });
});

describe('formatDeliveryWindow', () => {
  it('returns an em dash when there is no window', () => {
    expect(formatDeliveryWindow(null)).toBe('—');
  });

  it("labels today's window as Today", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(formatDeliveryWindow({ date: today, start: '19:00', end: '24:00' })).toBe(
      'Today, 19:00–24:00',
    );
  });

  it("labels tomorrow's window as Tomorrow (the after-cutoff case)", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(formatDeliveryWindow({ date: tomorrow, start: '19:00', end: '24:00' })).toBe(
      'Tomorrow, 19:00–24:00',
    );
  });

  it('falls back to the raw date for anything further out', () => {
    expect(formatDeliveryWindow({ date: '2099-01-01', start: '19:00', end: '24:00' })).toBe(
      '2099-01-01, 19:00–24:00',
    );
  });
});
