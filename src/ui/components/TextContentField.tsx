import { useState, useRef, useEffect } from 'react'

interface TextContentFieldProps {
  value: string
  onChange: (value: string) => void
}

/**
 * Text input for the headline. Holds the keystrokes in local state and commits
 * to the store on a short debounce (and on blur), so typing does not re-render
 * the whole control panel or run the render pipeline on every character.
 *
 * Syncs back when `value` changes from outside (shuffle, reset, preset import),
 * distinguished from our own commits via committedRef.
 */
export function TextContentField({ value, onChange }: TextContentFieldProps) {
  const [local, setLocal] = useState(value)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const committedRef = useRef(value)

  useEffect(() => {
    if (value !== committedRef.current) {
      committedRef.current = value
      setLocal(value)
    }
  }, [value])

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  function handleChange(next: string) {
    setLocal(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      committedRef.current = next
      onChange(next)
    }, 120)
  }

  function flush() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (local !== committedRef.current) {
      committedRef.current = local
      onChange(local)
    }
  }

  return (
    <textarea
      id="text-content"
      value={local}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={flush}
      rows={3}
      placeholder={"Type your text…\nEach new line is its own line on the canvas"}
      className="w-full px-3 py-2 text-sm resize-y rounded"
      style={{
        background: '#1e2126',
        border: '1px solid #3a4048',
        borderRadius: '4px',
        color: '#e6e8eb',
        fontFamily: 'var(--font-ui)',
        minHeight: '64px',
      }}
    />
  )
}
