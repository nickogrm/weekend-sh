import React from 'react'

export default function NeonButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  type = 'button',
}) {
  const sizeClasses = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-8 py-3.5 text-sm',
    lg: 'px-10 py-4 text-base',
  }

  const variantStyles = {
    primary: {
      background: disabled ? 'rgba(0,128,255,0.2)' : 'linear-gradient(135deg, #0080ff 0%, #00c8ff 100%)',
      boxShadow: disabled ? 'none' : '0 0 20px rgba(0,128,255,0.4)',
      color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
      border: 'none',
    },
    ghost: {
      background: 'transparent',
      border: '1px solid rgba(0,245,255,0.3)',
      color: disabled ? 'rgba(0,245,255,0.3)' : '#00f5ff',
      boxShadow: 'none',
    },
    danger: {
      background: disabled ? 'rgba(255,68,102,0.2)' : 'linear-gradient(135deg, #ff4466 0%, #ff6688 100%)',
      boxShadow: disabled ? 'none' : '0 0 20px rgba(255,68,102,0.4)',
      color: '#fff',
      border: 'none',
    },
    secondary: {
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      color: 'rgba(255,255,255,0.7)',
      boxShadow: 'none',
    },
  }

  const style = variantStyles[variant]

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        relative inline-flex items-center justify-center gap-2 font-semibold tracking-wide uppercase rounded-xl
        transition-all duration-200 cursor-pointer select-none
        ${disabled || loading ? 'cursor-not-allowed' : 'hover:-translate-y-0.5 active:translate-y-0'}
        ${sizeClasses[size]}
        ${className}
      `}
      style={{
        ...style,
        ...((!disabled && !loading && variant === 'primary') ? {
          transition: 'all 0.2s ease',
        } : {}),
      }}
      onMouseEnter={(e) => {
        if (disabled || loading) return
        if (variant === 'primary') {
          e.currentTarget.style.boxShadow = '0 0 40px rgba(0,128,255,0.7), 0 0 80px rgba(0,128,255,0.3)'
        } else if (variant === 'ghost') {
          e.currentTarget.style.background = 'rgba(0,245,255,0.05)'
          e.currentTarget.style.boxShadow = '0 0 20px rgba(0,245,255,0.2)'
        }
      }}
      onMouseLeave={(e) => {
        if (disabled || loading) return
        if (variant === 'primary') {
          e.currentTarget.style.boxShadow = '0 0 20px rgba(0,128,255,0.4)'
        } else if (variant === 'ghost') {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.boxShadow = 'none'
        }
      }}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
