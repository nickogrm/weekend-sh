import React, { useState, useEffect, useRef } from 'react'
import GlassPanel from '../components/GlassPanel.jsx'
import ProgressStepper from '../components/ProgressStepper.jsx'
import { processing } from '../lib/ipc.js'

export default function ProcessingScreen({ session, onComplete }) {
  const [currentStep, setCurrentStep] = useState('audio')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('Initialisation...')
  const [error, setError] = useState(null)
  const [isComplete, setIsComplete] = useState(false)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const offProgress = window.electron.on('process:progress', ({ step, progress: p, message: m }) => {
      setCurrentStep(step)
      setProgress(p)
      setMessage(m)
      if (step === 'complete') setIsComplete(true)
    })

    const offError = window.electron.on('process:error', ({ message: m }) => {
      setError(m)
    })

    const offComplete = window.electron.on('process:complete', ({ summary }) => {
      setTimeout(() => onComplete(summary), 1000)
    })

    processing.start(session.id).catch(err => {
      setError(err.message)
    })

    return () => {
      offProgress?.()
      offError?.()
      offComplete?.()
    }
  }, [])

  return (
    <div className="max-w-lg mx-auto py-6 flex flex-col items-center animate-fade-in-up">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
          style={{
            background: 'rgba(0,128,255,0.1)',
            border: '1px solid rgba(0,128,255,0.3)',
            boxShadow: '0 0 40px rgba(0,128,255,0.15)',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0080ff" strokeWidth="1.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-bold mb-2" style={{ color: '#f0f0ff' }}>
          Traitement en cours
        </h1>
        <p className="text-sm" style={{ color: '#444466' }}>
          {session.metadata.title}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full mb-8">
        <div className="flex justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: '#444466' }}>Progression</span>
          <span className="text-xs font-mono font-bold" style={{ color: '#00f5ff' }}>{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div
            className="h-full rounded-full relative"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #0080ff, #00f5ff)',
              transition: 'width 0.5s ease',
              boxShadow: '0 0 12px rgba(0,245,255,0.6)',
            }}
          >
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
              style={{
                background: '#00f5ff',
                boxShadow: '0 0 8px rgba(0,245,255,0.9)',
                transform: 'translate(50%, -50%)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <GlassPanel className="w-full mb-6">
        <ProgressStepper currentStep={currentStep} progress={progress} message={message} />
      </GlassPanel>

      {/* Error */}
      {error && (
        <div
          className="w-full p-4 rounded-xl text-sm"
          style={{ background: 'rgba(255,68,102,0.1)', border: '1px solid rgba(255,68,102,0.3)', color: '#ff6688' }}
        >
          <strong className="block mb-1">Une erreur est survenue</strong>
          {error}
        </div>
      )}

      {/* Complete */}
      {isComplete && !error && (
        <div
          className="w-full p-4 rounded-xl text-sm flex items-center gap-3"
          style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', color: '#00ff88' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Résumé généré avec succès. Redirection...
        </div>
      )}

      {!error && !isComplete && (
        <p className="mt-4 text-xs text-center" style={{ color: '#222240' }}>
          Ne fermez pas l'application pendant le traitement.
        </p>
      )}
    </div>
  )
}
