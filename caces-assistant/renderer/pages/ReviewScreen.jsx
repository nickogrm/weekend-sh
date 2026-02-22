import React, { useState } from 'react'
import GlassPanel from '../components/GlassPanel.jsx'
import NeonButton from '../components/NeonButton.jsx'
import { emailApi, exportPdf, appApi } from '../lib/ipc.js'
import { generateEmailHtml } from '../lib/htmlTemplate.js'

function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#444466', letterSpacing: '0.12em' }}>
      {children}
    </h2>
  )
}

function EditableList({ items, onChange, placeholder }) {
  function update(i, val) {
    const next = [...items]
    next[i] = val
    onChange(next)
  }
  function remove(i) {
    onChange(items.filter((_, idx) => idx !== i))
  }
  function add() {
    onChange([...items, ''])
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          <input
            className="neon-input flex-1 text-sm py-2.5"
            value={item}
            placeholder={placeholder}
            onChange={e => update(i, e.target.value)}
          />
          <button
            onClick={() => remove(i)}
            className="mt-2 text-sm"
            style={{ color: '#333355' }}
            onMouseEnter={e => e.currentTarget.style.color = '#ff4466'}
            onMouseLeave={e => e.currentTarget.style.color = '#333355'}
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="text-xs flex items-center gap-1.5 mt-1 transition-colors"
        style={{ color: '#333355' }}
        onMouseEnter={e => e.currentTarget.style.color = '#0080ff'}
        onMouseLeave={e => e.currentTarget.style.color = '#333355'}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Ajouter
      </button>
    </div>
  )
}

export default function ReviewScreen({ session, onNewSession }) {
  const [summary, setSummary] = useState(session.summary || {})
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [toast, setToast] = useState(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  function set(key, val) {
    setSummary(s => ({ ...s, [key]: val }))
  }

  function updateKeyPoint(i, field, val) {
    const kps = [...(summary.keyPoints || [])]
    kps[i] = { ...kps[i], [field]: val }
    set('keyPoints', kps)
  }

  function removeKeyPoint(i) {
    set('keyPoints', (summary.keyPoints || []).filter((_, idx) => idx !== i))
  }

  function addKeyPoint() {
    set('keyPoints', [...(summary.keyPoints || []), { topic: '', content: '', regulation: '' }])
  }

  async function handleExportPdf() {
    setIsExportingPdf(true)
    try {
      const html = generateEmailHtml({ sessionMetadata: session.metadata, summary })
      const pdfPath = await exportPdf(session.id, html)
      await appApi.openSessionFolder(session.id)
      showToast('PDF exporté avec succès')
    } catch (err) {
      showToast('Erreur lors de l\'export PDF : ' + err.message, 'error')
    } finally {
      setIsExportingPdf(false)
    }
  }

  async function handleSendEmail() {
    setIsSendingEmail(true)
    try {
      const html = generateEmailHtml({ sessionMetadata: session.metadata, summary })
      let pdfPath
      try {
        pdfPath = await exportPdf(session.id, html)
      } catch {}

      await emailApi.send({
        sessionId: session.id,
        to: session.metadata.participantEmails,
        subject: `Compte-rendu formation – ${session.metadata.title}`,
        htmlBody: html,
        pdfPath,
      })
      showToast(`Email envoyé à ${session.metadata.participantEmails.length} participant(s)`)
    } catch (err) {
      showToast('Erreur envoi email : ' + err.message, 'error')
    } finally {
      setIsSendingEmail(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-5 animate-fade-in-up">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-16 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium shadow-xl"
          style={{
            background: toast.type === 'error' ? 'rgba(255,68,102,0.15)' : 'rgba(0,255,136,0.12)',
            border: toast.type === 'error' ? '1px solid rgba(255,68,102,0.4)' : '1px solid rgba(0,255,136,0.3)',
            color: toast.type === 'error' ? '#ff6688' : '#00ff88',
            backdropFilter: 'blur(12px)',
          }}
        >
          {toast.type === 'error'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          }
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold mb-1" style={{ color: '#f0f0ff' }}>
            Résumé de formation
          </h1>
          <p className="text-sm" style={{ color: '#444466' }}>{session.metadata.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-3 py-1 rounded-full font-medium"
            style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.25)', color: '#00ff88' }}
          >
            ✓ Généré
          </span>
        </div>
      </div>

      {/* Executive Summary */}
      <GlassPanel glowColor="0,128,255">
        <SectionTitle>Résumé exécutif</SectionTitle>
        <textarea
          className="neon-input text-sm leading-relaxed resize-none w-full"
          rows={4}
          value={summary.executiveSummary || ''}
          onChange={e => set('executiveSummary', e.target.value)}
          placeholder="Résumé de la session..."
        />
      </GlassPanel>

      {/* Objectives */}
      <GlassPanel>
        <SectionTitle>Objectifs pédagogiques</SectionTitle>
        <EditableList
          items={summary.pedagogicalObjectives || []}
          onChange={v => set('pedagogicalObjectives', v)}
          placeholder="Objectif..."
        />
      </GlassPanel>

      {/* Key Points */}
      <GlassPanel>
        <SectionTitle>Points clés abordés</SectionTitle>
        <div className="space-y-4">
          {(summary.keyPoints || []).map((kp, i) => (
            <div
              key={i}
              className="p-4 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div className="flex gap-2 mb-2">
                <input
                  className="neon-input text-sm py-2 font-medium flex-1"
                  placeholder="Sujet / Titre"
                  value={kp.topic || ''}
                  onChange={e => updateKeyPoint(i, 'topic', e.target.value)}
                />
                <input
                  className="neon-input text-xs py-2 w-32"
                  placeholder="Référence (R489...)"
                  value={kp.regulation || ''}
                  onChange={e => updateKeyPoint(i, 'regulation', e.target.value)}
                />
                <button
                  onClick={() => removeKeyPoint(i)}
                  className="px-2 text-sm"
                  style={{ color: '#333355' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ff4466'}
                  onMouseLeave={e => e.currentTarget.style.color = '#333355'}
                >×</button>
              </div>
              <textarea
                className="neon-input text-sm leading-relaxed resize-none w-full"
                rows={2}
                placeholder="Contenu..."
                value={kp.content || ''}
                onChange={e => updateKeyPoint(i, 'content', e.target.value)}
              />
            </div>
          ))}
          <button
            onClick={addKeyPoint}
            className="text-xs flex items-center gap-1.5 mt-1 transition-colors"
            style={{ color: '#333355' }}
            onMouseEnter={e => e.currentTarget.style.color = '#0080ff'}
            onMouseLeave={e => e.currentTarget.style.color = '#333355'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Ajouter un point
          </button>
        </div>
      </GlassPanel>

      {/* Recommendations */}
      <GlassPanel>
        <SectionTitle>Recommandations</SectionTitle>
        <EditableList
          items={summary.recommendations || []}
          onChange={v => set('recommendations', v)}
          placeholder="Recommandation..."
        />
      </GlassPanel>

      {/* Evaluation points */}
      {(summary.evaluationPoints || []).length > 0 && (
        <GlassPanel>
          <SectionTitle>Points d'évaluation</SectionTitle>
          <EditableList
            items={summary.evaluationPoints || []}
            onChange={v => set('evaluationPoints', v)}
            placeholder="Point d'évaluation..."
          />
        </GlassPanel>
      )}

      {/* Actions */}
      <div
        className="sticky bottom-0 pt-4 pb-2"
        style={{ background: 'linear-gradient(to top, #0a0a0f 70%, transparent)' }}
      >
        <div className="grid grid-cols-3 gap-3">
          <NeonButton
            variant="secondary"
            onClick={onNewSession}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.2"/>
            </svg>
            Nouvelle
          </NeonButton>

          <NeonButton
            variant="ghost"
            onClick={handleExportPdf}
            loading={isExportingPdf}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            Export PDF
          </NeonButton>

          <NeonButton
            onClick={handleSendEmail}
            loading={isSendingEmail}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            Envoyer
          </NeonButton>
        </div>
        <p className="text-xs text-center mt-2" style={{ color: '#222240' }}>
          Envoi à {session.metadata.participantEmails.length} participant(s)
        </p>
      </div>
    </div>
  )
}
