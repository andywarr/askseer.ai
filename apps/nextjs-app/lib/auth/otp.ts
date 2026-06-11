// @ts-nocheck
import crypto from "node:crypto";
import prisma from "@/apps/nextjs-app/lib/db/db";
import { Resend } from "resend";
import { logger } from "@/apps/shared/logger";

export function generateOtpCode(): string {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  return code;
}

export function hashOtp(code: string, salt?: string) {
  const s = salt ?? crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHmac("sha256", s).update(code).digest("hex");
  return { hash, salt: s };
}

export async function storeOtp(email: string, code: string, ttlSeconds = 300) {
  const { hash, salt } = hashOtp(code);
  const expires = new Date(Date.now() + ttlSeconds * 1000);

  await prisma.otpCode.updateMany({
    where: { email, consumedAt: null, expiresAt: { lt: new Date() } },
    data: { consumedAt: new Date() },
  });

  const record = await prisma.otpCode.create({
    data: {
      email,
      hashedCode: hash,
      salt,
      expiresAt: expires,
    },
  });
  return record;
}

export async function verifyAndConsumeOtp(email: string, code: string) {
  const record = await prisma.otpCode.findFirst({
    where: {
      email,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { valid: false as const };

  const { hash } = hashOtp(code, record.salt);
  if (hash !== record.hashedCode) return { valid: false as const };

  const updated = await prisma.otpCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
  return { valid: true as const, record: updated };
}

export async function sendOtpEmail(email: string, code: string, locale = "en") {
  const resend = new Resend(process.env.AUTH_RESEND_KEY);
  const host =
    process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, "") || "askseer.ai";
  const escapedHost = host.replace(/\./g, "&#8203;.");
  const brandColor = "#18181b";
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

  const isEs = locale === "es";

  const emailTitle = isEs
    ? `Su código de inicio de sesión de ${host}`
    : `Your ${host} sign-in code`;
  const unlockText = isEs
    ? "¡Comencemos a descubrir información!"
    : "Let's unlock some insights!";
  const codeDescription = isEs
    ? `Introduzca este código de 6 dígitos para iniciar sesión en <strong style="color: ${color.text};">${escapedHost}</strong>`
    : `Enter this 6-digit code to sign in to <strong style="color: ${color.text};">${escapedHost}</strong>`;
  const ignoreText = isEs
    ? "Si no solicitó este código, puede ignorarlo de forma segura."
    : "If you didn't request this code, you can safely ignore it.";
  const expireText = isEs
    ? "Este código caducará en 5 minutos por razones de seguridad."
    : "This code will expire in 5 minutes for security reasons.";
  const rightsText = isEs
    ? `© ${new Date().getFullYear()} Seer. Todos los derechos reservados.`
    : `© ${new Date().getFullYear()} Seer. All rights reserved.`;

  const subject = isEs ? `Iniciar sesión en ${host}` : `Sign in to ${host}`;
  const textBody = isEs
    ? `Use este código para iniciar sesión en ${host}: ${code}. Este código caducará en 5 minutos por razones de seguridad.`
    : `Use this code to sign in to ${host}: ${code}. This code will expire in 5 minutes for security reasons.`;

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailTitle}</title>
  <style>
    .code { font-size: 28px; font-weight: 700; letter-spacing: 8px; }
  </style>
  </head>
<body style="margin: 0; padding: 0; background-color: ${color.background}; font-family: 'Roboto', system-ui, -apple-system, Arial, sans-serif; line-height: 1.6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${color.background}; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 20px 20px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: ${color.cardBackground}; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid ${color.border};">
          <tr>
            <td align="center" style="padding: 40px 40px 20px 40px;">
              <div style="text-align: center;">
                <img src="https://${host}/logo-black.png" alt="Seer logo" height="30" width="32" style="display: block; margin: 0 auto 8px;" />
                <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: ${brandColor}; letter-spacing: -0.025em;">Seer</h1>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 0 40px 20px 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: ${color.text}; line-height: 1.25;">${unlockText}</h2>
              <p style="margin: 0 0 32px 0; font-size: 16px; color: #64748b; line-height: 1.5;">${codeDescription}</p>
            </td>
          </tr>
          <!-- Code block styled like CTA spacing -->
          <tr>
            <td align="center" style="padding: 0 40px 32px 40px;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: ${color.accent};">
                    <span class="code" style="display: inline-block; padding: 12px 20px; letter-spacing: 8px; font-weight: 700; font-size: 24px; color: ${brandColor};">${code}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid ${color.border}; margin: 0;">
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 32px 40px 40px 40px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; line-height: 1.5;">${ignoreText}</p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">${expireText}</p>
            </td>
          </tr>
        </table>
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin-top: 24px;">
          <tr>
            <td align="center">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">${rightsText}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  try {
    const { data, error } = await resend.emails.send({
      from:
        process.env.AUTH_RESEND_FROM || "Seer <notifications@mail.askseer.ai>",
      to: [email],
      subject,
      html,
      text: textBody,
    });
    if (error) throw error;
    logger.info("OTP email sent", {
      emailDomain: email.split("@")[1],
      id: data?.id,
      locale,
    });
    return true;
  } catch (error) {
    logger.error("Failed to send OTP email", {
      emailDomain: email.split("@")[1],
      error: error instanceof Error ? error.message : String(error),
      locale,
    });
    throw error;
  }
}
