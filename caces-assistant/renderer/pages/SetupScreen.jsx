import React, { useState, useEffect } from 'react'
import GlassPanel from '../components/GlassPanel.jsx'
import NeonButton from '../components/NeonButton.jsx'
import EmailChipInput from '../components/EmailChipInput.jsx'
import { store, appApi, session as sessionIpc, keys } from '../lib/ipc.js'

const CACES_CATEGORIES = [
  'CACES R489 – Chariots élévateurs',
  'CACES R490 – Grues auxiliaires',
  'CACES R482 – Engins de chantier',
  'CACES R484 – Ponts roulants',
  'CACES R485 – Chariots de manutention',
  'CACES R486 – Plates-formes élévatrices',
  'CACES R487 – Grues mobiles',
  'CACES R483 – Engins de manutention',
  'Habilitation électrique',
  'SST – Sauveteur Secouriste du Travail',
  'Autre',
]

export default function SetupScreen({ onComplete, onSettings }) {
  const [form, setForm] = useState({
    title: '',
    category: CACES_CATEGORIES[0],
    trainerName: '',
    date: new Date().toISOString().slice(0, 10),
    participantEmails: [],
    micDeviceId: '',
  })
  const [mics, setMics] = useState([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [hasApiKey, setHasApiKey] = useState(null)

  useEffect(() => {
    loadProfile()
    loadMics()
    checkApiKey()
  }, [])

  async function loadProfile() {
    const profile = await store.get('profile') || {}
    setForm(f => ({ ...f, trainerName: profile.trainerName || '' }))
  }

  async function checkApiKey() {
    const key = await keys.get('openai-api-key')
    setHasApiKey(!!key)
  }

  async function loadMics() {
    try {
      await appApi.requestMicAccess()
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(d => d.kind === 'audioinput')
      setMics(audioInputs)
      if (audioInputs.length > 0) {
        setForm(f => ({ ...f, micDeviceId: audioInputs[0].deviceId }))
      }
    } catch (err) {
      console.error('Could not enumerate devices:', err)
    }
  }

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  function validate() {
    const errs = {}
    if (!form.title.trim()) errs.title = 'Le titre est requis'
    if (!form.trainerName.trim()) errs.trainerName = 'Le nom du formateur est requis'
    if (form.participantEmails.length === 0) errs.participantEmails = 'Au moins un participant est requis'
    return errs
  }

  async function handleStart() {
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setLoading(true)
    try {
      const result = await sessionIpc.create({
        title: form.title.trim(),
        category: form.category,
        trainerName: form.trainerName.trim(),
        date: form.date,
        participantEmails: form.participantEmails,
        micDeviceId: form.micDeviceId,
      })
      onComplete({ id: result.id, metadata: form })
    } catch (err) {
      setErrors({ general: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-5 animate-fade-in-up">

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold mb-2" style={{ color: '#f0f0ff' }}>
          Nouvelle session
        </h1>
        <p className="text-sm" style={{ color: '#444466' }}>
          Configurez votre session de formation avant de démarrer l'enregistrement.
        </p>
      </div>

      {/* API Key Warning */}
      {hasApiKey === false && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl text-sm"
          style={{ background: 'rgba(255,170,0,0.08)', border: '1px solid rgba(255,170,0,0.3)', color: '#ffaa00' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            Clé API OpenAI non configurée.{' '}
            <button className="underline" onClick={onSettings}>Configurer dans les paramètres</button>
          </span>
        </div>
      )}

      {/* Formation details */}
      <GlassPanel>
        <div className="space-y-5">
          <div>
            <label className="field-label">Titre de la formation *</label>
            <input
              className="neon-input"
              placeholder="Ex. Formation CACES R489 – Chariots cat. 3"
              value={form.title}
              onChange={e => set('title', e.target.value)}
            />
            {errors.title && <p className="mt-1 text-xs" style={{ color: '#ff4466' }}>{errors.title}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Catégorie</label>
              <select
                className="neon-input"
                value={form.category}
                onChange={e => set('category', e.target.value)}
              >
                {CACES_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Date *</label>
              <input
                className="neon-input"
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="field-label">Nom du formateur *</label>
            <input
              className="neon-input"
              placeholder="Prénom Nom"
              value={form.trainerName}
              onChange={e => set('trainerName', e.target.value)}
            />
            {errors.trainerName && <p className="mt-1 text-xs" style={{ color: '#ff4466' }}>{errors.trainerName}</p>}
          </div>
        </div>
      </GlassPanel>

      {/* Participants */}
      <GlassPanel glowColor="0,128,255">
        <div>
          <label className="field-label">Emails des participants *</label>
          <EmailChipInput
            value={form.participantEmails}
            onChange={emails => set('participantEmails', emails)}
          />
          {errors.participantEmails && (
            <p className="mt-1 text-xs" style={{ color: '#ff4466' }}>{errors.participantEmails}</p>
          )}
        </div>
      </GlassPanel>

      {/* Mic selector */}
      <GlassPanel>
        <div>
          <label className="field-label">Microphone</label>
          {mics.length > 0 ? (
            <select
              className="neon-input"
              value={form.micDeviceId}
              onChange={e => set('micDeviceId', e.target.value)}
            >
              {mics.map(mic => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          ) : (
            <div
              className="p-3 rounded-xl text-sm"
              style={{ background: 'rgba(255,68,102,0.08)', border: '1px solid rgba(255,68,102,0.2)', color: '#ff6688' }}
            >
              Aucun microphone détecté. Vérifiez les permissions dans les Préférences Système.
            </div>
          )}
          <p className="mt-1.5 text-xs" style={{ color: '#333355' }}>
            La capture d'écran démarre automatiquement toutes les{' '}
            <span style={{ color: '#444466' }}>30 secondes</span>. Configurable dans les paramètres.
          </p>
        </div>
      </GlassPanel>

      {errors.general && (
        <p className="text-sm" style={{ color: '#ff4466' }}>{errors.general}</p>
      )}

      {/* CTA */}
      <div className="pt-2">
        <NeonButton
          size="lg"
          onClick={handleStart}
          loading={loading}
          disabled={hasApiKey === false}
          className="w-full"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.2)" />
            <circle cx="12" cy="12" r="4" />
          </svg>
          Démarrer l'enregistrement
        </NeonButton>
      </div>
    </div>
  )
}
