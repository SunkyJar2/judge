import { describe, it, expect } from 'bun:test';
import { sanitizeHtmlSimple } from '../src/lib/sanitize';
import { getProblemHref, getProblemApiHref } from '../src/lib/utils';

describe('Sanitizer & URL Routing Helpers', () => {
  it('correctly constructs problem URLs preserving path segments and encoding spaces', () => {
    expect(getProblemHref('DP P1 all/PDF Archive/DP1-01')).toBe('/problems/DP%20P1%20all/PDF%20Archive/DP1-01');
    expect(getProblemHref('Modul-1/A/SetA1')).toBe('/problems/Modul-1/A/SetA1');
    expect(getProblemHref('')).toBe('/problems');
  });

  it('correctly constructs problem API URLs', () => {
    expect(getProblemApiHref('DP P1 all/PDF Archive/DP1-01', 'statement.pdf'))
      .toBe('/api/problems/DP%20P1%20all/PDF%20Archive/DP1-01/statement.pdf');
  });

  it('sanitizes malicious scripts and executable tags', () => {
    const malicious = '<p>Normal text</p><script>alert("XSS")</script><img src="x" onerror="alert(1)">';
    const clean = sanitizeHtmlSimple(malicious);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onerror');
    expect(clean).toContain('<p>Normal text</p>');
  });

  it('neutralizes javascript: URIs in links and iframe injections', () => {
    const malicious = '<a href="javascript:steal()">Click me</a><iframe src="evil.com"></iframe>';
    const clean = sanitizeHtmlSimple(malicious);
    expect(clean).not.toContain('javascript:');
    expect(clean).not.toContain('<iframe');
    expect(clean).toContain('Click me');
  });
});
