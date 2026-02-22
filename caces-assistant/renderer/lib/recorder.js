import { session as sessionIpc, appApi } from './ipc.js'

export class SessionRecorder {
  constructor({ sessionId, config = {}, onAudioChunk, onScreenshot }) {
    this.sessionId = sessionId
    this.config = config
    this.onAudioChunk = onAudioChunk
    this.onScreenshot = onScreenshot

    this.mediaRecorder = null
    this.audioStream = null
    this.screenshotTimer = null
    this.chunkIndex = 0
    this.screenshotCount = 0
    this.lastImageData = null
    this.isPaused = false
    this.startTime = null
  }

  async start({ micDeviceId } = {}) {
    this.audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: micDeviceId ? { exact: micDeviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      },
      video: false,
    })

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    this.mediaRecorder = new MediaRecorder(this.audioStream, {
      mimeType,
      audioBitsPerSecond: 64000,
    })

    this.mediaRecorder.ondataavailable = async (e) => {
      if (e.data.size > 0 && !this.isPaused) {
        const arrayBuffer = await e.data.arrayBuffer()
        const index = this.chunkIndex++
        try {
          await sessionIpc.saveAudioChunk(this.sessionId, index, arrayBuffer)
          this.onAudioChunk?.(index)
        } catch (err) {
          console.error('Failed to save audio chunk:', err)
        }
      }
    }

    const chunkMs = (this.config.audioChunkDuration ?? 60) * 1000
    this.mediaRecorder.start(chunkMs)
    this.startTime = Date.now()

    this._startScreenshotCapture()
  }

  _startScreenshotCapture() {
    const intervalSec = this.config.screenshotInterval ?? 30
    const intervalMs = intervalSec * 1000

    setTimeout(() => {
      if (!this.isPaused) this._captureScreenshot()
    }, 3000)

    this.screenshotTimer = setInterval(() => {
      if (!this.isPaused) this._captureScreenshot()
    }, intervalMs)
  }

  async _captureScreenshot() {
    try {
      const sources = await appApi.getSources()
      if (!sources || sources.length === 0) return

      const source = sources[0]

      let screenStream
      try {
        screenStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
              maxWidth: 1920,
              maxHeight: 1080,
            },
          },
        })
      } catch {
        return
      }

      const track = screenStream.getVideoTracks()[0]

      const canvas = document.createElement('canvas')
      let imageData

      try {
        if (typeof ImageCapture !== 'undefined') {
          const capture = new ImageCapture(track)
          const bitmap = await capture.grabFrame()
          canvas.width = bitmap.width
          canvas.height = bitmap.height
          canvas.getContext('2d').drawImage(bitmap, 0, 0)
        } else {
          const video = document.createElement('video')
          video.srcObject = screenStream
          await new Promise(r => { video.onloadedmetadata = r })
          await video.play()
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          canvas.getContext('2d').drawImage(video, 0, 0)
          video.pause()
        }

        imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
      } finally {
        screenStream.getTracks().forEach(t => t.stop())
      }

      if (!this._hasVisuallyChanged(imageData)) return
      this.lastImageData = imageData

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      const arrayBuffer = await blob.arrayBuffer()
      const timestamp = Date.now()

      await sessionIpc.saveScreenshot(this.sessionId, arrayBuffer, timestamp)
      this.screenshotCount++
      this.onScreenshot?.(this.screenshotCount)
    } catch (err) {
      console.warn('Screenshot capture failed:', err.message)
    }
  }

  _hasVisuallyChanged(newImageData) {
    if (!this.lastImageData) return true
    const threshold = this.config.changeThreshold ?? 0.05
    const d1 = this.lastImageData.data
    const d2 = newImageData.data
    const len = Math.min(d1.length, d2.length)
    const step = 80
    let diff = 0
    let total = 0
    for (let i = 0; i < len; i += step) {
      const dr = Math.abs(d1[i] - d2[i])
      const dg = Math.abs(d1[i + 1] - d2[i + 1])
      const db = Math.abs(d1[i + 2] - d2[i + 2])
      if (dr + dg + db > 30) diff++
      total++
    }
    return total === 0 ? true : diff / total > threshold
  }

  pause() {
    this.isPaused = true
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.pause()
    }
  }

  resume() {
    this.isPaused = false
    if (this.mediaRecorder?.state === 'paused') {
      this.mediaRecorder.resume()
    }
  }

  async stop() {
    clearInterval(this.screenshotTimer)

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      await new Promise(resolve => {
        this.mediaRecorder.onstop = resolve
        this.mediaRecorder.requestData()
        this.mediaRecorder.stop()
      })
    }

    this.audioStream?.getTracks().forEach(t => t.stop())

    return {
      chunkCount: this.chunkIndex,
      screenshotCount: this.screenshotCount,
      durationMs: this.startTime ? Date.now() - this.startTime : 0,
    }
  }
}
