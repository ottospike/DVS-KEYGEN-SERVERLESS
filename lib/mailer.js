const nodemailer = require("nodemailer");
require("dotenv").config();

// Logging utility
const log = (level, message) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [MAILER]`;
  console.log(`${prefix} ${level.toUpperCase()}: ${message}`);
};

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: process.env.MAIL_PORT == 465,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

async function sendLicenseEmail(recipientEmail, licenses) {
  if (!recipientEmail || !licenses || licenses.length === 0) {
    throw new Error("Email and licenses are required.");
  }

  // Link direto para o instalador Windows
  const directDownloadUrl =
    "https://audinate-software-updates.sgp1.cdn.digitaloceanspaces.com/DanteVirtualSoundcard/4/4.5/DVS-4.5.2.3_windows.exe";

  // Handle both string format and object format for licenses
  const licenseList = licenses.map(lic => {
    if (typeof lic === 'string') {
      return { code: lic };
    }
    return { code: lic.code };
  });

  const textLicenseList = licenseList.map((lic, idx) =>
    `${idx + 1}. ${lic.code}`
  ).join('\n');

  const mailOptions = {
    from: `"TATAFODAO" <${process.env.MAIL_USER}>`,
    to: recipientEmail,
    subject: licenses.length === 1 ? '🔑 Sua Chave de Licença Chegou!' : `🔑 Suas ${licenses.length} Chaves de Licença Chegaram!`,
    text: `Olá!\n\nAqui estão suas ${licenses.length} chave(s) de licença Dante Virtual Soundcard:\n\n${textLicenseList}\n\nBaixe o instalador (Windows) aqui: ${directDownloadUrl}\n\nAproveite!\n\n© ${new Date().getFullYear()} TATAFODAO`,
    html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Suas Chaves de Licença</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7f7f7;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f7f7; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Dante Virtual Soundcard</h1>
                            <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">Suas Chaves de Licença</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 25px 0; color: #444; font-size: 15px; line-height: 1.6;">
                                Olá! Aqui ${licenses.length === 1 ? 'está sua' : `estão suas ${licenses.length}`} chave${licenses.length === 1 ? '' : 's'} de licença gerada${licenses.length === 1 ? '' : 's'}:
                            </p>
                            ${licenseList.map((lic, idx) => `
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 15px;">
                                <tr>
                                    <td style="padding: 18px; background-color: #fafafa; border: 2px solid #e5e5e5; border-radius: 8px;">
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td width="80" style="vertical-align: middle;">
                                                    <span style="color: #666; font-size: 14px; font-weight: 600;">Licença ${idx + 1}</span>
                                                </td>
                                                <td style="vertical-align: middle; text-align: center;">
                                                    <code style="color: #0066cc; font-size: 16px; font-weight: 700; letter-spacing: 1px; user-select: all; background: #ffffff; padding: 8px 15px; border-radius: 4px; display: inline-block; border: 1px solid #e0e0e0;">${lic.code}</code>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            `).join('')}

                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px;">
                                <tr>
                                    <td style="text-align: center; padding: 20px; border-radius: 8px; background-color: #f0f7ff;">
                                        <p style="margin: 0 0 15px 0; font-size: 15px; color: #333; font-weight: 500;">Baixe o instalador do Windows:</p>
                                        <a href="${directDownloadUrl}"
                                           style="display: inline-block; background-color: #28a745; color: white; padding: 16px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(40, 167, 69, 0.2);">
                                           ⬇️ DOWNLOAD (Windows)
                                        </a>
                                        <p style="margin: 15px 0 0 0; font-size: 12px; color: #777;">Versão 4.5.2.3 • Link Direto</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 25px; background-color: #f8f9fa; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e5e5;">
                            <p style="margin: 0; text-align: center; color: #888; font-size: 13px; line-height: 1.6;">
                                <strong style="color: #666;">© ${new Date().getFullYear()} TATAFODAO</strong><br>
                                Certifique-se de copiar a chave corretamente sem espaços extras.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    log("info", `Email sent to ${recipientEmail} (${licenses.length} licenses)`);
    return info;
  } catch (error) {
    log("error", `Failed to send email to ${recipientEmail}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  sendLicenseEmail,
};
