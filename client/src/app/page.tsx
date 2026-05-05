'use client'
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Header from '@/components/Header'
import InputBar from '@/components/InputBar'
import MessageArea from '@/components/MessageArea'
import HistoryPanel from '@/components/HistoryPanel'
import PDFViewer, { UploadedDoc } from '@/components/PDFViewer'
import { Message, Citation } from '@/types'
import { saveConversation, saveMessage, loadMessages } from '@/lib/supabase'
import {
  saveLocalConversation,
  saveLocalMessages,
  loadLocalMessages,
} from '@/lib/localHistory'
import { apiUrl } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'loading'
  title: string
  subtitle?: string
  duration?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const INITIAL_MESSAGE: Message = {
  id: 1,
  content: 'Hi! I\'m **Gyaankosh** — your AI-powered knowledge assistant. Ask me anything, or upload a PDF, Word doc, or text file and I\'ll answer questions about it.',
  isUser: false,
  type: 'message',
}

function generateTitle(firstUserMessage: string): string {
  return firstUserMessage.length > 50
    ? firstUserMessage.slice(0, 50) + '…'
    : firstUserMessage
}

// Detect PDF upload confirmation messages
function isPdfUploadMsg(msg: Message): boolean {
  return (
    !msg.isUser &&
    typeof msg.content === 'string' &&
    msg.content.includes('📄') &&
    msg.content.includes('uploaded and indexed')
  )
}

// ── Toast icons ───────────────────────────────────────────────────────────────
const ToastIcon = ({ type }: { type: Toast['type'] }) => {
  const size = 18
  switch (type) {
    case 'success':
      return (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width={size - 4} height={size - 4} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      )
    case 'error':
      return (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width={size - 4} height={size - 4} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
      )
    case 'info':
      return (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width={size - 4} height={size - 4} viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
      )
    case 'loading':
      return (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width={size - 4} height={size - 4} viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          </svg>
        </div>
      )
  }
}

// ── Toast Component ───────────────────────────────────────────────────────────
const ToastItem = ({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) => {
  const [exiting, setExiting] = useState(false)
  const dismiss = useCallback(() => { setExiting(true); setTimeout(() => onDismiss(toast.id), 300) }, [toast.id, onDismiss])
  useEffect(() => {
    if (toast.duration === 0) return
    const timer = setTimeout(dismiss, toast.duration ?? 4000)
    return () => clearTimeout(timer)
  }, [toast.duration, dismiss])
  return (
    <div className={exiting ? 'toast-exit' : 'toast-enter'} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-subtle)', minWidth: 260, maxWidth: 340, pointerEvents: 'all', cursor: 'default', position: 'relative', overflow: 'hidden' }}>
      <ToastIcon type={toast.type} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{toast.title}</div>
        {toast.subtitle && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.4 }}>{toast.subtitle}</div>}
      </div>
      <button onClick={dismiss} title="Dismiss" style={{ width: 24, height: 24, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, flexShrink: 0, transition: 'background var(--transition-fast)', padding: 0, marginTop: -2 }} onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface-3)'} onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      {toast.duration !== 0 && <div className="toast-progress" style={{ position: 'absolute', bottom: 0, left: 0, height: 2, right: 0, background: toast.type === 'success' ? '#16a34a' : toast.type === 'error' ? '#dc2626' : toast.type === 'loading' ? '#0284c7' : '#2563eb', opacity: 0.4, animationDuration: `${toast.duration ?? 4000}ms` } as React.CSSProperties} />}
    </div>
  )
}

const ToastContainer = ({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) => (
  <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column-reverse', gap: 8, zIndex: 100, pointerEvents: 'none' }}>
    {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />)}
  </div>
)

const AttributionBadge = () => (
  <div style={{ position: 'fixed', bottom: 14, left: 16, zIndex: 50, pointerEvents: 'none' }}>
    <div className="attribution" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 10px', boxShadow: 'var(--shadow-sm)', opacity: 0.75 }}>
      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Pranshu Tijil</span>
      <br />BTech CCE · Manipal University Jaipur · 2022–2026
    </div>
  </div>
)

// ── Doc Selector Chips — rendered after PDF upload confirmation messages ───────
function DocSelectorChips({ docs, activeUrl, onSelect }: { docs: UploadedDoc[]; activeUrl: string | null; onSelect: (d: UploadedDoc) => void }) {
  if (docs.length < 1) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', paddingLeft: 42, marginTop: -12, marginBottom: 20 }}>
      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginRight: 2, alignSelf: 'center' }}>View:</span>
      {docs.map((doc, i) => {
        const isActive = doc.objectUrl === activeUrl
        return (
          <button key={i} onClick={() => onSelect(doc)} title={doc.fileName}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 'var(--radius-full)', border: `1px solid ${isActive ? 'var(--accent-teal)' : 'var(--border-medium)'}`, background: isActive ? 'var(--accent-teal-soft)' : 'var(--bg-surface-3)', color: isActive ? 'var(--accent-teal)' : 'var(--text-secondary)', fontSize: 12, fontWeight: isActive ? 600 : 400, cursor: 'pointer', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'all var(--transition-fast)' }}
            onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-teal)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-teal-soft)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-teal)' } }}
            onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-medium)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface-3)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' } }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            {doc.fileName.length > 22 ? doc.fileName.slice(0, 20) + '…' : doc.fileName}
            {isActive && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>}
          </button>
        )
      })}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Home() {
  const { data: session } = useSession()
  const userId = (session?.user as any)?.id ?? null

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [currentMessage, setCurrentMessage] = useState('')
  const [checkpointId, setCheckpointId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [inputDisabled, setInputDisabled] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  // ── PDF panel ────────────────────────────────────────────────────────────────
  const [allDocs, setAllDocs] = useState<UploadedDoc[]>([])
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null)
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [activePdfName, setActivePdfName] = useState<string>('')
  const [activeDocType, setActiveDocType] = useState<UploadedDoc['fileType']>('pdf')
  const [activeDocText, setActiveDocText] = useState<string | undefined>(undefined)
  const [pdfPanelOpen, setPdfPanelOpen] = useState(false)
  const [pdfHighlight, setPdfHighlight] = useState<string | undefined>(undefined)
  const [pdfPanelWidth, setPdfPanelWidth] = useState(440)

  const convIdRef = useRef<string | null>(null)
  const pendingConversationSaveRef = useRef<Promise<any> | null>(null)
  const isFirstMessageRef = useRef(true)
  const lastDocQueryRef = useRef<string>('')

  // ── Toasts ────────────────────────────────────────────────────────────────────
  const addToast = useCallback((t: Omit<Toast, 'id'>) => { const id = Math.random().toString(36).slice(2); setToasts(prev => [...prev, { ...t, id }]); return id }, [])
  const removeToast = useCallback((id: string) => { setToasts(prev => prev.filter(t => t.id !== id)) }, [])
  const updateToast = useCallback((id: string, updates: Partial<Toast>) => { setToasts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t)) }, [])

  useEffect(() => {
    const stored = localStorage.getItem('gk-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', stored ? stored === 'dark' : prefersDark)
  }, [])

  const selectDoc = useCallback((doc: UploadedDoc) => {
    setActivePdfUrl(doc.objectUrl)
    setActiveDocId(doc.docId)
    setActivePdfName(doc.fileName)
    setActiveDocType(doc.fileType)
    setActiveDocText(doc.textContent)
    setPdfPanelOpen(true)
  }, [])

  const startNewChat = useCallback(() => {
    setMessages([INITIAL_MESSAGE]); setCheckpointId(null); convIdRef.current = null; pendingConversationSaveRef.current = null; isFirstMessageRef.current = true; setHistoryOpen(false)
    allDocs.forEach(d => URL.revokeObjectURL(d.objectUrl)); setAllDocs([]); setActivePdfUrl(null); setActiveDocId(null); setPdfPanelOpen(false); setActivePdfName(''); setActiveDocType('pdf'); setActiveDocText(undefined); setPdfHighlight(undefined)
    addToast({ type: 'info', title: 'New conversation started', duration: 2500 })
  }, [addToast, allDocs])

  const loadConversation = useCallback(async (threadId: string) => {
    setInputDisabled(true); setCheckpointId(threadId); setHistoryOpen(false); pendingConversationSaveRef.current = null
    allDocs.forEach(d => URL.revokeObjectURL(d.objectUrl)); setAllDocs([]); setActivePdfUrl(null); setActiveDocId(null); setActivePdfName(''); setActiveDocType('pdf'); setActiveDocText(undefined); setPdfPanelOpen(false); setPdfHighlight(undefined)
    const loadId = addToast({ type: 'loading', title: 'Loading conversation…', duration: 0 })
    let loaded: Message[] = []
    try {
      if (userId) {
        const { data: convData } = await (await import('@/lib/supabase')).supabase.from('conversations').select('id').eq('user_id', userId).eq('thread_id', threadId).maybeSingle()
        if (convData) { convIdRef.current = convData.id; const rows = await loadMessages(convData.id); loaded = rows.map((r: any, i: number) => ({ id: i + 2, content: r.content, isUser: r.role === 'user', type: 'message' })) }
      } else { loaded = loadLocalMessages(threadId) }
      setMessages(loaded.length ? loaded : [INITIAL_MESSAGE]); isFirstMessageRef.current = false
      updateToast(loadId, { type: 'success', title: 'Conversation loaded', duration: 2000 })
    } catch { updateToast(loadId, { type: 'error', title: 'Failed to load conversation', duration: 3000 }) }
    finally { setInputDisabled(false) }
  }, [userId, addToast, updateToast, allDocs])

  const handleFileSelect = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'docx', 'txt'].includes(ext || '')) { addToast({ type: 'error', title: 'Unsupported file type', subtitle: `"${file.name}" — only PDF, DOCX, and TXT allowed`, duration: 5000 }); return }
    const threadId = checkpointId ?? (() => { const id = crypto.randomUUID(); setCheckpointId(id); return id })()
    setUploading(true)
    const uploadId = addToast({ type: 'loading', title: 'Uploading document…', subtitle: file.name, duration: 0 })
    const formData = new FormData(); formData.append('file', file); formData.append('thread_id', threadId)
    try {
      const res = await fetch(apiUrl('/upload'), { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) { updateToast(uploadId, { type: 'error', title: 'Upload failed', subtitle: data.error, duration: 5000 }) }
      else {
        updateToast(uploadId, { type: 'success', title: 'Document ready', subtitle: `${data.filename} · ${data.chunks} chunks indexed`, duration: 5000 })
        const objUrl = URL.createObjectURL(file)
        const newDoc: UploadedDoc = {
          docId: data.doc_id,
          fileName: data.filename ?? file.name,
          objectUrl: objUrl,
          fileType: (data.file_type ?? ext) as UploadedDoc['fileType'],
          textContent: data.text,
        }
        setAllDocs(prev => prev.find(d => d.docId === newDoc.docId) ? prev : [...prev, newDoc])
        selectDoc(newDoc)
        setMessages(prev => [...prev, { id: Math.max(...prev.map(m => m.id), 0) + 1, content: `📄 **${data.filename}** uploaded and indexed (${data.chunks} chunks). Ask me anything about it!`, isUser: false, type: 'message' }])
      }
    } catch { updateToast(uploadId, { type: 'error', title: 'Upload failed', subtitle: 'Is the server running?', duration: 5000 }) }
    finally { setUploading(false) }
  }, [checkpointId, addToast, updateToast, selectDoc])

  const handleSubmit = useCallback(async (e: React.FormEvent | string) => {
    const userText = typeof e === 'string' ? e : currentMessage
    if (typeof e !== 'string') (e as React.FormEvent).preventDefault?.()
    if (!userText.trim()) return
    const newId = messages.length > 0 ? Math.max(...messages.map(m => m.id)) + 1 : 2
    setMessages(prev => [...prev, { id: newId, content: userText, isUser: true, type: 'message' }])
    setCurrentMessage('')
    const aiId = newId + 1
    setMessages(prev => [...prev, { id: aiId, content: '', isUser: false, type: 'message', isLoading: true, searchInfo: { stages: [], query: '', urls: [], docQuery: undefined, processing: false } }])
    const tid = checkpointId ?? (() => { const id = crypto.randomUUID(); setCheckpointId(id); return id })()
    let url = apiUrl(`/chat_stream/${encodeURIComponent(userText)}`)
    const params = new URLSearchParams({ checkpoint_id: tid })
    if (activeDocId) params.set('active_doc_id', activeDocId)
    url += `?${params.toString()}`
    const eventSource = new EventSource(url)
    let streamed = '', searchData: any = { stages: [], query: '', urls: [], docQuery: undefined, processing: false }
    let citations: Citation[] = [], followUps: string[] = [], firstContentReceived = false
    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'checkpoint') {
          setCheckpointId(data.checkpoint_id)
          if (isFirstMessageRef.current) {
            isFirstMessageRef.current = false
            const title = generateTitle(userText)
            if (userId) {
              pendingConversationSaveRef.current = saveConversation(userId, data.checkpoint_id, title).then(conv => { if (conv) convIdRef.current = conv.id; setHistoryRefresh(n => n + 1); return conv })
            }
            else { saveLocalConversation(data.checkpoint_id, title); setHistoryRefresh(n => n + 1) }
          }
        } else if (data.type === 'content') {
          if (!firstContentReceived) { firstContentReceived = true; searchData = { ...searchData, processing: false } }
          streamed += data.content
          const displayContent = streamed.replace(/\s*FOLLOW_UPS:\s*\[.*?\]\s*$/s, '').trim()
          setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: displayContent, isLoading: false, searchInfo: { ...searchData } } : m))
        } else if (data.type === 'search_start') {
          searchData = { ...searchData, stages: ['searching'], query: data.query, docQuery: undefined, processing: false }
          setMessages(prev => prev.map(m => m.id === aiId ? { ...m, searchInfo: { ...searchData }, isLoading: false } : m))
        } else if (data.type === 'doc_search_start') {
          lastDocQueryRef.current = data.query ?? ''
          searchData = { ...searchData, stages: ['reading document'], docQuery: data.query, processing: false }
          setMessages(prev => prev.map(m => m.id === aiId ? { ...m, searchInfo: { ...searchData }, isLoading: false } : m))
        } else if (data.type === 'doc_search_done') {
          searchData = { ...searchData, docQuery: undefined, stages: [...searchData.stages, 'writing'] }
          setMessages(prev => prev.map(m => m.id === aiId ? { ...m, searchInfo: { ...searchData } } : m))
        } else if (data.type === 'search_results') {
          const urls = typeof data.urls === 'string' ? JSON.parse(data.urls) : data.urls
          citations = urls.map((url: string, i: number) => ({ index: i + 1, url }))
          searchData = { ...searchData, stages: [...searchData.stages, 'reading'], urls, processing: true }
          setMessages(prev => prev.map(m => m.id === aiId ? { ...m, searchInfo: { ...searchData }, isLoading: false } : m))
        } else if (data.type === 'follow_ups') {
          followUps = data.questions ?? []
        } else if (data.type === 'end') {
          const finalSearch = searchData.stages.length ? { ...searchData, stages: [...new Set([...searchData.stages, 'done'])], processing: false, docQuery: undefined } : { ...searchData, processing: false }
          const finalContent = streamed.replace(/\s*FOLLOW_UPS:\s*\[.*?\]\s*$/s, '').trim()
          if (activePdfUrl && lastDocQueryRef.current) { setPdfHighlight(lastDocQueryRef.current); setTimeout(() => setPdfHighlight(undefined), 8000) }
          setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: finalContent, searchInfo: finalSearch, isLoading: false, citations, followUps } : m))
          if (userId) {
            const conv = await pendingConversationSaveRef.current
            const conversationId = convIdRef.current ?? conv?.id
            if (conversationId) {
              await saveMessage(conversationId, 'user', userText)
              await saveMessage(conversationId, 'assistant', finalContent)
            }
          }
          else { setTimeout(() => { setMessages(current => { saveLocalMessages(tid, current); return current }) }, 100) }
          eventSource.close()
        } else if (data.type === 'search_error') {
          searchData = { ...searchData, stages: [...searchData.stages, 'error'], processing: false }
          setMessages(prev => prev.map(m => m.id === aiId ? { ...m, searchInfo: { ...searchData }, isLoading: false } : m))
        }
      } catch (err) { console.error('SSE parse error:', err, event.data) }
    }
    eventSource.onerror = () => {
      eventSource.close()
      setMessages(prev => prev.map(m => m.id === aiId && m.isLoading ? { ...m, content: 'Sorry, something went wrong. Please try again.', isLoading: false } : m))
      addToast({ type: 'error', title: 'Connection error', subtitle: 'Check if the server is running', duration: 4000 })
    }
  }, [currentMessage, messages, checkpointId, userId, addToast, activePdfUrl, activeDocId])

  // ── Redo ──────────────────────────────────────────────────────────────────────
  const handleRedoMessage = useCallback((message: Message) => {
    if (message.isUser) {
      setMessages(prev => prev.filter(m => m.id < message.id))
      setTimeout(() => handleSubmit(message.content), 0)
    } else {
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === message.id)
        const userMsg = idx > 0 ? [...prev].slice(0, idx).reverse().find(m => m.isUser) : null
        if (userMsg) { setTimeout(() => handleSubmit(userMsg.content), 0); return prev.filter(m => m.id < message.id) }
        return prev
      })
    }
  }, [handleSubmit])

  const handleFollowUp = useCallback((q: string) => { setCurrentMessage(q); handleSubmit(q) }, [handleSubmit])

  const startPdfResize = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = pdfPanelWidth
    const onMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(760, Math.max(320, startWidth + startX - moveEvent.clientX))
      setPdfPanelWidth(nextWidth)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pdfPanelWidth])

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
      <AttributionBadge />

      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-base)' }}>

        {/* LEFT: History sidebar */}
        <aside style={{ width: historyOpen ? 'var(--sidebar-width, 260px)' : '0px', minWidth: historyOpen ? 'var(--sidebar-width, 260px)' : '0px', flexShrink: 0, overflow: 'hidden', background: 'var(--bg-sidebar, var(--bg-surface))', borderRight: historyOpen ? '1px solid var(--border-subtle)' : 'none', transition: 'width 0.25s ease, min-width 0.25s ease', zIndex: 10, position: 'relative' }}>
          <div style={{ width: '260px', height: '100%', position: 'relative' }}>
            <HistoryPanel isOpen={historyOpen} currentThreadId={checkpointId} onSelectConversation={loadConversation} onNewChat={startNewChat} refreshTrigger={historyRefresh} />
          </div>
        </aside>

        {/* CENTER: chat */}
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
          <Header
            onToggleHistory={() => setHistoryOpen(o => !o)}
            historyOpen={historyOpen}
            hasPdf={allDocs.length > 0}
            pdfFileName={activePdfName}
            pdfPanelOpen={pdfPanelOpen}
            onTogglePdfPanel={() => setPdfPanelOpen(v => !v)}
          />

          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <MessageArea
              messages={messages}
              onFollowUpSelect={handleFollowUp}
              onRedoMessage={handleRedoMessage}
              renderAfterMessage={(msg) =>
                isPdfUploadMsg(msg) && allDocs.length >= 1
                  ? <DocSelectorChips docs={allDocs} activeUrl={activePdfUrl} onSelect={selectDoc} />
                  : null
              }
            />
          </div>

          <InputBar currentMessage={currentMessage} setCurrentMessage={setCurrentMessage} onSubmit={handleSubmit} onFileSelect={handleFileSelect} uploading={uploading} disabled={inputDisabled} />
        </main>

        {/* RIGHT: PDF panel */}
        {pdfPanelOpen && activePdfUrl && (
          <aside style={{ width: pdfPanelWidth, minWidth: pdfPanelWidth, flexShrink: 0, borderLeft: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 10, position: 'relative' }}>
            <div
              onMouseDown={startPdfResize}
              title="Resize document viewer"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 8,
                cursor: 'col-resize',
                zIndex: 20,
                transform: 'translateX(-4px)',
              }}
            />
            <PDFViewer
              fileUrl={activePdfUrl}
              fileName={activePdfName}
              fileType={activeDocType}
              textContent={activeDocText}
              highlightText={pdfHighlight}
              onClose={() => setPdfPanelOpen(false)}
              allDocs={allDocs}
              onSelectDoc={selectDoc}
              width={pdfPanelWidth}
              onWidthChange={setPdfPanelWidth}
            />
          </aside>
        )}
      </div>
    </>
  )
}
