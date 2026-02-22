import React from 'react'

const SCREEN_LABELS = {
  setup: 'Nouvelle session',
  recording: 'Enregistrement en cours',
  processing: 'Traitement',
  review: 'Résumé',
  settings: 'Paramètres',
}

export default function TitleBar({ onSettings, currentScreen }) {
  return (
    <div
      className="flex items-center justify-between px-5 flex-shrink-0"
      style={{
        WebkitAppRegion: 'drag',
        height: 52,
        background: 'rgba(10,10,15,0.95)',
        borderBottom: '1px solid rgba(30,32,64,0.8)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex items-center gap-3" style={{ paddingLeft: 60 }}>
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: '#00f5ff', boxShadow: '0 0 6px rgba(0,245,255,0.8)' }}
          />
          <span
            className="font-display font-bold tracking-wide text-sm"
            style={{ color: '#f0f0ff', letterSpacing: '0.05em' }}
          >
            CACES<span style={{ color: '#00f5ff' }}>.</span>AI
          </span>
        </div>
        {SCREEN_LABELS[currentScreen] && (
          <>
            <span style={{ color: '#1e2040' }}>›</span>
            <span className="text-xs font-medium" style={{ color: '#444466' }}>
              {SCREEN_LABELS[currentScreen]}
            </span>
          </>
        )}
      </div>

      <div style={{ WebkitAppRegion: 'no-drag' }}>
        {onSettings && (
          <button
            onClick={onSettings}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#444466',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#00f5ff'
              e.currentTarget.style.borderColor = 'rgba(0,245,255,0.3)'
              e.currentTarget.style.background = 'rgba(0,245,255,0.05)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#444466'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.background = 'transparent'
            }}
            title="Paramètres"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
