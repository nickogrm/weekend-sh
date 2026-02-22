import React, { useEffect, useRef } from 'react'

const BAR_COUNT = 32

const BASE_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) =>
  20 + Math.abs(Math.sin(i * 0.6)) * 32 + Math.abs(Math.sin(i * 0.3)) * 16
)

export default function WaveformBars({ isActive, audioLevel = 1, size = 'md' }) {
  const heightMap = size === 'sm' ? 0.5 : 1

  return (
    <div className="flex items-end justify-center gap-[3px]" style={{ height: size === 'sm' ? 32 : 60 }}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const delay = (i / BAR_COUNT) * 1.2
        const baseH = BASE_HEIGHTS[i] * heightMap * (0.5 + audioLevel * 0.5)
        return (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: size === 'sm' ? 3 : 4,
              height: `${baseH}px`,
              background: `linear-gradient(to top, #0080ff, #00f5ff)`,
              boxShadow: isActive ? '0 0 6px rgba(0,245,255,0.5)' : 'none',
              animation: isActive ? `waveform 1.2s ease-in-out ${delay}s infinite` : 'none',
              transform: isActive ? undefined : 'scaleY(0.2)',
              opacity: isActive ? 1 : 0.25,
              transition: 'opacity 0.3s ease',
              transformOrigin: 'bottom',
            }}
          />
        )
      })}
    </div>
  )
}
