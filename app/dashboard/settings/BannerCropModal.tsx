'use client'

import { useCallback, useEffect, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { createClient } from '@/lib/supabase'

// The banner renders at 3:1 on the public page (matches the "1200x400 or similar" guidance).
export const BANNER_ASPECT = 3 / 1
const MAX_OUTPUT_WIDTH = 2000

async function croppedJpegBlob(src: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Could not read the image.'))
    i.src = src
  })

  const scale = area.width > MAX_OUTPUT_WIDTH ? MAX_OUTPUT_WIDTH / area.width : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(area.width * scale)
  canvas.height = Math.round(area.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process the image.')
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not process the image.'))), 'image/jpeg', 0.9)
  })
}

export default function BannerCropModal({ file, orgId, onDone, onCancel }: {
  file: File
  orgId: string
  onDone: (url: string) => void
  onCancel: () => void
}) {
  const [src, setSrc] = useState('')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const onCropComplete = useCallback((_: Area, px: Area) => setArea(px), [])

  const save = async () => {
    if (!area) return
    setBusy(true)
    setError('')
    try {
      const blob = await croppedJpegBlob(src, area)
      const supabase = createClient()
      const path = `org-banners/${orgId}-${Date.now()}.jpg`
      const { data, error: upErr } = await supabase.storage
        .from('teacher-photos')
        .upload(path, blob, { upsert: false, contentType: 'image/jpeg' })
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
      const { data: { publicUrl } } = supabase.storage.from('teacher-photos').getPublicUrl(data.path)
      onDone(publicUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the banner.')
      setBusy(false)
    }
  }

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '24px' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '640px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Position your banner</h2>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}>×</button>
        </div>
        <p style={{ fontSize: '13px', color: '#666', margin: '0 0 16px' }}>Drag to reposition, and use the slider to zoom. This is the exact area members will see.</p>

        <div style={{ position: 'relative', width: '100%', aspectRatio: '3 / 1', backgroundColor: '#1a1a1a', borderRadius: '8px', overflow: 'hidden' }}>
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={BANNER_ASPECT}
              objectFit="cover"
              showGrid={false}
              minZoom={1}
              maxZoom={3}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
          <span style={{ fontSize: '13px', color: '#666' }}>Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            style={{ flex: 1 }}
          />
        </div>

        {error && (
          <div style={{ padding: '12px', backgroundColor: '#fdecea', borderRadius: '8px', color: '#8b1a1a', fontSize: '13px', marginTop: '14px' }}>{error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
          <button
            onClick={onCancel}
            style={{ padding: '9px 18px', backgroundColor: 'transparent', border: '1px solid #e2e2e2', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#444', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy || !area}
            style={{ padding: '9px 20px', backgroundColor: busy || !area ? '#9fd6b8' : '#085041', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: busy || !area ? 'default' : 'pointer' }}
          >
            {busy ? 'Saving…' : 'Save banner'}
          </button>
        </div>
      </div>
    </div>
  )
}
