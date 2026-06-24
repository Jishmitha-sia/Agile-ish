/**
 * Email-verification message template. Returns `{ subject, html, text }`.
 *
 * Both HTML and text variants are sent (multipart/alternative) so users
 * on text-only clients still get a usable message. The link is the
 * primary call-to-action; the token alone is shown so mobile users who
 * can't click can paste it into the web form.
 */
export const renderEmailVerificationMessage = (input: {
  displayName: string;
  verifyUrl: string;
  expiresInHours: number;
}): { subject: string; html: string; text: string } => {
  const subject = 'Verify your Agile-ish email';

  const text = `Hi ${input.displayName},

Please verify your email by opening the link below. It expires in ${input.expiresInHours} hours.

${input.verifyUrl}

If you didn't sign up for Agile-ish, you can safely ignore this message.

— Agile-ish
`;

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:32px 16px;background:#0f1117;color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#171924;border-radius:8px;padding:32px;">
    <tr><td>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;letter-spacing:-0.01em;">Verify your email</h1>
      <p style="margin:0 0 24px;color:#a1a8ba;line-height:1.5;">
        Hi ${escapeHtml(input.displayName)} — please confirm your email address to finish setting up your Agile-ish account.
        The link expires in ${input.expiresInHours} hours.
      </p>
      <p style="margin:0 0 32px;">
        <a href="${input.verifyUrl}" style="display:inline-block;padding:12px 20px;background:#7c5cff;color:#fff;text-decoration:none;border-radius:6px;font-weight:500;">Verify email</a>
      </p>
      <p style="margin:0;color:#5b6172;font-size:12px;line-height:1.5;">
        If the button doesn't work, paste this link into your browser:<br>
        <span style="color:#a1a8ba;word-break:break-all;">${input.verifyUrl}</span>
      </p>
      <p style="margin:32px 0 0;color:#5b6172;font-size:12px;">
        Didn't sign up? You can ignore this email.
      </p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
};

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
