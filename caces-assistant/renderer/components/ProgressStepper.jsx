import React from 'react'

const STEP_ICONS = {
  audio: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  ),
  transcription: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  vision: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  summary: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  saving: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
    </svg>
  ),
  complete: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
}

const STEP_LABELS = {
  audio: 'Fusion des fichiers audio',
  transcription: 'Transcription Whisper',
  vision: 'Analyse des diapositives',
  summary: 'Génération du résumé',
  saving: 'Sauvegarde',
  complete: 'Terminé',
}

export default function ProgressStepper({ currentStep, progress, message }) {
  const steps = ['audio', 'transcription', 'vision', 'summary', 'saving']
  const currentIndex = steps.indexOf(currentStep)

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const isDone = i < currentIndex || currentStep === 'complete'
        const isActive = step === currentStep
        const isPending = i > currentIndex && currentStep !== 'complete'

        return (
          <div
            key={step}
            className="flex items-center gap-4 p-3 rounded-xl transition-all duration-500"
            style={{
              background: isActive
                ? 'rgba(0,128,255,0.08)'
                : isDone
                  ? 'rgba(0,255,136,0.04)'
                  : 'transparent',
              border: isActive
                ? '1px solid rgba(0,128,255,0.2)'
                : isDone
                  ? '1px solid rgba(0,255,136,0.15)'
                  : '1px solid transparent',
              opacity: isPending ? 0.4 : 1,
              animation: isActive ? 'none' : undefined,
            }}
          >
            <div
              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
              style={{
                background: isDone
                  ? 'rgba(0,255,136,0.15)'
                  : isActive
                    ? 'rgba(0,128,255,0.2)'
                    : 'rgba(255,255,255,0.04)',
                border: isDone
                  ? '1px solid rgba(0,255,136,0.4)'
                  : isActive
                    ? '1px solid rgba(0,128,255,0.5)'
                    : '1px solid rgba(255,255,255,0.06)',
                color: isDone ? '#00ff88' : isActive ? '#0080ff' : '#333355',
                boxShadow: isActive ? '0 0 12px rgba(0,128,255,0.3)' : 'none',
              }}
            >
              {isActive ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                STEP_ICONS[isDone ? 'complete' : step]
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium" style={{ color: isDone ? '#00ff88' : isActive ? '#f0f0ff' : '#333355' }}>
                {STEP_LABELS[step]}
              </div>
              {isActive && message && (
                <div className="text-xs mt-0.5 truncate" style={{ color: '#444466' }}>
                  {message}
                </div>
              )}
            </div>
            {isDone && (
              <div style={{ color: '#00ff88', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
