export const renderPasswordResetMessage = (input: {
  displayName: string;
  resetUrl: string;
  expiresInMinutes: number;
}): { subject: string; html: string; text: string } => {
  const subject = 'Reset your Agile-ish password';

  const text = `Hi ${input.displayName},

We received a request to reset your password. The link below expires in ${input.expiresInMinutes} minutes.

${input.resetUrl}

If you didn't request a reset, you can ignore this email — your password is unchanged.

— Agile-ish
`;

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:32px 16px;background:#0f1117;color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#171924;border-radius:8px;padding:32px;">
    <tr><td>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;letter-spacing:-0.01em;">Reset your password</h1>
      <p style="margin:0 0 24px;color:#a1a8ba;line-height:1.5;">
        Hi ${escapeHtml(input.displayName)} — we received a request to reset your Agile-ish password.
        The link expires in ${input.expiresInMinutes} minutes.
      </p>
      <p style="margin:0 0 32px;">
        <a href="${input.resetUrl}" style="display:inline-block;padding:12px 20px;background:#7c5cff;color:#fff;text-decoration:none;border-radius:6px;font-weight:500;">Reset password</a>
      </p>
      <p style="margin:0;color:#5b6172;font-size:12px;line-height:1.5;">
        If the button doesn't work, paste this link into your browser:<br>
        <span style="color:#a1a8ba;word-break:break-all;">${input.resetUrl}</span>
      </p>
      <p style="margin:32px 0 0;color:#5b6172;font-size:12px;">
        Didn't request a reset? You can ignore this email — your password is unchanged.
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
