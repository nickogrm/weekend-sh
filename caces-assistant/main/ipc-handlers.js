const { ipcMain, desktopCapturer, systemPreferences, shell } = require('electron')
const keytar = require('keytar')
const { store, KEYTAR_SERVICE, KEYTAR_ACCOUNTS } = require('./store')
const { createSession, saveAudioChunk, saveScreenshot, getSessionDir } = require('./recorder')
const { Processor } = require('./processor')
const { sendEmail, testSmtp } = require('./mailer')
const path = require('path')

let activeProcessor = null

function registerIpcHandlers(mainWindow) {

  // --- Store ---
  ipcMain.handle('store:get', (_e, key) => store.get(key))
  ipcMain.handle('store:set', (_e, key, value) => { store.set(key, value) })
  ipcMain.handle('store:delete', (_e, key) => { store.delete(key) })

  // --- Keytar (macOS Keychain) ---
  ipcMain.handle('keys:get', async (_e, account) => {
    return keytar.getPassword(KEYTAR_SERVICE, account)
  })
  ipcMain.handle('keys:set', async (_e, account, password) => {
    return keytar.setPassword(KEYTAR_SERVICE, account, password)
  })
  ipcMain.handle('keys:delete', async (_e, account) => {
    return keytar.deletePassword(KEYTAR_SERVICE, account)
  })

  // --- Session management ---
  ipcMain.handle('session:create', async (_e, metadata) => {
    return createSession(metadata)
  })
  ipcMain.handle('session:save-audio-chunk', async (_e, sessionId, chunkIndex, arrayBuffer) => {
    return saveAudioChunk(sessionId, chunkIndex, arrayBuffer)
  })
  ipcMain.handle('session:save-screenshot', async (_e, sessionId, arrayBuffer, timestamp) => {
    return saveScreenshot(sessionId, arrayBuffer, timestamp)
  })

  // --- Processing pipeline ---
  ipcMain.handle('process:start', async (_e, sessionId) => {
    const openaiKey = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNTS.openai)
    if (!openaiKey) throw new Error('Clé API OpenAI non configurée. Allez dans les Paramètres.')

    activeProcessor = new Processor({ openaiApiKey: openaiKey, mainWindow })
    activeProcessor.run(sessionId).catch(err => {
      mainWindow?.webContents.send('process:error', { message: err.message })
    })
    return { started: true }
  })

  // --- PDF Export ---
  ipcMain.handle('export:pdf', async (_e, sessionId, htmlContent) => {
    const puppeteer = require('puppeteer-core')

    const chromePaths = {
      darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      linux: '/usr/bin/google-chrome',
    }

    const executablePath = chromePaths[process.platform]
    const sessionDir = getSessionDir(sessionId)
    const pdfPath = path.join(sessionDir, 'compte-rendu.pdf')

    let browser
    try {
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
      const page = await browser.newPage()
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' })
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size:9px;width:100%;text-align:right;padding-right:20mm;color:#999;">Compte-rendu de formation CACES</div>`,
        footerTemplate: `<div style="font-size:9px;width:100%;text-align:center;color:#999;">Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      })
    } finally {
      await browser?.close()
    }

    return pdfPath
  })

  // --- Email ---
  ipcMain.handle('email:send', async (_e, { sessionId, to, subject, htmlBody, pdfPath }) => {
    const emailConfig = store.get('email') || {}
    const provider = emailConfig.provider || 'resend'

    const config = {
      ...emailConfig,
      resendApiKey: await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNTS.resend),
      smtpPassword: await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNTS.smtpPassword),
    }

    return sendEmail({ provider, config, to, subject, htmlBody, pdfAttachmentPath: pdfPath })
  })

  ipcMain.handle('email:test', async (_e, smtpConfig) => {
    const smtpPassword = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNTS.smtpPassword)
    return testSmtp({ ...smtpConfig, smtpPassword })
  })

  // --- System / App ---
  ipcMain.handle('app:get-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 200, height: 120 },
    })
    return sources.map(s => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
    }))
  })

  ipcMain.handle('app:request-mic-access', async () => {
    if (process.platform === 'darwin') {
      const status = await systemPreferences.askForMediaAccess('microphone')
      return status
    }
    return true
  })

  ipcMain.handle('app:open-session-folder', async (_e, sessionId) => {
    const dir = getSessionDir(sessionId)
    shell.openPath(dir)
  })

  ipcMain.handle('app:get-version', () => {
    return '1.0.0'
  })

  ipcMain.handle('app:open-system-prefs', async (_e, pane) => {
    if (process.platform === 'darwin') {
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
    }
  })
}

module.exports = { registerIpcHandlers }
