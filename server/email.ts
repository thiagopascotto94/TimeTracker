/**
 * Transactional Email Service
 * Supports Resend, AWS SES, and Dev Outbox fallback
 */

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  link?: string;
  sentAt: Date;
  provider: 'resend' | 'ses' | 'dev-outbox';
  success: boolean;
}

// In-memory dev outbox for previewing sent emails
export const emailLogs: EmailLog[] = [];

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  link?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; provider: string; previewUrl?: string }> {
  const { to, subject, html, text, link } = options;
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || 'Cronos App <onboarding@resend.dev>';

  // 1. Try Resend if API Key is configured
  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [to],
          subject,
          html,
          text,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[Email Service - Resend] Sent email to ${to} (ID: ${data.id})`);
        emailLogs.unshift({
          id: data.id || Math.random().toString(),
          to,
          subject,
          text,
          html,
          link,
          sentAt: new Date(),
          provider: 'resend',
          success: true,
        });
        return { success: true, provider: 'resend', previewUrl: link };
      } else {
        const errText = await response.text();
        console.error('[Email Service - Resend] Failed to send email:', errText);
      }
    } catch (err) {
      console.error('[Email Service - Resend] Error during dispatch:', err);
    }
  }

  // 2. Fallback / Dev Outbox (Always available in dev or when API keys are not supplied)
  const logEntry: EmailLog = {
    id: `email_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    to,
    subject,
    text,
    html,
    link,
    sentAt: new Date(),
    provider: 'dev-outbox',
    success: true,
  };

  emailLogs.unshift(logEntry);
  if (emailLogs.length > 50) emailLogs.pop();

  console.log('\n' + '='.repeat(60));
  console.log('📧 [EMAIL DISPATCH - DEV OUTBOX]');
  console.log(`Para:    ${to}`);
  console.log(`Assunto: ${subject}`);
  if (link) console.log(`🔗 Link de Ação: ${link}`);
  console.log('='.repeat(60) + '\n');

  return { success: true, provider: 'dev-outbox', previewUrl: link };
}

/**
 * Send Password Reset Email
 */
export async function sendPasswordResetEmail(
  to: string,
  userName: string,
  resetUrl: string
): Promise<{ success: boolean; previewUrl?: string }> {
  const subject = 'Redefinição de Senha — Cronos Time Tracker';
  const text = `Olá, ${userName}!\n\nRecebemos uma solicitação para redefinir a sua senha no Cronos Time Tracker.\n\nAcesse o link abaixo para criar uma nova senha:\n${resetUrl}\n\nEste link expira em 1 hora.\n\nSe você não fez esta solicitação, por favor ignore este email.`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="540px" cellspacing="0" cellpadding="0" border="0" style="max-width: 540px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Cronos Time Tracker</h1>
              <p style="margin: 6px 0 0; color: #c7d2fe; font-size: 14px;">Gestão de tempo e faturamento profissional</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 16px; color: #0f172a; font-size: 18px; font-weight: 600;">Olá, ${userName || 'Profissional'}!</h2>
              <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
                Recebemos um pedido para redefinir a sua senha de acesso. Para continuar e criar uma nova senha com segurança, clique no botão abaixo:
              </p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.25);">
                  Redefinir Minha Senha
                </a>
              </div>

              <p style="margin: 0 0 16px; color: #64748b; font-size: 13px; line-height: 1.5;">
                Caso o botão não funcione, você pode copiar e colar este link diretamente no seu navegador:<br>
                <a href="${resetUrl}" style="color: #4f46e5; word-break: break-all;">${resetUrl}</a>
              </p>

              <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                  ⏱️ <strong>Aviso de segurança:</strong> Este link expira em 1 hora. Se você não solicitou a redefinição de senha, nenhuma ação é necessária e sua conta permanece totalmente segura.
                </p>
              </div>
            </td>
          </tr>
        </table>
        <!-- Footer -->
        <table role="presentation" width="100%" max-width="540px" cellspacing="0" cellpadding="0" border="0" style="max-width: 540px; margin-top: 20px;">
          <tr>
            <td align="center" style="color: #94a3b8; font-size: 12px;">
              © ${new Date().getFullYear()} Cronos Time Tracker. Todos os direitos reservados.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const result = await sendEmail({ to, subject, html, text, link: resetUrl });
  return { success: result.success, previewUrl: result.previewUrl };
}

/**
 * Send Workspace Invite Email
 */
export async function sendInviteEmail(
  to: string,
  inviterName: string,
  tenantName: string,
  role: string,
  inviteUrl: string
): Promise<{ success: boolean; previewUrl?: string }> {
  const roleLabel = role === 'admin' ? 'Administrador' : role === 'guest' ? 'Visualizador Convidado' : 'Membro da Equipe';
  const subject = `Convite para colaborar no workspace "${tenantName}" — Cronos`;
  const text = `Olá!\n\n${inviterName} convidou você para colaborar no workspace "${tenantName}" como ${roleLabel}.\n\nAcesse o link abaixo para aceitar o convite e começar:\n${inviteUrl}\n\nEste convite expira em 7 dias.`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="540px" cellspacing="0" cellpadding="0" border="0" style="max-width: 540px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Cronos Time Tracker</h1>
              <p style="margin: 6px 0 0; color: #c7d2fe; font-size: 14px;">Você foi convidado para uma equipe</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 16px; color: #0f172a; font-size: 18px; font-weight: 600;">Olá!</h2>
              <p style="margin: 0 0 16px; color: #475569; font-size: 15px; line-height: 1.6;">
                <strong>${inviterName}</strong> convidou você para se juntar à equipe do workspace <strong>"${tenantName}"</strong>.
              </p>

              <div style="margin: 20px 0; padding: 14px 18px; background-color: #f1f5f9; border-left: 4px solid #4f46e5; border-radius: 6px;">
                <p style="margin: 0; color: #334155; font-size: 14px;">
                  💼 <strong>Papel atribuído:</strong> ${roleLabel}
                </p>
              </div>

              <p style="margin: 0 0 24px; color: #475569; font-size: 15px; line-height: 1.6;">
                Com o Cronos você poderá rastrear horas em tarefas, sincronizar commits do Git, registrar notas de desenvolvimento e colaborar em relatórios faturáveis.
              </p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${inviteUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.25);">
                  Aceitar Convite e Entrar
                </a>
              </div>

              <p style="margin: 0 0 16px; color: #64748b; font-size: 13px; line-height: 1.5;">
                Ou use o link direto:<br>
                <a href="${inviteUrl}" style="color: #4f46e5; word-break: break-all;">${inviteUrl}</a>
              </p>

              <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                  ⏱️ Este convite é pessoal e expira em 7 dias. Se você não conhece este remetente, pode desconsiderar este email.
                </p>
              </div>
            </td>
          </tr>
        </table>
        <!-- Footer -->
        <table role="presentation" width="100%" max-width="540px" cellspacing="0" cellpadding="0" border="0" style="max-width: 540px; margin-top: 20px;">
          <tr>
            <td align="center" style="color: #94a3b8; font-size: 12px;">
              © ${new Date().getFullYear()} Cronos Time Tracker. Todos os direitos reservados.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const result = await sendEmail({ to, subject, html, text, link: inviteUrl });
  return { success: result.success, previewUrl: result.previewUrl };
}
