'use client'
import { useRef, useState } from 'react'
import Tooltip from "./Tooltip";

interface InputBarProps {
  currentMessage: string
  setCurrentMessage: (val: string) => void
  onSubmit: (e: React.FormEvent) => void
  onFileSelect?: (file: File) => void
  uploading?: boolean
  disabled?: boolean
}

const InputBar = ({
  currentMessage,
  setCurrentMessage,
  onSubmit,
  onFileSelect,
  uploading = false,
  disabled = false,
}: InputBarProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [attachHover, setAttachHover] = useState(false)
  const [sendHover, setSendHover] = useState(false)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit(e as any)
    }
  }

  const canSend = currentMessage.trim() && !disabled

  return (
    <div style={{
      padding: '12px 16px 16px',
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border-subtle)',
      flexShrink: 0,
    }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && onFileSelect) onFileSelect(file)
          e.target.value = ''
        }}
      />

      {/* Input pill */}
      <div
        className="input-glow"
        style={{
          display: 'flex', alignItems: 'center',
          background: 'var(--bg-input)',
          borderRadius: 'var(--radius-full)',
          border: `1.5px solid ${focused ? 'var(--accent-blue)' : 'var(--border-medium)'}`,
          padding: '6px 6px 6px 8px',
          transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
          boxShadow: focused ? '0 0 0 3px rgba(26,115,232,0.12)' : 'var(--shadow-sm)',
        }}
      >
        {/* Attach button — Fitts's Law: 44px target */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || disabled}
          title="Upload PDF, DOCX, or TXT"
          aria-label="Attach a document"
          onMouseEnter={() => setAttachHover(true)}
          onMouseLeave={() => setAttachHover(false)}
          style={{
            width: 44, height: 44,
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: attachHover && !uploading && !disabled ? 'var(--bg-surface-3)' : 'transparent',
            color: uploading ? 'var(--accent-blue)' : 'var(--text-secondary)',
            cursor: (uploading || disabled) ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.4 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            transition: 'background var(--transition-fast), color var(--transition-fast)',
          }}
        >
          {uploading ? (
            /* Spinning loader */
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ animation: 'spin 0.8s linear infinite' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          )}
        </button>

        {/* Text input */}
        <input
          type="text"
          placeholder={disabled ? 'Loading conversation…' : uploading ? 'Uploading document…' : 'Ask your Gyaankosh assistant anything…'}
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          aria-label="Message input"
          style={{
            flex: 1,
            padding: '8px 12px',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 15,
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />

        {/* Send button — Fitts's Law: 44px target, always visible */}
        <button
          type="button"
          onClick={() => canSend && onSubmit({} as React.FormEvent)}
          disabled={!canSend}
          title="Send message (Enter)"
          aria-label="Send message"
          onMouseEnter={() => setSendHover(true)}
          onMouseLeave={() => setSendHover(false)}
          style={{
            width: 44, height: 44,
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: canSend
              ? (sendHover ? '#1557b0' : 'var(--accent-blue)')
              : 'var(--bg-surface-3)',
            color: canSend ? '#fff' : 'var(--text-tertiary)',
            cursor: canSend ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            transition: 'background var(--transition-fast), transform var(--transition-fast)',
            transform: canSend && sendHover ? 'scale(1.05)' : 'scale(1)',
            boxShadow: canSend ? '0 2px 8px rgba(26,115,232,0.35)' : 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>

      {/* Helper hint */}
      <p style={{
        fontSize: 11, color: 'var(--text-tertiary)',
        textAlign: 'center', marginTop: 8, marginBottom: 0,
        letterSpacing: '0.01em',
      }}>
        Press <kbd style={{
          fontSize: 10, padding: '1px 5px',
          borderRadius: 4, border: '1px solid var(--border-medium)',
          background: 'var(--bg-surface-3)',
          color: 'var(--text-secondary)',
          fontFamily: 'monospace',
        }}>Enter</kbd> to send · <kbd style={{
          fontSize: 10, padding: '1px 5px',
          borderRadius: 4, border: '1px solid var(--border-medium)',
          background: 'var(--bg-surface-3)',
          color: 'var(--text-secondary)',
          fontFamily: 'monospace',
        }}>Shift+Enter</kbd> for newline · Attach PDF, DOCX, or TXT
      </p>
    </div>
  )
}

export default InputBar
