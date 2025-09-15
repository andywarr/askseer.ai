// Centralized email template helper so multiple server actions can share styling
export function createStyledEmailHtml(params: {
  title: string;
  subtitle: string;
  content: string;
  brandColor?: string;
  buttonText?: string;
  buttonUrl?: string;
  showFooter?: boolean;
  footerContact?: string; // override footer contact email text
}) {
  const {
    title,
    subtitle,
    content,
    brandColor = "#18181b",
    buttonText,
    buttonUrl,
    showFooter = true,
    footerContact = "payments@askseer.ai",
  } = params;

  const baseUrl = process.env.NEXTAUTH_URL || "https://askseer.ai";

  const color = {
    background: "#f8fafc",
    text: "#3f3f46",
    mainBackground: "#ffffff",
    cardBackground: "#ffffff",
    buttonBackground: brandColor,
    buttonBorder: brandColor,
    buttonText: "#ffffff",
    accent: "#f1f5f9",
    border: "#e2e8f0",
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${color.background};font-family:'Roboto',system-ui,-apple-system,Arial,sans-serif;line-height:1.6;">
  <table width="100%" style="background-color:${color.background};min-height:100vh;" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding:20px;">
        <table width="100%" style="max-width:600px;background-color:${color.cardBackground};border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06);border:1px solid ${color.border};" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center" style="padding:40px 40px 20px 40px;">
              <div style="text-align:center;">
                <img src="${baseUrl}/logo-black.png" alt="Seer logo" height="30" width="32" style="display:block;margin:0 auto 8px;" />
                <h1 style="margin:0;font-size:28px;font-weight:800;color:${brandColor};letter-spacing:-0.025em;">Seer</h1>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 40px 20px 40px;">
              <h2 style="margin:0 0 16px 0;font-size:24px;font-weight:600;color:${color.text};line-height:1.25;">${title}</h2>
              <p style="margin:0 0 32px 0;font-size:16px;color:#64748b;line-height:1.5;">${subtitle}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px 40px;">${content}</td>
          </tr>
          ${
            buttonText && buttonUrl
              ? `<tr><td align="center" style="padding:0 40px 32px 40px;">
            <table cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="border-radius:8px;background-color:${color.buttonBackground};">
              <a href="${buttonUrl}" style="display:inline-block;padding:12px 32px;font-size:16px;font-weight:500;color:${color.buttonText};text-decoration:none;border-radius:8px;">${buttonText}</a>
            </td></tr></table></td></tr>`
              : ""
          }
          <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid ${color.border};margin:0;"/></td></tr>
          ${
            showFooter
              ? `<tr><td align="center" style="padding:32px 40px 40px 40px;">
            <p style="margin:0 0 8px 0;font-size:14px;color:#64748b;">Questions? Contact us at ${footerContact}</p>
            <p style="margin:0;font-size:12px;color:#94a3b8;">We'll respond within 2 business days.</p>
          </td></tr>`
              : `<tr><td style="padding:20px 40px;"></td></tr>`
          }
        </table>
        <table width="100%" style="max-width:600px;margin-top:24px;" cellspacing="0" cellpadding="0" border="0">
          <tr><td align="center"><p style="margin:0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} Seer. All rights reserved.</p></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
