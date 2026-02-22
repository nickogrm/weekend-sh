const nodemailer = require('nodemailer')

async function sendEmail({ provider, config, to, subject, htmlBody, pdfAttachmentPath }) {
  const toArray = Array.isArray(to) ? to : [to]

  if (provider === 'resend') {
    const { Resend } = require('resend')
    const resend = new Resend(config.resendApiKey)

    const attachments = []
    if (pdfAttachmentPath) {
      const { readFileSync } = require('fs')
      attachments.push({
        filename: 'compte-rendu-formation.pdf',
        content: readFileSync(pdfAttachmentPath),
      })
    }

    return resend.emails.send({
      from: `${config.fromName || 'CACES Assistant'} <${config.fromEmail}>`,
      to: toArray,
      subject,
      html: htmlBody,
      attachments,
    })
  }

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort || 587,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword,
    },
  })

  const mailOptions = {
    from: `"${config.fromName || 'CACES Assistant'}" <${config.fromEmail || config.smtpUser}>`,
    to: toArray.join(', '),
    subject,
    html: htmlBody,
  }

  if (pdfAttachmentPath) {
    mailOptions.attachments = [{
      filename: 'compte-rendu-formation.pdf',
      path: pdfAttachmentPath,
    }]
  }

  return transporter.sendMail(mailOptions)
}

async function testSmtp(config) {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort || 587,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword,
    },
  })
  await transporter.verify()
  return { success: true }
}

module.exports = { sendEmail, testSmtp }
