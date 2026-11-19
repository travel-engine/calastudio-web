'use client'

import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// A password box with an eye button at the end that shows / hides what was typed. Members on
// phones kept mistyping one of the two password boxes and couldn't see why they didn't match.
// Takes the usual <input> props; `style` applies to the input itself.
export default function PasswordInput({ style, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input {...props} type={visible ? 'text' : 'password'} style={{ ...style, paddingRight: '44px' }} />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          color: 'inherit',
          opacity: 0.6,
          cursor: 'pointer',
        }}
      >
        {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  )
}
