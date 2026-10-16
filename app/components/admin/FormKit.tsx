'use client'

import { Children, cloneElement, isValidElement, useId, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { color, radius, space, tabularNums } from '@/lib/ui/tokens'
import { controlStyle } from './Field'
import ui from './admin.module.css'

// Drop-in replacements for the older pages' local Field / Input / Select / Textarea / SectionHeader /
// ToggleGroup helpers, so those long forms take the admin look without rewriting their logic.

/** Label + hint + control. A single text control child gets an id, so the label is a real one. */
export function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const id = useId()
  const only = Children.count(children) === 1 && isValidElement(children) ? (children as ReactElement<{ id?: string; 'aria-describedby'?: string }>) : null
  const labellable = only && [TextInput, SelectInput, TextArea].includes(only.type as never)
  const controlId = labellable ? (only!.props.id ?? id) : undefined
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: space.formGap, minWidth: 0 }}>
      {labellable
        ? <label htmlFor={controlId} style={{ fontSize: 14, fontWeight: 600, color: color.ink }}>{label}</label>
        : <span style={{ fontSize: 14, fontWeight: 600, color: color.ink }}>{label}</span>}
      {labellable ? cloneElement(only!, { id: controlId, 'aria-describedby': hint ? `${controlId}-hint` : undefined }) : children}
      {hint && <span id={controlId ? `${controlId}-hint` : undefined} style={{ fontSize: 13, lineHeight: 1.4, color: color.muted }}>{hint}</span>}
    </div>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...controlStyle, ...(props.type === 'number' ? tabularNums : {}), ...props.style }} />
}

export function SelectInput({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...controlStyle, cursor: 'pointer', ...props.style }}>{children}</select>
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...controlStyle, padding: '10px 12px', minHeight: 96, resize: 'vertical', lineHeight: 1.5, ...props.style }} />
}

/** Section heading inside a form card; the first one sits flush with the card top. */
export function FormSection({ title, description }: { title: string; description?: string }) {
  return (
    <div className={ui.formSection} style={{ margin: '8px 0 16px', paddingTop: 20, borderTop: `1px solid ${color.divider}` }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: color.ink }}>{title}</h2>
      {description && <p style={{ margin: '4px 0 0', fontSize: 14, color: color.muted, lineHeight: 1.45 }}>{description}</p>}
    </div>
  )
}

/** Mutually exclusive options as pressed/unpressed buttons. */
export function ChoiceGroup<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label?: string
}) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => <OptionButton key={opt.value} on={value === opt.value} onClick={() => onChange(opt.value)} grow>{opt.label}</OptionButton>)}
    </div>
  )
}

/** One option button — used by ChoiceGroup, and on its own for multi-select chips. */
export function OptionButton({ on, onClick, children, grow = false, style }: { on: boolean; onClick: () => void; children: ReactNode; grow?: boolean; style?: CSSProperties }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`${ui.button} ${ui.focusable}`}
      style={{
        flex: grow ? '1 1 140px' : 'none', minHeight: space.target, padding: '0 16px', borderRadius: radius.control, cursor: 'pointer',
        border: `1px solid ${on ? color.primary : color.control}`, background: on ? color.primarySoft : color.surface,
        color: on ? color.primaryInk : color.ink2, fontFamily: 'inherit', fontSize: 15, fontWeight: on ? 600 : 500,
        ['--hover-bg' as string]: on ? color.primarySoft : color.bg, ['--hover-border' as string]: on ? color.primary : color.control,
        ...style,
      }}>
      {children}
    </button>
  )
}
