'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { loadConversations, deleteConversation } from '@/lib/supabase'
import { getLocalConversations, deleteLocalConversation, LocalConversation } from '@/lib/localHistory'
import { Conversation } from '@/types'

interface HistoryPanelProps {
  isOpen: boolean
  currentThreadId: string | null
  onSelectConversation: (threadId: string) => void
  onNewChat: () => void
  refreshTrigger: number
}

const HistoryPanel = ({
  isOpen,
  currentThreadId,
  onSelectConversation,
  onNewChat,
  refreshTrigger,
}: HistoryPanelProps) => {
  const { data: session } = useSession()
  const [conversations, setConversations] = useState<(Conversation | LocalConversation)[]>([])
  const [loading, setLoading] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    loadHistory()
  }, [isOpen, refreshTrigger, session])

  const loadHistory = async () => {
  setLoading(true);
  
  if (session?.user) {
    const userId = (session.user as any).id;
    // Log this to your browser console to verify the ID matches Supabase
    console.log("Fetching history for ID:", userId); 

    const data = await loadConversations(userId);
    
    // Now 'data' is an array, not 'void', so TypeScript is happy
    setConversations(data); 
  } else {
    setConversations(getLocalConversations());
  }
  
  setLoading(false);
};

  const handleDelete = async (e: React.MouseEvent, conv: Conversation | LocalConversation) => {
    e.stopPropagation()
    if (session?.user) {
      await deleteConversation(conv.id)
    } else {
      deleteLocalConversation((conv as LocalConversation).thread_id)
    }
    setConversations(prev => prev.filter(c => c.id !== conv.id))
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const grouped = conversations.reduce<Record<string, typeof conversations>>((acc, conv) => {
    const label = formatDate(conv.updated_at)
    if (!acc[label]) acc[label] = []
    acc[label].push(conv)
    return acc
  }, {})

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.25)',
            zIndex: 20,
            backdropFilter: 'blur(2px)',
          }}
          className="md:hidden"
          onClick={onNewChat}
        />
      )}

      {/* Panel */}
      <div
        style={{
          position: 'absolute', left: 0, top: 0,
          height: '100%',
          width: isOpen ? 'var(--sidebar-width)' : 0,
          background: 'var(--bg-sidebar)',
          borderRight: isOpen ? '1px solid var(--border-subtle)' : 'none',
          boxShadow: isOpen ? 'var(--shadow-lg)' : 'none',
          zIndex: 30,
          transition: 'width var(--transition-slow), box-shadow var(--transition-slow)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {isOpen && (
          <>
            {/* Panel header */}
            <div style={{
              padding: '20px 16px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              flexShrink: 0,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 12,
              }}>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  Conversations
                </span>
                {!session?.user && (
                  <span style={{
                    fontSize: 10, color: 'var(--text-tertiary)',
                    background: 'var(--bg-surface-3)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 500,
                  }}>
                    Local
                  </span>
                )}
              </div>

              {/* New chat button — Fitts's Law: full width, tall */}
              <button
                onClick={onNewChat}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--accent-blue-soft)',
                  border: '1px solid transparent',
                  color: 'var(--accent-blue)',
                  fontSize: 14, fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast)',
                  minHeight: 44,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-blue)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#fff'
                  ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-blue-soft)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-blue)'
                  ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                New conversation
              </button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
                  {[80, 60, 90, 70].map((w, i) => (
                    <div key={i} className="shimmer" style={{
                      height: 40, borderRadius: 8,
                      width: `${w}%`,
                    }} />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  height: 160,
                  color: 'var(--text-tertiary)',
                  gap: 8,
                }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                  </svg>
                  <span style={{ fontSize: 13 }}>No conversations yet</span>
                </div>
              ) : (
                Object.entries(grouped).map(([label, convs]) => (
                  <div key={label} style={{ marginBottom: 4 }}>
                    <div style={{
                      padding: '8px 8px 4px',
                      fontSize: 11, fontWeight: 600,
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                    }}>
                      {label}
                    </div>
                    {convs.map(conv => {
                      const threadId = (conv as any).thread_id
                      const isActive = threadId === currentThreadId
                      const isHovered = hoveredId === conv.id

                      return (
                        <div
                          key={conv.id}
                          onClick={() => onSelectConversation(threadId)}
                          onMouseEnter={() => setHoveredId(conv.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: 10,
                            cursor: 'pointer',
                            transition: 'background var(--transition-fast)',
                            background: isActive
                              ? 'var(--accent-blue-soft)'
                              : isHovered ? 'var(--bg-surface-3)' : 'transparent',
                            marginBottom: 1,
                            minHeight: 40,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                              style={{ color: isActive ? 'var(--accent-blue)' : 'var(--text-tertiary)', flexShrink: 0 }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                            </svg>
                            <span style={{
                              fontSize: 13, fontWeight: isActive ? 500 : 400,
                              color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {conv.title}
                            </span>
                          </div>

                          {/* Delete — appears on hover */}
                          <button
                            onClick={(e) => handleDelete(e, conv)}
                            title="Delete conversation"
                            style={{
                              opacity: isHovered ? 1 : 0,
                              width: 28, height: 28,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: 6,
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              color: 'var(--text-tertiary)',
                              transition: 'opacity var(--transition-fast), background var(--transition-fast), color var(--transition-fast)',
                              flexShrink: 0, marginLeft: 4,
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLButtonElement).style.background = '#fee2e2'
                              ;(e.currentTarget as HTMLButtonElement).style.color = '#ef4444'
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)'
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18"/>
                              <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Sign-in nudge for anon */}
            {!session?.user && (
              <div style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface-2)',
                flexShrink: 0,
              }}>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', margin: 0 }}>
                  Sign in to sync across devices
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

export default HistoryPanel
