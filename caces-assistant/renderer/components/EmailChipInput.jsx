import React, { useState, useRef } from 'react'

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function EmailChipInput({ value = [], onChange, placeholder = 'nom@exemple.fr' }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  function addEmail(raw) {
    const emails = raw.split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean)
    const valid = []
    const invalid = []

    for (const email of emails) {
      if (isValidEmail(email) && !value.includes(email)) {
        valid.push(email)
      } else if (!isValidEmail(email)) {
        invalid.push(email)
      }
    }

    if (valid.length > 0) onChange([...value, ...valid])
    if (invalid.length > 0) {
      setError(`Email invalide : ${invalid.join(', ')}`)
      setTimeout(() => setError(''), 3000)
    }
    setInput('')
  }

  function removeEmail(email) {
    onChange(value.filter(e => e !== email))
  }

  function handleKeyDown(e) {
    if (['Enter', ',', ';', ' ', 'Tab'].includes(e.key)) {
      e.preventDefault()
      if (input.trim()) addEmail(input)
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeEmail(value[value.length - 1])
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text')
    addEmail(pasted)
  }

  return (
    <div>
      <div
        className="min-h-[52px] rounded-xl border p-3 flex flex-wrap gap-2 cursor-text"
        style={{
          background: '#0d0d1f',
          borderColor: error ? 'rgba(255,68,102,0.5)' : 'rgba(30,32,64,0.8)',
          transition: 'border-color 0.2s',
        }}
        onClick={() => inputRef.current?.focus()}
        onFocus={() => {}}
      >
        {value.map(email => (
          <div
            key={email}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
            style={{
              background: 'rgba(0,128,255,0.12)',
              border: '1px solid rgba(0,128,255,0.3)',
              color: '#60a5fa',
            }}
          >
            {email}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeEmail(email) }}
              className="text-blue-400 hover:text-white transition-colors ml-0.5"
              style={{ lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => { setInput(e.target.value); setError('') }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => { if (input.trim()) addEmail(input) }}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[180px] bg-transparent outline-none text-sm"
          style={{ color: '#f0f0ff' }}
        />
      </div>
      {error && (
        <p className="mt-1 text-xs" style={{ color: '#ff4466' }}>{error}</p>
      )}
      {value.length > 0 && (
        <p className="mt-1.5 text-xs" style={{ color: '#444466' }}>
          {value.length} participant{value.length > 1 ? 's' : ''} · Appuyez sur Entrée ou virgule pour ajouter
        </p>
      )}
      {value.length === 0 && (
        <p className="mt-1.5 text-xs" style={{ color: '#444466' }}>
          Séparez les emails par Entrée, virgule ou espace
        </p>
      )}
    </div>
  )
}
