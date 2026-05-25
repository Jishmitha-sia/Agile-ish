/**
 * Workspace-invitation email. Returns `{ subject, html, text }`.
 *
 * Same multipart pattern as the verification template: HTML for rich
 * clients, plain text for everyone else. Subject line names the
 * workspace so the recipient recognises it in their inbox.
 */
export const renderWorkspaceInvitationMessage = (input: {
  workspaceName: string;
  inviterDisplayName: string | null;
  role: string;
  acceptUrl: string;
  expiresInDays: number;
}): { subject: string; html: string; text: string } => {
  const subject = `You're invited to ${input.workspaceName} on Agile-ish`;
  const inviterPhrase = input.inviterDisplayName
    ? `${input.inviterDisplayName} invited you`
    : "You've been invited";
  const roleLabel = input.role.toLowerCase();

  const text = `Hi,

${inviterPhrase} to join ${input.workspaceName} on Agile-ish as a ${roleLabel}.

Accept the invitation:
${input.acceptUrl}

The link expires in ${input.expiresInDays} days. If you didn't expect this, you can ignore the email.

— Agile-ish
`;

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:32px 16px;background:#0f1117;color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#171924;border-radius:8px;padding:32px;">
    <tr><td>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;letter-spacing:-0.01em;">Join ${escapeHtml(input.workspaceName)}</h1>
      <p style="margin:0 0 24px;color:#a1a8ba;line-height:1.5;">
        ${escapeHtml(inviterPhrase)} to join <strong style="color:#f4f5f7;">${escapeHtml(input.workspaceName)}</strong> on Agile-ish as a <strong style="color:#f4f5f7;">${escapeHtml(roleLabel)}</strong>.
      </p>
      <p style="margin:0 0 32px;">
        <a href="${input.acceptUrl}" style="display:inline-block;padding:12px 20px;background:#7c5cff;color:#fff;text-decoration:none;border-radius:6px;font-weight:500;">Accept invitation</a>
      </p>
      <p style="margin:0;color:#5b6172;font-size:12px;line-height:1.5;">
        Link expires in ${input.expiresInDays} days. If the button doesn't work, paste this into your browser:<br>
        <span style="color:#a1a8ba;word-break:break-all;">${input.acceptUrl}</span>
      </p>
      <p style="margin:32px 0 0;color:#5b6172;font-size:12px;">
        Didn't expect this? You can ignore the email.
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
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default:  return '&#39;';
    }
  });
