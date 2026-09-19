import { mapsLinkFor, formatDeliveryWindow, cairoDate } from '@/lib/orders/delivery-format';

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

  it('never returns a non-http(s) link (a pasted javascript: must not become an href)', () => {
    expect(mapsLinkFor({ mapsUrl: 'javascript:alert(1)' })).toBeNull();
    expect(mapsLinkFor({ mapsUrl: 'data:text/html,<script>alert(1)</script>' })).toBeNull();
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
    const today = cairoDate(Date.now());
    expect(formatDeliveryWindow({ date: today, start: '19:00', end: '24:00' })).toBe(
      'Today, 7 PM–12 AM',
    );
  });

  it("labels tomorrow's window as Tomorrow (the after-cutoff case)", () => {
    const tomorrow = cairoDate(Date.now() + 24 * 60 * 60 * 1000);
    expect(formatDeliveryWindow({ date: tomorrow, start: '19:00', end: '24:00' })).toBe(
      'Tomorrow, 7 PM–12 AM',
    );
  });

  it('uses the Cairo date, not UTC: 01:30 in Cairo is already the next day', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-15T22:30:00Z')); // 01:30 on 16 Sep in Cairo
    try {
      expect(formatDeliveryWindow({ date: '2026-09-16', start: '19:00', end: '24:00' })).toBe(
        'Today, 7 PM–12 AM',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('falls back to the raw date for anything further out', () => {
    expect(formatDeliveryWindow({ date: '2099-01-01', start: '19:00', end: '24:00' })).toBe(
      '2099-01-01, 7 PM–12 AM',
    );
  });
});
