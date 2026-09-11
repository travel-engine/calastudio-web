'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import styles from './photofirst.module.css'
import type { GalleryImage } from './studioContent'

// Square photo grid + full-screen lightbox. Click a tile to open; click anywhere / Escape to
// close; ←/→ to page (handoff §Lightbox). Mirrors teachers/PhotoGallery.tsx's keyboard behaviour.
export default function Gallery({ images, label }: { images: GalleryImage[]; label?: string }) {
  const [open, setOpen] = useState<number | null>(null)

  const close = useCallback(() => setOpen(null), [])
  const page = useCallback(
    (delta: number) => setOpen(i => (i === null ? i : (i + delta + images.length) % images.length)),
    [images.length],
  )

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') page(1)
      else if (e.key === 'ArrowLeft') page(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close, page])

  if (images.length === 0) return null

  return (
    <>
      {label && <p className={styles.galleryLabel}>{label}</p>}
      <div className={styles.gallery}>
        {images.map((img, i) => (
          <button key={img.url + i} type="button" className={styles.galleryTile} onClick={() => setOpen(i)}>
            <Image src={img.url} alt={img.alt} width={320} height={320} sizes="(max-width: 700px) 45vw, 220px" />
          </button>
        ))}
      </div>

      {open !== null && (
        <div role="dialog" aria-modal="true" aria-label="Photo" className={styles.lightbox} onClick={close}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[open].url} alt={images[open].alt} className={styles.lightboxImg} />
          <button type="button" aria-label="Close" onClick={close} className={styles.lightboxClose}>✕</button>
        </div>
      )}
    </>
  )
}
