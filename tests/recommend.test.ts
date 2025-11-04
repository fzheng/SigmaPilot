import { computeRecommendation } from '../src/recommend';

describe('computeRecommendation', () => {
  test('neutral when exposure is zero', () => {
    const rec = computeRecommendation('0xabc', 0, 50000);
    expect(rec.score).toBe(0);
    expect(rec.text.toLowerCase()).toContain('no open btc');
  });

  test('positive score for long exposure', () => {
    const rec = computeRecommendation('0xabc', 10, 50000);
    expect(rec.score).toBeGreaterThan(0.8);
    expect(rec.text.toLowerCase()).toContain('net long');
  });

  test('negative score for short exposure', () => {
    const rec = computeRecommendation('0xabc', -10, 50000);
    expect(rec.score).toBeLessThan(-0.8);
    expect(rec.text.toLowerCase()).toContain('net short');
  });
});

