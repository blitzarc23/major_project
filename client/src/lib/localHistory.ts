import { Message, Conversation } from '@/types'

const HISTORY_KEY = 'perplexity_local_history'
const MESSAGES_PREFIX = 'perplexity_messages_'

export interface LocalConversation {
  id: string
  thread_id: string
  title: string
  created_at: string
  updated_at: string
}

export function getLocalConversations(): LocalConversation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveLocalConversation(threadId: string, title: string): LocalConversation {
  const convos = getLocalConversations()
  const existing = convos.find(c => c.thread_id === threadId)
  const now = new Date().toISOString()

  if (existing) {
    existing.updated_at = now
    existing.title = title
    localStorage.setItem(HISTORY_KEY, JSON.stringify(convos))
    return existing
  }

  const newConvo: LocalConversation = {
    id: crypto.randomUUID(),
    thread_id: threadId,
    title,
    created_at: now,
    updated_at: now,
  }
  convos.unshift(newConvo)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(convos))
  return newConvo
}

export function saveLocalMessages(threadId: string, messages: Message[]) {
  if (typeof window === 'undefined') return
  // Only save non-loading messages
  const toSave = messages.filter(m => !m.isLoading)
  localStorage.setItem(MESSAGES_PREFIX + threadId, JSON.stringify(toSave))
}

export function loadLocalMessages(threadId: string): Message[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(MESSAGES_PREFIX + threadId)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function deleteLocalConversation(threadId: string) {
  const convos = getLocalConversations().filter(c => c.thread_id !== threadId)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(convos))
  localStorage.removeItem(MESSAGES_PREFIX + threadId)
}
