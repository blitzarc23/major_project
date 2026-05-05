'use client'
import { useSession, signIn, signOut } from 'next-auth/react'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import Tooltip from './Tooltip'

interface HeaderProps {
  onToggleHistory: () => void
  historyOpen: boolean
  // CHANGE 3 + 5: PDF panel controls
  hasPdf?: boolean
  pdfFileName?: string
  pdfPanelOpen?: boolean
  onTogglePdfPanel?: () => void
}

// ── Dark mode hook ────────────────────────────────────────────────────────────
export function useDarkMode() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('gk-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = stored ? stored === 'dark' : prefersDark
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('gk-theme', next ? 'dark' : 'light')
    document.documentElement.classList.add('theme-transition')
    setTimeout(() => document.documentElement.classList.remove('theme-transition'), 600)
  }

  return { dark, toggle }
}

const Header = ({
  onToggleHistory,
  historyOpen,
  hasPdf = false,
  pdfFileName = '',
  pdfPanelOpen = false,
  onTogglePdfPanel,
}: HeaderProps) => {
  const { data: session } = useSession()
  const { dark, toggle } = useDarkMode()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  return (
    <header
      style={{
        height: 'var(--header-height)',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
      }}
      className="flex items-center justify-between px-4 shrink-0 z-10 relative"
    >
      {/* ── Left: sidebar toggle + brand ── */}
      <div className="flex items-center gap-1">
        {/* CHANGE 1: Tooltip on history toggle */}
        <Tooltip
          text={historyOpen ? 'Close conversation history panel' : 'Open conversation history — browse and reload past chats'}
          position="bottom"
        >
          <button
            onClick={onToggleHistory}
            aria-label="Toggle conversation history"
            style={{
              width: 44, height: 44,
              borderRadius: 'var(--radius-sm)',
              color: historyOpen ? 'var(--accent-blue)' : 'var(--text-secondary)',
              background: historyOpen ? 'var(--accent-blue-soft)' : 'transparent',
              transition: 'background var(--transition-fast), color var(--transition-fast)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            onMouseEnter={e => {
              if (!historyOpen) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface-3)'
            }}
            onMouseLeave={e => {
              if (!historyOpen) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </Tooltip>

        {/* Brand */}
        <div className="flex items-center gap-2 ml-2">
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1a73e8 0%, #0d9488 50%, #7c3aed 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z"/>
            </svg>
          </div>
          <span
            className="font-brand"
            style={{
              fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #1a73e8 0%, #0d9488 60%, #7c3aed 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text', lineHeight: 1, paddingBottom: 1,
            }}
          >
            Gyaankosh
          </span>
        </div>
      </div>

      {/* ── Right: PDF toggle + dark mode + auth ── */}
      <div className="flex items-center gap-2">

        {/* CHANGE 3 + 5: Document viewer button — visible only when a PDF is loaded */}
        {hasPdf && onTogglePdfPanel && (
          <Tooltip
            text={
              pdfPanelOpen
                ? `Hide the PDF document viewer panel`
                : `View your uploaded PDF (${pdfFileName || 'document'}) — the viewer highlights the exact passage the AI references when answering`
            }
            position="bottom"
          >
            <button
              onClick={onTogglePdfPanel}
              aria-label="Toggle PDF viewer panel"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: `1px solid ${pdfPanelOpen ? 'var(--accent-teal, #0d9488)' : 'var(--border-medium)'}`,
                background: pdfPanelOpen ? 'var(--accent-teal-soft, rgba(13,148,136,0.1))' : 'transparent',
                color: pdfPanelOpen ? 'var(--accent-teal, #0d9488)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: 500,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                minHeight: 36,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                const btn = e.currentTarget as HTMLButtonElement
                if (!pdfPanelOpen) {
                  btn.style.background = 'var(--bg-surface-3)'
                  btn.style.color = 'var(--text-primary)'
                  btn.style.borderColor = 'var(--border-medium)'
                }
              }}
              onMouseLeave={e => {
                const btn = e.currentTarget as HTMLButtonElement
                if (!pdfPanelOpen) {
                  btn.style.background = 'transparent'
                  btn.style.color = 'var(--text-secondary)'
                  btn.style.borderColor = 'var(--border-medium)'
                }
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              {pdfPanelOpen ? 'Hide Doc' : 'View Doc'}
            </button>
          </Tooltip>
        )}

        {/* CHANGE 1: Tooltip on dark mode toggle */}
        <Tooltip
          text={dark ? 'Switch to light mode — brighter theme for well-lit environments' : 'Switch to dark mode — easier on the eyes in dim environments'}
          position="bottom"
        >
          <button
            onClick={toggle}
            aria-label="Toggle dark mode"
            style={{
              width: 44, height: 44, borderRadius: 'var(--radius-sm)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background var(--transition-fast), color var(--transition-fast)', flexShrink: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface-3)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
            }}
          >
            {dark ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </Tooltip>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: 'var(--border-medium)' }} />

        {/* Auth */}
        {session?.user ? (
          <div className="relative">
            {/* CHANGE 1: Tooltip on user menu */}
            <Tooltip text="Open account menu — view your profile or sign out" position="bottom">
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 'var(--radius-full)',
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  transition: 'background var(--transition-fast)',
                  color: 'var(--text-primary)', minHeight: 44,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface-3)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
              >
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name ?? 'User'}
                    width={32} height={32}
                    style={{ borderRadius: '50%', border: '2px solid var(--border-medium)' }}
                  />
                ) : (
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--accent-blue)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 13, fontWeight: 700,
                  }}>
                    {session.user.name?.[0] ?? 'U'}
                  </div>
                )}
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session.user.name?.split(' ')[0]}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
            </Tooltip>

            {/* Dropdown */}
            {userMenuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setUserMenuOpen(false)} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                  minWidth: 200, zIndex: 50, overflow: 'hidden', padding: '4px 0',
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{session.user.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{session.user.email}</div>
                  </div>
                  <button
                    onClick={() => { signOut(); setUserMenuOpen(false) }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 16px', background: 'transparent', border: 'none',
                      cursor: 'pointer', color: 'var(--text-secondary)',
                      fontSize: 14, textAlign: 'left',
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface-3)'}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          /* CHANGE 1: Tooltip on sign-in button */
          <Tooltip text="Sign in with Google to sync your conversation history across all devices" position="bottom">
            <button
              onClick={() => signIn('google')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 'var(--radius-full)',
                background: 'var(--accent-blue)', color: '#fff',
                border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 500,
                transition: 'opacity var(--transition-fast), transform var(--transition-fast)',
                minHeight: 44,
                boxShadow: '0 1px 3px rgba(26,115,232,0.4)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.opacity = '0.9'
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.opacity = '1'
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </button>
          </Tooltip>
        )}
      </div>
    </header>
  )
}

export default Header
