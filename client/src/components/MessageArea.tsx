'use client'
import React, { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Message, Citation } from '@/types'

function stripFollowUps(content: string): string {
  return content.replace(/\s*FOLLOW_UPS:\s*\[.*?\]\s*$/s, '').trim()
}

// ── Typing animation ──────────────────────────────────────────────────────────
const TypingAnimation = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 2px' }}>
    <span className="gk-dot" />
    <span className="gk-dot" />
    <span className="gk-dot" />
  </div>
)

interface SearchInfo {
  stages?: string[]
  query?: string
  urls?: string[]
  docQuery?: string
  processing?: boolean
}

function SearchStages({ searchInfo }: { searchInfo: SearchInfo }) {
  const stages: React.ReactNode[] = []

  if (searchInfo.query) {
    stages.push(
      <div key="web-action" style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, color: '#f59e0b',
        animation: 'gk-pulse 1.5s ease-in-out infinite',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span>Searching the web for:{' '}<em style={{ fontStyle: 'normal', fontWeight: 600 }}>"{searchInfo.query}"</em></span>
      </div>
    )
  }

  if (searchInfo.docQuery) {
    stages.push(
      <div key="doc-action" style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13, color: '#38bdf8',
        animation: 'gk-pulse 1.5s ease-in-out infinite',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <span>Scanning your uploaded document for:{' '}<em style={{ fontStyle: 'normal', fontWeight: 600 }}>"{searchInfo.docQuery}"</em></span>
      </div>
    )
  }

  if (searchInfo.processing) {
    stages.push(
      <div key="processing" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#a78bfa' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, animation: 'gk-spin 0.9s linear infinite' }}>
          <polyline points="1 4 1 10 7 10"/>
          <path d="M3.51 15a9 9 0 1 0 .49-4"/>
        </svg>
        <span>Reading sources and composing answer…</span>
      </div>
    )
  }

  if (searchInfo.urls && searchInfo.urls.length > 0) {
    stages.push(
      <div key="sources" style={{ marginTop: stages.length ? 8 : 0 }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', margin: '0 0 6px' }}>
          Sources
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {searchInfo.urls.map((url, i) => {
            let hostname = url
            try { hostname = new URL(url).hostname.replace('www.', '') } catch {}
            return (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" title={url}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
                  borderRadius: 'var(--radius-full)', border: '1px solid var(--border-medium)',
                  background: 'var(--bg-surface-3)', color: 'var(--accent-blue)',
                  fontSize: 12, textDecoration: 'none',
                  maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = 'var(--accent-blue-soft)'}
                onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-surface-3)'}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, color: '#f59e0b' }}>
                  <circle cx="12" cy="12" r="10"/>
                </svg>
                {hostname}
              </a>
            )
          })}
        </div>
      </div>
    )
  }

  if (stages.length === 0) return null
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '10px 14px', marginBottom: 10,
      borderRadius: 12, background: 'var(--bg-surface-3)', border: '1px solid var(--border-subtle)',
    }}>
      <style>{`
        @keyframes gk-pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }
        @keyframes gk-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
      {stages}
    </div>
  )
}

const CitationList = ({ citations }: { citations: Citation[] }) => {
  if (!citations?.length) return null
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, marginTop: 0 }}>
        Sources
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {citations.map((c) => {
          let hostname = c.url
          try { hostname = new URL(c.url).hostname.replace('www.', '') } catch {}
          return (
            <a key={c.index} href={c.url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 8, textDecoration: 'none', color: 'var(--accent-blue)', fontSize: 12, transition: 'background var(--transition-fast)' }}
              onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = 'var(--accent-blue-soft)'}
              onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'}
            >
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent-teal-soft)', border: '1px solid var(--accent-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--accent-teal)', flexShrink: 0 }}>
                {c.index}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || hostname}</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}

const FollowUpChips = ({ followUps, onSelect }: { followUps: string[]; onSelect: (q: string) => void }) => {
  if (!followUps?.length) return null
  return (
    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {followUps.map((q, i) => (
        <button key={i} onClick={() => onSelect(q)} title={q}
          style={{
            padding: '6px 14px', borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-medium)', background: 'var(--bg-surface)',
            color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
            cursor: 'pointer', textAlign: 'left', maxWidth: 260,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            transition: 'border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast)',
            minHeight: 32,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-blue)'
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-blue-soft)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-blue)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-medium)'
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
          }}
        >
          {q}
        </button>
      ))}
    </div>
  )
}

const MarkdownContent = ({ content }: { content: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      p: ({ children }) => <p style={{ margin: '0 0 8px', lineHeight: 1.65, fontSize: 14 }}>{children}</p>,
      strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
      em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
      ul: ({ children }) => <ul style={{ margin: '4px 0 8px', paddingLeft: 20, fontSize: 14 }}>{children}</ul>,
      ol: ({ children }) => <ol style={{ margin: '4px 0 8px', paddingLeft: 20, fontSize: 14 }}>{children}</ol>,
      li: ({ children }) => <li style={{ marginBottom: 3, lineHeight: 1.5 }}>{children}</li>,
      code: ({ children, className }) => {
        const isBlock = className?.includes('language-')
        return isBlock ? (
          <pre style={{ background: 'var(--bg-surface-3)', borderRadius: 8, padding: '12px 14px', fontSize: 12, overflowX: 'auto', margin: '8px 0', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-geist-mono), monospace' }}>
            <code>{children}</code>
          </pre>
        ) : (
          <code style={{ background: 'var(--bg-surface-3)', color: 'var(--accent-purple)', padding: '1px 6px', borderRadius: 4, fontSize: '0.85em', fontFamily: 'var(--font-geist-mono), monospace' }}>
            {children}
          </code>
        )
      },
      h1: ({ children }) => <h1 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>{children}</h1>,
      h2: ({ children }) => <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 5, color: 'var(--text-primary)' }}>{children}</h2>,
      h3: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>{children}</h3>,
      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>{children}</a>,
      blockquote: ({ children }) => (
        <blockquote style={{ borderLeft: '3px solid var(--accent-teal)', paddingLeft: 12, marginLeft: 0, color: 'var(--text-secondary)', fontStyle: 'italic', margin: '8px 0' }}>
          {children}
        </blockquote>
      ),
      table: ({ children }) => (
        <div style={{ overflowX: 'auto', margin: '8px 0' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>{children}</table>
        </div>
      ),
      th: ({ children }) => <th style={{ padding: '6px 12px', background: 'var(--bg-surface-3)', borderBottom: '2px solid var(--border-medium)', textAlign: 'left', fontWeight: 600, fontSize: 12 }}>{children}</th>,
      td: ({ children }) => <td style={{ padding: '5px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: 13 }}>{children}</td>,
    }}
  >
    {content}
  </ReactMarkdown>
)

const AIAvatar = () => (
  <div style={{
    width: 32, height: 32, borderRadius: '50%',
    background: 'linear-gradient(135deg, #1a73e8 0%, #0d9488 50%, #7c3aed 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, alignSelf: 'flex-start', marginTop: 2,
  }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
      <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z"/>
    </svg>
  </div>
)

// ── Message action buttons (copy + redo) ──────────────────────────────────────
interface MessageActionsProps {
  content: string
  isUser: boolean
  onRedo?: () => void
}

const MessageActions = ({ content, isUser, onRedo }: MessageActionsProps) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      // Strip markdown for plain-text copy
      const plain = content
        .replace(/#{1,6}\s+/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`{3}[\s\S]*?`{3}/g, (m) => m.replace(/`{3}.*\n?/, '').replace(/`{3}/, ''))
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim()
      await navigator.clipboard.writeText(plain)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select text
    }
  }, [content])

  const btnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-tertiary)',
    padding: '4px 5px',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 500,
    transition: 'background var(--transition-fast), color var(--transition-fast)',
    whiteSpace: 'nowrap',
  }

  return (
    <div
      className="msg-actions"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        marginTop: 5,
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        opacity: 0,
        transition: 'opacity var(--transition-fast)',
      }}
    >
      {/* Copy button */}
      <button
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy text'}
        style={btnStyle}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface-3)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'none'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)'
        }}
      >
        {copied ? (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span style={{ color: '#16a34a' }}>Copied</span>
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span>Copy</span>
          </>
        )}
      </button>

      {/* Redo button */}
      {onRedo && (
        <button
          onClick={onRedo}
          title={isUser ? 'Resend this message' : 'Regenerate response'}
          style={btnStyle}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface-3)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'none'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-4"/>
          </svg>
          <span>{isUser ? 'Resend' : 'Redo'}</span>
        </button>
      )}

      <style>{`
        .msg-row:hover .msg-actions { opacity: 1 !important; }
      `}</style>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
interface MessageAreaProps {
  messages: Message[]
  onFollowUpSelect?: (q: string) => void
  onRedoMessage?: (message: Message) => void
  renderAfterMessage?: (message: Message) => React.ReactNode
}

const MessageArea = ({ messages, onFollowUpSelect, onRedoMessage, renderAfterMessage }: MessageAreaProps) => {
  const bottomRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-base)', minHeight: 0 }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px 16px' }}>
        {messages.map((message) => (
          <React.Fragment key={message.id}>
          <div
            className="msg-row"
            style={{
              display: 'flex',
              justifyContent: message.isUser ? 'flex-end' : 'flex-start',
              marginBottom: 24,
              gap: 10,
            }}
          >
            {!message.isUser && <AIAvatar />}

            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '80%' }}>
              {!message.isUser && message.searchInfo && (
                <SearchStages searchInfo={message.searchInfo as SearchInfo} />
              )}

              {/* Message bubble */}
              <div style={{
                padding: message.isUser ? '10px 16px' : '12px 16px',
                borderRadius: message.isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                background: message.isUser ? 'var(--user-bubble-bg)' : 'var(--ai-bubble-bg)',
                color: message.isUser ? 'var(--user-bubble-text)' : 'var(--text-primary)',
                border: message.isUser ? 'none' : '1px solid var(--ai-bubble-border)',
                boxShadow: message.isUser ? '0 2px 8px rgba(26,115,232,0.25)' : 'var(--shadow-sm)',
                fontSize: 14, lineHeight: 1.6,
              }}>
                {message.isLoading ? (
                  <TypingAnimation />
                ) : message.isUser ? (
                  <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
                ) : (
                  <>
                    <MarkdownContent content={stripFollowUps(message.content || '')} />
                    {message.citations && <CitationList citations={message.citations} />}
                  </>
                )}
              </div>

              {/* Action buttons — shown on row hover */}
              {!message.isLoading && message.content && (
                <MessageActions
                  content={stripFollowUps(message.content)}
                  isUser={message.isUser}
                  onRedo={onRedoMessage ? () => onRedoMessage(message) : undefined}
                />
              )}

              {/* Follow-up chips */}
              {!message.isUser && !message.isLoading && message.followUps && onFollowUpSelect && (
                <FollowUpChips followUps={message.followUps} onSelect={onFollowUpSelect} />
              )}
            </div>
          </div>
          {renderAfterMessage?.(message)}
          </React.Fragment>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export default MessageArea
