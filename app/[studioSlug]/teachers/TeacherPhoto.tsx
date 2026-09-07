'use client'

import { useEffect, useState } from 'react'

// The round hero photo on a teacher's landing page — click to see it full size.
export default function TeacherPhoto({ src, alt, size }: { src: string; alt: string; size: number }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <img
        src={src}
        alt={alt}
        onClick={() => setOpen(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, cursor: 'zoom-in' }}
      />
      {open && (
        <div
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} — full size`}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px', cursor: 'zoom-out',
          }}
        >
          <img src={src} alt={alt} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain' }} />
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{ position: 'absolute', top: 16, right: 20, background: 'none', border: 'none', color: 'white', fontSize: '32px', lineHeight: 1, cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}
