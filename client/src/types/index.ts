export interface SearchInfo {
  stages: string[]
  query: string
  urls: string[]
  error?: string
  docQuery?: string;   // populated when doc_search_start fires
  processing?: boolean; // true between search_results received and first content chunk
}

export interface Citation {
  index: number
  url: string
  title?: string
}

export interface Message {
  id: number
  content: string
  isUser: boolean
  type: string
  isLoading?: boolean
  searchInfo?: SearchInfo
  citations?: Citation[]
  followUps?: string[]
}

export interface Conversation {
  id: string
  title: string
  thread_id: string
  created_at: string
  updated_at: string
  user_id: string
}
