const { app } = require('electron')
const path = require('path')
const fs = require('fs/promises')
const { v4: uuidv4 } = require('uuid')

const getSessionsDir = () => path.join(app.getPath('userData'), 'sessions')

async function createSession(metadata) {
  const id = uuidv4()
  const sessionsDir = getSessionsDir()
  const sessionDir = path.join(sessionsDir, id)

  await fs.mkdir(path.join(sessionDir, 'audio'), { recursive: true })
  await fs.mkdir(path.join(sessionDir, 'screenshots'), { recursive: true })

  const session = {
    id,
    createdAt: new Date().toISOString(),
    metadata,
    status: 'recording',
  }

  await fs.writeFile(
    path.join(sessionDir, 'session.json'),
    JSON.stringify(session, null, 2)
  )

  return { id, sessionDir }
}

async function saveAudioChunk(sessionId, chunkIndex, arrayBuffer) {
  const chunkPath = path.join(
    getSessionsDir(), sessionId, 'audio',
    `chunk-${String(chunkIndex).padStart(4, '0')}.webm`
  )
  await fs.writeFile(chunkPath, Buffer.from(arrayBuffer))
  return chunkPath
}

async function saveScreenshot(sessionId, arrayBuffer, timestamp) {
  const filename = `screenshot-${timestamp}.png`
  const screenshotPath = path.join(
    getSessionsDir(), sessionId, 'screenshots', filename
  )
  await fs.writeFile(screenshotPath, Buffer.from(arrayBuffer))
  return { screenshotPath, filename }
}

function getSessionDir(sessionId) {
  return path.join(getSessionsDir(), sessionId)
}

async function readSession(sessionId) {
  const sessionPath = path.join(getSessionsDir(), sessionId, 'session.json')
  const data = await fs.readFile(sessionPath, 'utf8')
  return JSON.parse(data)
}

async function updateSession(sessionId, updates) {
  const session = await readSession(sessionId)
  const updated = { ...session, ...updates }
  const sessionPath = path.join(getSessionsDir(), sessionId, 'session.json')
  await fs.writeFile(sessionPath, JSON.stringify(updated, null, 2))
  return updated
}

module.exports = { createSession, saveAudioChunk, saveScreenshot, getSessionDir, readSession, updateSession }
