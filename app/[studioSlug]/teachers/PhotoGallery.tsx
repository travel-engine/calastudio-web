'use client'

import { useCallback, useEffect, useState } from 'react'

// Thumbnail grid + a lightbox with prev/next, for a teacher's extra photos.
export default function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [index, setIndex] = useState<number | null>(null)

  const close = useCallback(() => setIndex(null), [])
  const prev = useCallback(() => setIndex(i => (i === null ? i : (i - 1 + photos.length) % photos.length)), [photos.length])
  const next = useCallback(() => setIndex(i => (i === null ? i : (i + 1) % photos.length)), [photos.length])

  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, close, prev, next])

  const arrowBtn: React.CSSProperties = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.4)', border: 'none', color: 'white', fontSize: '28px',
    width: '44px', height: '44px', borderRadius: '50%', cursor: 'pointer', lineHeight: 1,
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
        {photos.map((src, i) => (
          <img
            key={src + i}
            src={src}
            alt={`${alt} — photo ${i + 1}`}
            onClick={() => setIndex(i)}
            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px', cursor: 'zoom-in', display: 'block' }}
          />
        ))}
      </div>

      {index !== null && (
        <div
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} — photo ${index + 1} of ${photos.length}`}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px',
          }}
        >
          <img
            src={photos[index]}
            alt={`${alt} — photo ${index + 1}`}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain' }}
          />
          <button onClick={close} aria-label="Close" style={{ position: 'absolute', top: 16, right: 20, background: 'none', border: 'none', color: 'white', fontSize: '32px', lineHeight: 1, cursor: 'pointer' }}>×</button>
          {photos.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); prev() }} aria-label="Previous" style={{ ...arrowBtn, left: 16 }}>‹</button>
              <button onClick={e => { e.stopPropagation(); next() }} aria-label="Next" style={{ ...arrowBtn, right: 16 }}>›</button>
            </>
          )}
        </div>
      )}
    </>
  )
}
