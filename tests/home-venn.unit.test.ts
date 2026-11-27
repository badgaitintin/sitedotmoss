import { describe, it, expect } from 'vitest';
import {
  DEFAULT_BIRTHDAY,
  TWO_CIRCLE_SECTIONS,
  computeAgeString,
  easeOutBack,
  escapeHtml,
  interpolatePercent,
  renderSideCardHtml,
} from '../src/lib/home/venn-helpers';

describe('computeAgeString()', () => {
  it('computes exact birthday at midnight', () => {
    const now = new Date(2026, 0, 13, 0, 0, 0);
    expect(computeAgeString(now, DEFAULT_BIRTHDAY)).toBe('22y 0d 0m');
  });

  it('computes one day and one minute before birthday', () => {
    const now = new Date(2026, 0, 12, 23, 59, 0);
    expect(computeAgeString(now, DEFAULT_BIRTHDAY)).toBe('21y 364d 1439m');
  });

  it('handles leap year day count accurately', () => {
    // 2024 is a leap year (Jan has 31 days -> 18 days left in Jan, Feb has 29 days, Mar 1 -> 18 + 29 + 1 = 48d)
    const now = new Date(2024, 2, 1, 0, 0, 0);
    expect(computeAgeString(now, DEFAULT_BIRTHDAY)).toBe('20y 48d 0m');
  });

  it('computes arbitrary date and time of day', () => {
    const now = new Date(2026, 10, 26, 18, 30, 0);
    const msPerDay = 1000 * 60 * 60 * 24;
    const expectedDays = Math.floor((now.getTime() - new Date(2026, 0, 13).getTime()) / msPerDay);
    expect(computeAgeString(now, DEFAULT_BIRTHDAY)).toBe(`22y ${expectedDays}d 1110m`);
  });
});

describe('easeOutBack() and interpolatePercent()', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 6);
    expect(easeOutBack(1)).toBeCloseTo(1, 6);
  });

  it('overshoots slightly before settling', () => {
    expect(easeOutBack(0.75)).toBeGreaterThan(1);
  });

  it('interpolates percentage strings cleanly', () => {
    expect(interpolatePercent(66, 24, 0)).toBe('66.00%');
    expect(interpolatePercent(66, 24, 0.5)).toBe('45.00%');
    expect(interpolatePercent(66, 24, 1)).toBe('24.00%');
  });
});

describe('renderSideCardHtml() and TWO_CIRCLE_SECTIONS', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>"test"&\'x\'</script>')).toBe(
      '&lt;script&gt;&quot;test&quot;&amp;&#39;x&#39;&lt;/script&gt;'
    );
  });

  it('returns empty string for nullish input', () => {
    expect(renderSideCardHtml(null)).toBe('');
    expect(renderSideCardHtml(undefined)).toBe('');
  });

  it('renders experience and project cards with full titles', () => {
    const expHtml = renderSideCardHtml(TWO_CIRCLE_SECTIONS.experience.left);
    expect(expHtml).toContain('Lief Capital Asset Management');
    expect(expHtml).toContain('Walk-Forward Validation');

    const thaidotrunHtml = renderSideCardHtml(TWO_CIRCLE_SECTIONS.experience.right);
    expect(thaidotrunHtml).toContain('Thaidotrun Co., Ltd. (Merged into ASICS)');

    const projHtml = renderSideCardHtml(TWO_CIRCLE_SECTIONS.project.left);
    expect(projHtml).toContain('MTC-UAV Maize Tassel Counting');
  });
});
