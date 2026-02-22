const { contextBridge, ipcRenderer } = require('electron')

const INVOKE_CHANNELS = [
  'store:get',
  'store:set',
  'store:delete',
  'keys:get',
  'keys:set',
  'keys:delete',
  'session:create',
  'session:save-audio-chunk',
  'session:save-screenshot',
  'process:start',
  'export:pdf',
  'email:send',
  'email:test',
  'app:get-sources',
  'app:request-mic-access',
  'app:open-session-folder',
  'app:get-version',
  'app:open-system-prefs',
]

const ON_CHANNELS = [
  'process:progress',
  'process:error',
  'process:complete',
]

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, ...args) => {
    if (!INVOKE_CHANNELS.includes(channel)) {
      throw new Error(`Blocked IPC channel: ${channel}`)
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel, callback) => {
    if (!ON_CHANNELS.includes(channel)) {
      throw new Error(`Blocked IPC channel: ${channel}`)
    }
    const listener = (_event, ...args) => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel)
  }
})
