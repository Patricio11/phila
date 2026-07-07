/**
 * Phila-branded transactional email templates. Table-based, inline-styled HTML so
 * they render across email clients; each ships a plain-text fallback. Brand green
 * (#1C7D58) and a calm, warm South-African tone consistent with the product.
 */
const GREEN = "#1C7D58";
const INK = "#14231d";
const MUTED = "#5b6b63";
const BORDER = "#e4e9e6";
const BG = "#f5f7f6";

interface Email {
  subject: string;
  html: string;
  text: string;
}

function shell(opts: { preheader: string; heading: string; body: string; cta?: { label: string; url: string }; footnote?: string }): string {
  const button = opts.cta
    ? `<tr><td style="padding:8px 0 4px;">
         <a href="${opts.cta.url}" style="display:inline-block;background:${GREEN};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:10px;">${opts.cta.label}</a>
       </td></tr>`
    : "";
  const foot = opts.footnote
    ? `<tr><td style="padding:14px 0 0;color:${MUTED};font-size:12.5px;line-height:1.6;">${opts.footnote}</td></tr>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${BG};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
      <tr><td style="padding:26px 32px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><span style="display:inline-block;width:26px;height:26px;background:${GREEN};border-radius:8px;"></span></td>
          <td style="vertical-align:middle;padding-left:10px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:17px;font-weight:700;letter-spacing:-0.02em;color:${INK};">Phila</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:20px 32px 30px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="font-size:21px;font-weight:700;letter-spacing:-0.02em;padding-bottom:12px;">${opts.heading}</td></tr>
          <tr><td style="font-size:14.5px;line-height:1.65;color:${INK};padding-bottom:${opts.cta ? "20px" : "4px"};">${opts.body}</td></tr>
          ${button}
          ${foot}
        </table>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td style="padding:16px 32px;text-align:center;color:${MUTED};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;">
        Phila · counselling practice platform · South Africa<br>You're receiving this because an account was created with this address.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/** Sent on signup  the mandatory email-verification link. */
export function verificationEmail(url: string, name: string | null): Email {
  const first = (name ?? "").trim().split(/\s+/)[0] || "there";
  return {
    subject: "Verify your email to activate your Phila practice",
    html: shell({
      preheader: "Confirm your email to start your 17-day free trial.",
      heading: `Welcome to Phila, ${first} 👋`,
      body: "You're one click from your practice. Confirm this is your email address and we'll take you straight in  your <strong>17-day free trial</strong> starts now, no card needed.",
      cta: { label: "Verify my email", url },
      footnote: `If the button doesn't work, paste this link into your browser:<br><a href="${url}" style="color:${GREEN};word-break:break-all;">${url}</a><br><br>This link expires in 1 hour. If you didn't create a Phila account, you can safely ignore this email.`,
    }),
    text: `Welcome to Phila, ${first}.\n\nVerify your email to activate your practice and start your 17-day free trial:\n${url}\n\nThis link expires in 1 hour. If you didn't create a Phila account, ignore this email.`,
  };
}

/** Sent to an invited team member  the link both sets their password and activates them. */
export function teamInviteEmail(url: string, name: string | null, orgName: string): Email {
  const first = (name ?? "").trim().split(/\s+/)[0] || "there";
  return {
    subject: `You've been invited to join ${orgName} on Phila`,
    html: shell({
      preheader: `Set your password to join ${orgName}.`,
      heading: `Welcome to the team, ${first} 👋`,
      body: `You've been invited to join <strong>${orgName}</strong> on Phila. Set your password to activate your account  then you can sign in and get started.`,
      cta: { label: "Set my password", url },
      footnote: `If the button doesn't work, paste this link into your browser:<br><a href="${url}" style="color:${GREEN};word-break:break-all;">${url}</a><br><br>This link expires in 1 hour. If you weren't expecting this invitation, you can safely ignore it.`,
    }),
    text: `You've been invited to join ${orgName} on Phila.\n\nSet your password to activate your account:\n${url}\n\nThis link expires in 1 hour.`,
  };
}

/** Sent to an invited platform operator (super-admin)  sets their password + activates access. */
export function platformInviteEmail(url: string, name: string | null): Email {
  const first = (name ?? "").trim().split(/\s+/)[0] || "there";
  return {
    subject: "You've been invited as a Phila platform operator",
    html: shell({
      preheader: "Set your password to activate your operator account.",
      heading: `Welcome aboard, ${first} 🛡️`,
      body: "You've been given <strong>platform operator</strong> access to Phila  the super-admin console for organisations, plans, and integrations. Set your password to activate your account. We strongly recommend turning on two-factor authentication straight after.",
      cta: { label: "Set my password", url },
      footnote: `If the button doesn't work, paste this link into your browser:<br><a href="${url}" style="color:${GREEN};word-break:break-all;">${url}</a><br><br>This link expires in 1 hour. If you weren't expecting this, you can ignore it.`,
    }),
    text: `You've been invited as a Phila platform operator.\n\nSet your password: ${url}\n\nThis link expires in 1 hour.`,
  };
}

/** Sent when a user requests a password reset. */
export function resetPasswordEmail(url: string, name: string | null): Email {
  const first = (name ?? "").trim().split(/\s+/)[0] || "there";
  return {
    subject: "Reset your Phila password",
    html: shell({
      preheader: "Use this link to set a new password.",
      heading: "Reset your password",
      body: `Hi ${first}, we got a request to reset your Phila password. Click below to choose a new one. If this wasn't you, you can safely ignore this email  your password won't change.`,
      cta: { label: "Set a new password", url },
      footnote: `If the button doesn't work, paste this link into your browser:<br><a href="${url}" style="color:${GREEN};word-break:break-all;">${url}</a><br><br>This link expires in 1 hour.`,
    }),
    text: `Reset your Phila password.\n\nChoose a new password:\n${url}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
  };
}

/** Sent when the super-admin approves a practice's onboarding verification. */
export function approvalEmail(opts: { name: string | null; orgName: string; loginUrl: string }): Email {
  const first = (opts.name ?? "").trim().split(/\s+/)[0] || "there";
  return {
    subject: `${opts.orgName} is verified on Phila ✓`,
    html: shell({
      preheader: `${opts.orgName} has been verified  you're fully set up.`,
      heading: "You're verified 🎉",
      body: `Good news, ${first}  we've reviewed <strong>${opts.orgName}</strong> and everything checks out. Your practice is now fully verified, which unlocks client payouts and funder reporting. Thank you for getting your details in.`,
      cta: { label: "Go to your dashboard", url: opts.loginUrl },
      footnote: "Need a hand getting set up? Just reply to this email  a real person will help.",
    }),
    text: `You're verified.\n\n${opts.orgName} has been reviewed and verified on Phila. This unlocks payouts and funder reporting.\n\nSign in: ${opts.loginUrl}`,
  };
}

/** Sent when the super-admin sends a document back (action needed). */
export function actionNeededEmail(opts: { name: string | null; orgName: string; reason: string; onboardingUrl: string }): Email {
  const first = (opts.name ?? "").trim().split(/\s+/)[0] || "there";
  return {
    subject: `Action needed to verify ${opts.orgName}`,
    html: shell({
      preheader: "One of your onboarding documents needs another look.",
      heading: "One quick fix needed",
      body: `Hi ${first}, we reviewed <strong>${opts.orgName}</strong> and one item needs another look: <em>${opts.reason}</em>. Pop back in, update it, and resubmit  we'll review it again right away.`,
      cta: { label: "Update my details", url: opts.onboardingUrl },
    }),
    text: `Action needed for ${opts.orgName}.\n\n${opts.reason}\n\nUpdate and resubmit: ${opts.onboardingUrl}`,
  };
}
