import React, { useState, useEffect, useRef, useCallback } from 'react'
import WaveformBars from '../components/WaveformBars.jsx'
import GlassPanel from '../components/GlassPanel.jsx'
import NeonButton from '../components/NeonButton.jsx'
import { SessionRecorder } from '../lib/recorder.js'
import { store } from '../lib/ipc.js'

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function RecordingScreen({ session, onComplete }) {
  const [elapsed, setElapsed] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [screenshotCount, setScreenshotCount] = useState(0)
  const [chunkCount, setChunkCount] = useState(0)
  const [status, setStatus] = useState('starting')
  const [error, setError] = useState(null)
  const [isStopping, setIsStopping] = useState(false)

  const recorderRef = useRef(null)
  const timerRef = useRef(null)
  const analyserRef = useRef(null)
  const audioContextRef = useRef(null)

  useEffect(() => {
    startRecording()
    return () => {
      clearInterval(timerRef.current)
      audioContextRef.current?.close()
    }
  }, [])

  async function startRecording() {
    try {
      const captureConfig = await store.get('capture') || {}

      const recorder = new SessionRecorder({
        sessionId: session.id,
        config: captureConfig,
        onAudioChunk: (i) => setChunkCount(i + 1),
        onScreenshot: (n) => setScreenshotCount(n),
      })

      await recorder.start({ micDeviceId: session.metadata.micDeviceId })
      recorderRef.current = recorder
      setStatus('recording')

      timerRef.current = setInterval(() => {
        setElapsed(e => e + 1)
      }, 1000)
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  function togglePause() {
    const recorder = recorderRef.current
    if (!recorder) return
    if (isPaused) {
      recorder.resume()
      setIsPaused(false)
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      recorder.pause()
      setIsPaused(true)
      clearInterval(timerRef.current)
    }
  }

  async function handleStop() {
    if (isStopping) return
    setIsStopping(true)
    clearInterval(timerRef.current)

    const recorder = recorderRef.current
    if (recorder) {
      try {
        const result = await recorder.stop()
        onComplete({ ...result, durationSeconds: elapsed })
      } catch (err) {
        setError(err.message)
        setIsStopping(false)
      }
    }
  }

  return (
    <div className="max-w-xl mx-auto py-6 flex flex-col items-center animate-fade-in-up">
      {/* Recording badge */}
      <div className="mb-10">
        {isPaused ? (
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest"
            style={{
              background: 'rgba(255,170,0,0.1)',
              border: '1px solid rgba(255,170,0,0.3)',
              color: '#ffaa00',
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: '#ffaa00' }} />
            Pause
          </div>
        ) : status === 'starting' ? (
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest"
            style={{
              background: 'rgba(0,128,255,0.1)',
              border: '1px solid rgba(0,128,255,0.3)',
              color: '#0080ff',
            }}
          >
            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Démarrage...
          </div>
        ) : (
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest"
            style={{
              background: 'rgba(255,68,102,0.1)',
              border: '1px solid rgba(255,68,102,0.3)',
              color: '#ff4466',
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: '#ff4466', animation: 'blink 1s ease-in-out infinite' }} />
            Enregistrement
          </div>
        )}
      </div>

      {/* Waveform + Timer */}
      <GlassPanel
        glowColor={isPaused ? '255,170,0' : '0,245,255'}
        className="w-full mb-6 text-center"
        noPadding
      >
        <div className="px-8 py-10">
          {/* Title */}
          <p className="text-sm mb-6 truncate" style={{ color: '#444466' }}>
            {session.metadata.title}
          </p>

          {/* Waveform */}
          <div className="flex justify-center mb-6">
            <WaveformBars isActive={status === 'recording' && !isPaused} />
          </div>

          {/* Timer */}
          <div
            className="font-mono text-6xl font-bold mb-1"
            style={{
              color: isPaused ? '#ffaa00' : '#f0f0ff',
              textShadow: isPaused
                ? '0 0 30px rgba(255,170,0,0.5)'
                : '0 0 40px rgba(0,245,255,0.4)',
              letterSpacing: '-0.02em',
              transition: 'all 0.3s ease',
            }}
          >
            {formatTime(elapsed)}
          </div>
          <p className="text-xs" style={{ color: '#222240' }}>Durée de session</p>
        </div>
      </GlassPanel>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 w-full mb-8">
        <GlassPanel className="text-center">
          <div className="text-2xl font-bold font-mono" style={{ color: '#00f5ff' }}>
            {chunkCount}
          </div>
          <div className="text-xs mt-1" style={{ color: '#333355' }}>Segments audio</div>
        </GlassPanel>
        <GlassPanel className="text-center">
          <div className="flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
            <div className="text-2xl font-bold font-mono" style={{ color: '#8b5cf6' }}>
              {screenshotCount}
            </div>
          </div>
          <div className="text-xs mt-1" style={{ color: '#333355' }}>Captures d'écran</div>
        </GlassPanel>
      </div>

      {/* Error */}
      {error && (
        <div
          className="w-full mb-4 p-4 rounded-xl text-sm"
          style={{ background: 'rgba(255,68,102,0.1)', border: '1px solid rgba(255,68,102,0.3)', color: '#ff6688' }}
        >
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 w-full">
        <NeonButton
          variant="ghost"
          onClick={togglePause}
          disabled={status !== 'recording' || isStopping}
          className="flex-1"
        >
          {isPaused ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Reprendre
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              Pause
            </>
          )}
        </NeonButton>

        <NeonButton
          variant="danger"
          onClick={handleStop}
          disabled={status === 'starting'}
          loading={isStopping}
          className="flex-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          Terminer
        </NeonButton>
      </div>

      <p className="mt-5 text-xs text-center" style={{ color: '#222240' }}>
        Les données sont sauvegardées localement en temps réel.
      </p>
    </div>
  )
}
