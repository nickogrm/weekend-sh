import React, { useState, useEffect } from 'react'
import GlassPanel from '../components/GlassPanel.jsx'
import NeonButton from '../components/NeonButton.jsx'
import { store, keys, emailApi } from '../lib/ipc.js'

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex border-b mb-6" style={{ borderColor: 'rgba(30,32,64,0.8)' }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className="px-5 py-3 text-sm font-medium transition-all duration-200"
          style={{
            color: active === tab.id ? '#00f5ff' : '#333355',
            borderBottom: active === tab.id ? '2px solid #00f5ff' : '2px solid transparent',
            background: 'transparent',
            marginBottom: -1,
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function Field({ label, children, help }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
      {help && <p className="mt-1 text-xs" style={{ color: '#333355' }}>{help}</p>}
    </div>
  )
}

export default function SettingsScreen({ onBack }) {
  const [tab, setTab] = useState('profile')
  const [profile, setProfile] = useState({ trainerName: '', trainerEmail: '', organization: '' })
  const [openaiKey, setOpenaiKey] = useState('')
  const [emailProvider, setEmailProvider] = useState('resend')
  const [resendKey, setResendKey] = useState('')
  const [smtp, setSmtp] = useState({ host: '', port: 587, user: '', fromEmail: '', fromName: 'CACES Assistant' })
  const [captureConfig, setCaptureConfig] = useState({ screenshotInterval: 30, changeThreshold: 5, audioChunkDuration: 60 })
  const [saving, setSaving] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [testingOpenai, setTestingOpenai] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    const [prof, emailConf, captConf, oaiKey, resKey] = await Promise.all([
      store.get('profile'),
      store.get('email'),
      store.get('capture'),
      keys.get('openai-api-key'),
      keys.get('resend-api-key'),
    ])
    if (prof) setProfile(prof)
    if (emailConf) {
      setEmailProvider(emailConf.provider || 'resend')
      setSmtp({
        host: emailConf.smtpHost || '',
        port: emailConf.smtpPort || 587,
        user: emailConf.smtpUser || '',
        fromEmail: emailConf.fromEmail || '',
        fromName: emailConf.fromName || 'CACES Assistant',
      })
    }
    if (captConf) {
      setCaptureConfig({
        screenshotInterval: captConf.screenshotInterval || 30,
        changeThreshold: (captConf.changeThreshold || 0.05) * 100,
        audioChunkDuration: captConf.audioChunkDuration || 60,
      })
    }
    if (oaiKey) setOpenaiKey(oaiKey)
    if (resKey) setResendKey(resKey)
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function saveAll() {
    setSaving(true)
    try {
      await Promise.all([
        store.set('profile', profile),
        store.set('email', {
          provider: emailProvider,
          smtpHost: smtp.host,
          smtpPort: smtp.port,
          smtpUser: smtp.user,
          fromEmail: smtp.fromEmail,
          fromName: smtp.fromName,
        }),
        store.set('capture', {
          screenshotInterval: captureConfig.screenshotInterval,
          changeThreshold: captureConfig.changeThreshold / 100,
          audioChunkDuration: captureConfig.audioChunkDuration,
        }),
        openaiKey ? keys.set('openai-api-key', openaiKey) : Promise.resolve(),
        resendKey ? keys.set('resend-api-key', resendKey) : Promise.resolve(),
      ])
      showToast('Paramètres sauvegardés')
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function testOpenai() {
    setTestingOpenai(true)
    try {
      if (!openaiKey) throw new Error('Clé manquante')
      await keys.set('openai-api-key', openaiKey)
      showToast('Clé API OpenAI valide')
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error')
    } finally {
      setTestingOpenai(false)
    }
  }

  async function testSmtpConnection() {
    setTestingSmtp(true)
    try {
      await emailApi.test(smtp)
      showToast('Connexion SMTP OK')
    } catch (err) {
      showToast('Erreur SMTP : ' + err.message, 'error')
    } finally {
      setTestingSmtp(false)
    }
  }

  const TABS = [
    { id: 'profile', label: 'Profil' },
    { id: 'api', label: 'Clés API & Email' },
    { id: 'capture', label: 'Capture' },
  ]

  return (
    <div className="max-w-2xl mx-auto py-6 animate-fade-in-up">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-16 right-5 z-50 px-5 py-3.5 rounded-xl text-sm font-medium"
          style={{
            background: toast.type === 'error' ? 'rgba(255,68,102,0.15)' : 'rgba(0,255,136,0.12)',
            border: toast.type === 'error' ? '1px solid rgba(255,68,102,0.4)' : '1px solid rgba(0,255,136,0.3)',
            color: toast.type === 'error' ? '#ff6688' : '#00ff88',
            backdropFilter: 'blur(12px)',
          }}
        >
          {toast.msg}
        </div>
      )}

      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm transition-colors"
          style={{ color: '#444466' }}
          onMouseEnter={e => e.currentTarget.style.color = '#f0f0ff'}
          onMouseLeave={e => e.currentTarget.style.color = '#444466'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Retour
        </button>
        <h1 className="font-display text-2xl font-bold" style={{ color: '#f0f0ff' }}>Paramètres</h1>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {/* Profile tab */}
      {tab === 'profile' && (
        <GlassPanel className="space-y-5">
          <Field label="Nom du formateur">
            <input className="neon-input" value={profile.trainerName} onChange={e => setProfile(p => ({ ...p, trainerName: e.target.value }))} placeholder="Prénom Nom" />
          </Field>
          <Field label="Email expéditeur">
            <input className="neon-input" type="email" value={profile.trainerEmail} onChange={e => setProfile(p => ({ ...p, trainerEmail: e.target.value }))} placeholder="vous@exemple.fr" />
          </Field>
          <Field label="Organisation / Centre de formation">
            <input className="neon-input" value={profile.organization} onChange={e => setProfile(p => ({ ...p, organization: e.target.value }))} placeholder="Centre de formation XYZ" />
          </Field>
        </GlassPanel>
      )}

      {/* API tab */}
      {tab === 'api' && (
        <div className="space-y-5">
          <GlassPanel>
            <h3 className="text-sm font-bold mb-4" style={{ color: '#f0f0ff' }}>OpenAI</h3>
            <Field label="Clé API OpenAI" help="Votre clé commence par sk-. Elle est stockée dans le trousseau macOS.">
              <div className="flex gap-2">
                <input
                  className="neon-input flex-1"
                  type="password"
                  value={openaiKey}
                  onChange={e => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                />
                <NeonButton variant="ghost" size="sm" onClick={testOpenai} loading={testingOpenai}>
                  Tester
                </NeonButton>
              </div>
            </Field>
          </GlassPanel>

          <GlassPanel>
            <h3 className="text-sm font-bold mb-4" style={{ color: '#f0f0ff' }}>Envoi d'email</h3>
            <div className="flex gap-3 mb-5">
              {['resend', 'smtp'].map(p => (
                <button
                  key={p}
                  onClick={() => setEmailProvider(p)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: emailProvider === p ? 'rgba(0,128,255,0.15)' : 'rgba(255,255,255,0.03)',
                    border: emailProvider === p ? '1px solid rgba(0,128,255,0.4)' : '1px solid rgba(255,255,255,0.06)',
                    color: emailProvider === p ? '#60a5fa' : '#333355',
                  }}
                >
                  {p === 'resend' ? 'Resend (recommandé)' : 'SMTP personnalisé'}
                </button>
              ))}
            </div>

            {emailProvider === 'resend' ? (
              <div className="space-y-4">
                <Field label="Clé API Resend" help="Créez un compte gratuit sur resend.com">
                  <input className="neon-input" type="password" value={resendKey} onChange={e => setResendKey(e.target.value)} placeholder="re_..." />
                </Field>
                <Field label="Email expéditeur vérifié" help="L'email doit être vérifié dans votre compte Resend">
                  <input className="neon-input" type="email" value={smtp.fromEmail} onChange={e => setSmtp(s => ({ ...s, fromEmail: e.target.value }))} placeholder="formations@exemple.fr" />
                </Field>
                <Field label="Nom de l'expéditeur">
                  <input className="neon-input" value={smtp.fromName} onChange={e => setSmtp(s => ({ ...s, fromName: e.target.value }))} placeholder="CACES Assistant" />
                </Field>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Field label="Serveur SMTP">
                      <input className="neon-input" value={smtp.host} onChange={e => setSmtp(s => ({ ...s, host: e.target.value }))} placeholder="smtp.gmail.com" />
                    </Field>
                  </div>
                  <Field label="Port">
                    <input className="neon-input" type="number" value={smtp.port} onChange={e => setSmtp(s => ({ ...s, port: parseInt(e.target.value) }))} />
                  </Field>
                </div>
                <Field label="Utilisateur">
                  <input className="neon-input" type="email" value={smtp.user} onChange={e => setSmtp(s => ({ ...s, user: e.target.value }))} placeholder="vous@exemple.fr" />
                </Field>
                <Field label="Email expéditeur">
                  <input className="neon-input" type="email" value={smtp.fromEmail} onChange={e => setSmtp(s => ({ ...s, fromEmail: e.target.value }))} placeholder="formations@exemple.fr" />
                </Field>
                <div className="flex justify-end">
                  <NeonButton variant="ghost" size="sm" onClick={testSmtpConnection} loading={testingSmtp}>
                    Tester la connexion
                  </NeonButton>
                </div>
              </div>
            )}
          </GlassPanel>
        </div>
      )}

      {/* Capture tab */}
      {tab === 'capture' && (
        <GlassPanel className="space-y-6">
          <Field
            label="Fréquence des captures d'écran"
            help={`Une capture toutes les ${captureConfig.screenshotInterval} secondes`}
          >
            <div className="flex gap-2 mt-1">
              {[15, 30, 60, 120].map(v => (
                <button
                  key={v}
                  onClick={() => setCaptureConfig(c => ({ ...c, screenshotInterval: v }))}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: captureConfig.screenshotInterval === v ? 'rgba(0,128,255,0.15)' : 'rgba(255,255,255,0.03)',
                    border: captureConfig.screenshotInterval === v ? '1px solid rgba(0,128,255,0.4)' : '1px solid rgba(255,255,255,0.06)',
                    color: captureConfig.screenshotInterval === v ? '#60a5fa' : '#333355',
                  }}
                >
                  {v < 60 ? `${v}s` : `${v / 60}min`}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label={`Sensibilité de détection de changement : ${captureConfig.changeThreshold}%`}
            help="Seuil de différence visuelle pour sauvegarder une nouvelle capture"
          >
            <input
              type="range"
              min={1}
              max={20}
              value={captureConfig.changeThreshold}
              onChange={e => setCaptureConfig(c => ({ ...c, changeThreshold: parseInt(e.target.value) }))}
              className="w-full mt-2"
              style={{ accentColor: '#0080ff' }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: '#333355' }}>
              <span>Sensible (1%)</span><span>Tolérant (20%)</span>
            </div>
          </Field>

          <Field label="Durée des segments audio" help="Chaque segment est sauvegardé indépendamment (protection contre les crashs)">
            <div className="flex gap-2 mt-1">
              {[30, 60, 120].map(v => (
                <button
                  key={v}
                  onClick={() => setCaptureConfig(c => ({ ...c, audioChunkDuration: v }))}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: captureConfig.audioChunkDuration === v ? 'rgba(0,128,255,0.15)' : 'rgba(255,255,255,0.03)',
                    border: captureConfig.audioChunkDuration === v ? '1px solid rgba(0,128,255,0.4)' : '1px solid rgba(255,255,255,0.06)',
                    color: captureConfig.audioChunkDuration === v ? '#60a5fa' : '#333355',
                  }}
                >
                  {v < 60 ? `${v}s` : `${v / 60}min`}
                </button>
              ))}
            </div>
          </Field>
        </GlassPanel>
      )}

      {/* Save */}
      <div className="mt-6 flex justify-end">
        <NeonButton onClick={saveAll} loading={saving} size="md">
          Sauvegarder
        </NeonButton>
      </div>
    </div>
  )
}
