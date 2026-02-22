import React, { useState } from 'react'
import SetupScreen from './pages/SetupScreen.jsx'
import RecordingScreen from './pages/RecordingScreen.jsx'
import ProcessingScreen from './pages/ProcessingScreen.jsx'
import ReviewScreen from './pages/ReviewScreen.jsx'
import SettingsScreen from './pages/SettingsScreen.jsx'
import TitleBar from './components/TitleBar.jsx'

export default function App() {
  const [screen, setScreen] = useState('setup')
  const [prevScreen, setPrevScreen] = useState('setup')
  const [session, setSession] = useState(null)
  const [transitioning, setTransitioning] = useState(false)

  function navigate(to) {
    setTransitioning(true)
    setTimeout(() => {
      setPrevScreen(screen)
      setScreen(to)
      setTransitioning(false)
    }, 180)
  }

  function onSessionCreated(sessionData) {
    setSession(sessionData)
    navigate('recording')
  }

  function onRecordingComplete(recordingResult) {
    setSession(s => ({ ...s, ...recordingResult }))
    navigate('processing')
  }

  function onProcessingComplete(summaryData) {
    setSession(s => ({ ...s, summary: summaryData }))
    navigate('review')
  }

  function openSettings() {
    navigate('settings')
  }

  function closeSettings() {
    navigate(prevScreen === 'settings' ? 'setup' : prevScreen)
  }

  function startNewSession() {
    setSession(null)
    navigate('setup')
  }

  const showSettings = screen !== 'settings' && screen !== 'recording'

  return (
    <div
      className="flex flex-col"
      style={{ height: '100vh', background: '#0a0a0f', overflow: 'hidden' }}
    >
      <TitleBar
        onSettings={showSettings ? openSettings : null}
        currentScreen={screen}
      />

      <main
        className="flex-1 overflow-y-auto px-6"
        style={{
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? 'translateY(8px)' : 'translateY(0)',
          transition: 'opacity 0.18s ease, transform 0.18s ease',
        }}
      >
        {screen === 'setup' && (
          <SetupScreen onComplete={onSessionCreated} onSettings={openSettings} />
        )}
        {screen === 'recording' && session && (
          <RecordingScreen session={session} onComplete={onRecordingComplete} />
        )}
        {screen === 'processing' && session && (
          <ProcessingScreen session={session} onComplete={onProcessingComplete} />
        )}
        {screen === 'review' && session && (
          <ReviewScreen session={session} onNewSession={startNewSession} />
        )}
        {screen === 'settings' && (
          <SettingsScreen onBack={closeSettings} />
        )}
      </main>
    </div>
  )
}
