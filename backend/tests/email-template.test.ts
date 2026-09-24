import { describe, expect, it } from 'vitest';
import { renderEmail } from '../src/utils/email-template';

describe('email template', () => {
  it('renders branded html with details, button and escaped user content', () => {
    const { html, text } = renderEmail({
      category: 'Leave management', heading: 'Leave request', greetingName: 'Admin',
      message: 'Line one\n\nSecond <b>paragraph</b>',
      details: [{ label: 'Reason', value: '<script>alert(1)</script>' }],
      action: { label: 'Review request', path: '/school/leave' },
    });
    expect(html).toContain('EduSphere');
    expect(html).toContain('Review request');
    expect(html).toContain('/school/leave');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;b&gt;paragraph&lt;/b&gt;');
    expect(text).toContain('Hi Admin,');
    expect(text).toContain('Reason: <script>alert(1)</script>');
  });
});
