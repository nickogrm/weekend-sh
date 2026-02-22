import React from 'react'

export default function GlassPanel({ children, className = '', glowColor = null, noPadding = false }) {
  return (
    <div
      className={`rounded-2xl border ${noPadding ? '' : 'p-6'} ${className}`}
      style={{
        background: 'rgba(15, 15, 26, 0.7)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderColor: glowColor ? `rgba(${glowColor}, 0.3)` : 'rgba(255,255,255,0.06)',
        boxShadow: glowColor
          ? `0 0 40px rgba(${glowColor}, 0.08), inset 0 1px 0 rgba(255,255,255,0.05)`
          : 'inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {children}
    </div>
  )
}
