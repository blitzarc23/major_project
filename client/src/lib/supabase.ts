import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Conversation helpers ───────────────────────────────────────────────────

export async function saveConversation(
  userId: string,
  threadId: string,
  title: string
) {
  const now = new Date().toISOString()
  const { data: existing, error: lookupError } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('thread_id', threadId)
    .maybeSingle()

  if (lookupError) console.error('Supabase lookup error:', lookupError)

  const query = existing
    ? supabase.from('conversations').update({ title, updated_at: now }).eq('id', existing.id)
    : supabase.from('conversations').insert({ user_id: userId, thread_id: threadId, title, updated_at: now })

  const { data, error } = await query
    .select()
    .single()

  if (error) console.error('Supabase Error:', JSON.stringify(error, null, 2))
  return data
}

export async function loadConversations(userId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Supabase Error Details:', {
      message: error.message,
      code: error.code
    });
    return []; // Return empty array on error so the app doesn't crash
  }

  return data ?? []; // Return the actual data found[cite: 5]
}

export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, role, content })
    .select()
    .single()
  if (error) console.error('saveMessage:', error)
  return data
}

export async function loadMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) console.error('loadMessages:', error)
  return data ?? []
}

export async function deleteConversation(conversationId: string) {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
  if (error) console.error('deleteConversation:', error)
}
