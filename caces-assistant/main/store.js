const Store = require('electron-store')

const schema = {
  profile: {
    type: 'object',
    properties: {
      trainerName: { type: 'string', default: '' },
      trainerEmail: { type: 'string', default: '' },
      organization: { type: 'string', default: '' },
    },
    default: {}
  },
  capture: {
    type: 'object',
    properties: {
      screenshotInterval: { type: 'number', default: 30 },
      changeThreshold: { type: 'number', default: 0.05 },
      audioChunkDuration: { type: 'number', default: 60 },
    },
    default: {}
  },
  email: {
    type: 'object',
    properties: {
      provider: { type: 'string', default: 'resend' },
      smtpHost: { type: 'string', default: '' },
      smtpPort: { type: 'number', default: 587 },
      smtpUser: { type: 'string', default: '' },
      fromEmail: { type: 'string', default: '' },
      fromName: { type: 'string', default: 'CACES Assistant' },
    },
    default: {}
  },
}

const store = new Store({ schema })

const KEYTAR_SERVICE = 'caces-assistant'
const KEYTAR_ACCOUNTS = {
  openai: 'openai-api-key',
  resend: 'resend-api-key',
  smtpPassword: 'smtp-password',
}

module.exports = { store, KEYTAR_SERVICE, KEYTAR_ACCOUNTS }
