export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  category: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  characterCount: number;
  embeddingDim?: number;
  pcaCoords?: [number, number]; // 2D projection [x, y]
  similarity?: number;
  createdAt: string;
}

export interface KBDocument {
  id: string;
  userId: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  chunkCount: number;
  chunkingStrategy: 'paragraph' | 'fixed_window' | 'semantic_sentence';
  chunkSize: number;
  chunkOverlap: number;
  status: 'indexed' | 'processing' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface SearchResultItem {
  chunk: DocumentChunk;
  similarity: number;
  highlightedSnippet?: string;
}

export interface SearchResponse {
  query: string;
  queryPca?: [number, number];
  results: SearchResultItem[];
  totalChunksSearched: number;
  executionTimeMs: number;
  modelUsed: string;
}

export interface CitationSource {
  index: number;
  documentId: string;
  documentTitle: string;
  chunkId: string;
  chunkIndex: number;
  similarity: number;
  preview: string;
  category: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sources?: CitationSource[];
  metrics?: {
    retrievalTimeMs: number;
    generationTimeMs: number;
    topSimilarity: number;
    chunksRetrieved: number;
    model: string;
  };
  isError?: boolean;
}

export interface GeminiApiKeyStatus {
  configured: boolean;
  source: 'user_custom' | 'server_env' | 'none';
  maskedKey: string;
  hasServerEnv: boolean;
  hasCustomKey: boolean;
}

export interface ExternalApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  permissions: ('read_rag' | 'search_vector' | 'ingest_doc' | 'full_access')[];
  createdAt: string;
  lastUsedAt?: string;
  usageCount: number;
  isActive: boolean;
  expiresAt?: string;
}

export interface RAGSettings {
  topK: number;
  similarityThreshold: number;
  strictGrounding: boolean;
  model: string;
  temperature: number;
  chunkingStrategy: 'paragraph' | 'fixed_window' | 'semantic_sentence';
  chunkSize: number;
  chunkOverlap: number;
}

