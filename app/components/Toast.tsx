'use client'

import { useEffect, useRef } from 'react'

interface Props {
  message: string
  onDismiss: () => void
  duration?: number
}

// Minimal transient confirmation — a centred pill at the bottom of the viewport that clears
// itself after `duration`. Render with an empty `message` when there's nothing to show.
// There's no toast library in the repo; this is deliberately small and dependency-free.
export default function Toast({ message, onDismiss, duration = 3500 }: Props) {
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!message) return
    const id = setTimeout(() => onDismissRef.current(), duration)
    return () => clearTimeout(id)
  }, [message, duration])

  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#1a1a1a',
        color: 'white',
        padding: '12px 20px',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: 500,
        boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
        zIndex: 100,
        maxWidth: '90vw',
      }}
    >
      {message}
    </div>
  )
}
