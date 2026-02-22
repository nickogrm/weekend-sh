const inv = (channel, ...args) => window.electron.invoke(channel, ...args)

export const store = {
  get: (key) => inv('store:get', key),
  set: (key, value) => inv('store:set', key, value),
  delete: (key) => inv('store:delete', key),
}

export const keys = {
  get: (account) => inv('keys:get', account),
  set: (account, password) => inv('keys:set', account, password),
  delete: (account) => inv('keys:delete', account),
}

export const session = {
  create: (metadata) => inv('session:create', metadata),
  saveAudioChunk: (sessionId, index, buffer) =>
    inv('session:save-audio-chunk', sessionId, index, buffer),
  saveScreenshot: (sessionId, buffer, timestamp) =>
    inv('session:save-screenshot', sessionId, buffer, timestamp),
}

export const processing = {
  start: (sessionId) => inv('process:start', sessionId),
}

export const emailApi = {
  send: (params) => inv('email:send', params),
  test: (smtpConfig) => inv('email:test', smtpConfig),
}

export const appApi = {
  getSources: () => inv('app:get-sources'),
  requestMicAccess: () => inv('app:request-mic-access'),
  openSessionFolder: (id) => inv('app:open-session-folder', id),
  getVersion: () => inv('app:get-version'),
  openSystemPrefs: () => inv('app:open-system-prefs'),
}

export const exportPdf = (sessionId, html) => inv('export:pdf', sessionId, html)
