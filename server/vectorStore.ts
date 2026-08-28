import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const VECTORS_FILE = path.join(DATA_DIR, 'vectors.json');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json');

export interface StoredChunk {
  id: string;
  userId: string;
  documentId: string;
  documentTitle: string;
  category: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  characterCount: number;
  embedding: number[];
  createdAt: string;
}

export interface StoredDocument {
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

// In-memory cache backed by JSON files
let storedDocuments: StoredDocument[] = [];
let storedChunks: StoredChunk[] = [];

// Load data on startup
try {
  if (fs.existsSync(DOCUMENTS_FILE)) {
    storedDocuments = JSON.parse(fs.readFileSync(DOCUMENTS_FILE, 'utf-8'));
  }
  if (fs.existsSync(VECTORS_FILE)) {
    storedChunks = JSON.parse(fs.readFileSync(VECTORS_FILE, 'utf-8'));
  }
} catch (e) {
  console.error('Error loading stored vector data:', e);
}

function persistData() {
  try {
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(storedDocuments, null, 2));
    fs.writeFileSync(VECTORS_FILE, JSON.stringify(storedChunks, null, 2));
  } catch (e) {
    console.error('Error persisting vector data:', e);
  }
}

// Gemini AI client helper with custom key support
export function getAiClient(customApiKey?: string): GoogleGenAI | null {
  const key = customApiKey || process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Fallback high-dimensional dense vectorizer (384 dims) using hashing trick & n-grams
function generateLocalEmbedding(text: string, dim = 384): number[] {
  const vec = new Array(dim).fill(0);
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const tokens = normalized.split(/[\s,.;:!?()\[\]{}"'`<>\/\\_-]+/).filter(Boolean);
  
  if (tokens.length === 0) return vec;

  // Word unigrams & bigrams
  for (let i = 0; i < tokens.length; i++) {
    const unigram = tokens[i];
    let hash = 0;
    for (let c = 0; c < unigram.length; c++) {
      hash = (hash * 31 + unigram.charCodeAt(c)) >>> 0;
    }
    const idx = hash % dim;
    const sign = (hash % 2 === 0) ? 1 : -1;
    vec[idx] += sign * 1.5;

    // Character trigrams
    for (let j = 0; j <= unigram.length - 3; j++) {
      const tri = unigram.substring(j, j + 3);
      let triHash = 0;
      for (let c = 0; c < tri.length; c++) {
        triHash = (triHash * 37 + tri.charCodeAt(c)) >>> 0;
      }
      vec[triHash % dim] += 0.8;
    }

    if (i < tokens.length - 1) {
      const bigram = `${unigram}_${tokens[i + 1]}`;
      let biHash = 0;
      for (let c = 0; c < bigram.length; c++) {
        biHash = (biHash * 43 + bigram.charCodeAt(c)) >>> 0;
      }
      vec[biHash % dim] += 1.2;
    }
  }

  // L2 Normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      vec[i] /= norm;
    }
  }
  return vec;
}

// Generate embedding for text
export async function getEmbedding(text: string, customApiKey?: string): Promise<{ embedding: number[]; model: string }> {
  const cleanText = text.trim();
  if (!cleanText) {
    return { embedding: generateLocalEmbedding('empty'), model: 'local-fallback-384' };
  }

  const ai = getAiClient(customApiKey);
  if (ai) {
    try {
      const result = await ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: cleanText,
      });

      const values = (result as any).embedding?.values || (result as any).embeddings?.[0]?.values;
      if (values && values.length > 0) {
        return {
          embedding: values,
          model: 'gemini-embedding-2-preview',
        };
      }
    } catch (err: any) {
      console.warn('Gemini embedding failed, using local dense vectorizer:', err?.message || err);
    }
  }

  // Fallback
  return {
    embedding: generateLocalEmbedding(cleanText),
    model: 'local-vectorizer-384',
  };
}

// Cosine similarity
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  const sim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, (sim + 1) / 2)); // Normalize to 0..1 range or keep raw cosine
}

// Precise cosine similarity between [-1, 1] scaled to [0, 1] for relevance scoring
export function computeRawCosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Compute keyword and lexical relevance score (BM25-style lexical matching)
export function computeKeywordScore(query: string, text: string, title = ''): number {
  const normQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normText = (title + ' ' + text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  const queryWords = normQuery.split(/[\s,.;:!?()\[\]{}"'`<>\/\\_-]+/).filter(w => w.length >= 2);
  if (queryWords.length === 0) return 0;

  let matchedWords = 0;
  let exactMatchBonus = 0;

  // Check exact phrase match
  if (normText.includes(normQuery) && normQuery.length > 5) {
    exactMatchBonus = 0.35;
  }

  for (const word of queryWords) {
    if (normText.includes(word)) {
      matchedWords++;
      // Extra weight if found in document title
      if (title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(word)) {
        matchedWords += 0.5;
      }
    }
  }

  const wordRatio = Math.min(1, matchedWords / queryWords.length);
  return Math.min(1, wordRatio * 0.7 + exactMatchBonus);
}

// Text Chunking
export function splitTextIntoChunks(
  text: string,
  strategy: 'paragraph' | 'fixed_window' | 'semantic_sentence',
  chunkSize = 350,
  overlap = 50
): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  if (strategy === 'paragraph') {
    const rawParagraphs = clean.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const chunks: string[] = [];
    let current = '';

    for (const para of rawParagraphs) {
      if (!current) {
        current = para;
      } else if (current.length + para.length < chunkSize) {
        current += '\n\n' + para;
      } else {
        chunks.push(current);
        current = para;
      }
    }
    if (current) chunks.push(current);
    return chunks.length > 0 ? chunks : [clean];
  }

  if (strategy === 'semantic_sentence') {
    // Split on sentence terminators (. ! ? \n)
    const sentences = clean.match(/[^.!?\n]+[.!?\n]+/g) || [clean];
    const chunks: string[] = [];
    let current = '';

    for (const sent of sentences) {
      const trimmed = sent.trim();
      if (!trimmed) continue;
      if (!current) {
        current = trimmed;
      } else if (current.length + trimmed.length < chunkSize) {
        current += ' ' + trimmed;
      } else {
        chunks.push(current);
        // Overlap by taking the last part if needed
        const words = current.split(/\s+/);
        const overlapWords = words.slice(Math.max(0, words.length - 8)).join(' ');
        current = (overlapWords ? overlapWords + ' ' : '') + trimmed;
      }
    }
    if (current) chunks.push(current);
    return chunks.length > 0 ? chunks : [clean];
  }

  // fixed_window
  const chunks: string[] = [];
  let startIndex = 0;
  while (startIndex < clean.length) {
    let endIndex = startIndex + chunkSize;
    if (endIndex < clean.length) {
      // Try to break at a word boundary
      const nextSpace = clean.lastIndexOf(' ', endIndex);
      if (nextSpace > startIndex + chunkSize / 2) {
        endIndex = nextSpace;
      }
    }
    const piece = clean.substring(startIndex, endIndex).trim();
    if (piece) chunks.push(piece);
    startIndex = endIndex - overlap;
    if (startIndex >= clean.length || endIndex >= clean.length) break;
  }
  return chunks.length > 0 ? chunks : [clean];
}

// 2D PCA Dimensionality reduction for vector projection
export function computePCA2D(vectors: number[][]): [number, number][] {
  const n = vectors.length;
  if (n === 0) return [];
  const dim = vectors[0].length;
  if (n === 1) return [[0, 0]];

  // 1. Mean center
  const mean = new Array(dim).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < dim; j++) {
      mean[j] += vectors[i][j];
    }
  }
  for (let j = 0; j < dim; j++) {
    mean[j] /= n;
  }

  const centered = vectors.map(v => v.map((val, j) => val - mean[j]));

  // 2. Power iteration for 1st Principal Component
  let v1 = centered[0].slice();
  for (let iter = 0; iter < 12; iter++) {
    const next = new Array(dim).fill(0);
    for (let i = 0; i < n; i++) {
      let dot = 0;
      for (let j = 0; j < dim; j++) dot += centered[i][j] * v1[j];
      for (let j = 0; j < dim; j++) next[j] += centered[i][j] * dot;
    }
    let norm = Math.sqrt(next.reduce((s, x) => s + x * x, 0)) || 1;
    v1 = next.map(x => x / norm);
  }

  // 3. Power iteration for 2nd Principal Component (orthogonal to v1)
  let v2 = centered[centered.length > 1 ? 1 : 0].slice();
  for (let iter = 0; iter < 12; iter++) {
    // Gram-Schmidt orthogonalize against v1
    let dot1 = 0;
    for (let j = 0; j < dim; j++) dot1 += v2[j] * v1[j];
    for (let j = 0; j < dim; j++) v2[j] -= dot1 * v1[j];

    const next = new Array(dim).fill(0);
    for (let i = 0; i < n; i++) {
      let dot = 0;
      for (let j = 0; j < dim; j++) dot += centered[i][j] * v2[j];
      for (let j = 0; j < dim; j++) next[j] += centered[i][j] * dot;
    }
    // Re-orthogonalize
    let dotNext1 = 0;
    for (let j = 0; j < dim; j++) dotNext1 += next[j] * v1[j];
    for (let j = 0; j < dim; j++) next[j] -= dotNext1 * v1[j];

    let norm = Math.sqrt(next.reduce((s, x) => s + x * x, 0)) || 1;
    v2 = next.map(x => x / norm);
  }

  // 4. Project
  const projected: [number, number][] = centered.map(c => {
    let x = 0;
    let y = 0;
    for (let j = 0; j < dim; j++) {
      x += c[j] * v1[j];
      y += c[j] * v2[j];
    }
    return [x, y];
  });

  // Scale to [-100, 100] coordinate space
  let maxX = 0;
  let maxY = 0;
  projected.forEach(([x, y]) => {
    if (Math.abs(x) > maxX) maxX = Math.abs(x);
    if (Math.abs(y) > maxY) maxY = Math.abs(y);
  });
  const scale = 80 / (Math.max(maxX, maxY) || 1);

  return projected.map(([x, y]) => [Math.round(x * scale * 10) / 10, Math.round(y * scale * 10) / 10]);
}

// Vector Store CRUD
export async function addDocument(
  userId: string,
  title: string,
  content: string,
  category = 'General',
  tags: string[] = [],
  chunkingStrategy: 'paragraph' | 'fixed_window' | 'semantic_sentence' = 'paragraph',
  chunkSize = 350,
  chunkOverlap = 50,
  customApiKey?: string
): Promise<{ document: StoredDocument; chunks: StoredChunk[] }> {
  const docId = 'doc_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  const now = new Date().toISOString();

  const chunkTexts = splitTextIntoChunks(content, chunkingStrategy, chunkSize, chunkOverlap);
  const newChunks: StoredChunk[] = [];

  for (let i = 0; i < chunkTexts.length; i++) {
    const chunkContent = chunkTexts[i];
    const { embedding } = await getEmbedding(chunkContent, customApiKey);
    const chunkId = `chk_${docId}_${i}`;

    newChunks.push({
      id: chunkId,
      userId,
      documentId: docId,
      documentTitle: title,
      category,
      chunkIndex: i + 1,
      content: chunkContent,
      tokenCount: Math.ceil(chunkContent.split(/\s+/).length * 1.3),
      characterCount: chunkContent.length,
      embedding,
      createdAt: now,
    });
  }

  const newDoc: StoredDocument = {
    id: docId,
    userId,
    title,
    content,
    category,
    tags,
    chunkCount: newChunks.length,
    chunkingStrategy,
    chunkSize,
    chunkOverlap,
    status: 'indexed',
    createdAt: now,
    updatedAt: now,
  };

  storedDocuments.push(newDoc);
  storedChunks.push(...newChunks);
  persistData();

  return { document: newDoc, chunks: newChunks };
}

export function getUserDocuments(userId: string): StoredDocument[] {
  return storedDocuments.filter(d => d.userId === userId);
}

export function getUserChunks(userId: string, documentId?: string): StoredChunk[] {
  return storedChunks.filter(c => c.userId === userId && (!documentId || c.documentId === documentId));
}

export function getUserChunksWithPCA(userId: string, documentId?: string): (Omit<StoredChunk, 'embedding'> & { embeddingDim: number; pcaCoords: [number, number] })[] {
  const userChunks = storedChunks.filter(c => c.userId === userId && (!documentId || c.documentId === documentId));
  if (userChunks.length === 0) return [];
  
  // Compute PCA across all user chunks
  const vectors = userChunks.map(c => c.embedding);
  const coords = computePCA2D(vectors);

  return userChunks.map((c, i) => ({
    id: c.id,
    userId: c.userId,
    documentId: c.documentId,
    documentTitle: c.documentTitle,
    category: c.category,
    chunkIndex: c.chunkIndex,
    content: c.content,
    tokenCount: c.tokenCount,
    characterCount: c.characterCount,
    embeddingDim: c.embedding.length,
    pcaCoords: coords[i] || [0, 0],
    createdAt: c.createdAt,
  }));
}

export function deleteDocument(userId: string, documentId: string): boolean {
  const initialDocCount = storedDocuments.length;
  storedDocuments = storedDocuments.filter(d => !(d.userId === userId && d.id === documentId));
  storedChunks = storedChunks.filter(c => !(c.userId === userId && c.documentId === documentId));
  if (storedDocuments.length !== initialDocCount) {
    persistData();
    return true;
  }
  return false;
}

export async function searchVectorStore(
  userId: string,
  query: string,
  topK = 5,
  similarityThreshold = 0.25,
  categoryFilter?: string,
  documentIds?: string[],
  customApiKey?: string
): Promise<{
  results: { chunk: StoredChunk; similarity: number; pcaCoords?: [number, number] }[];
  queryEmbedding: number[];
  queryPca?: [number, number];
  modelUsed: string;
  totalChunksSearched: number;
}> {
  const userChunks = storedChunks.filter(c => {
    if (c.userId !== userId) return false;
    if (categoryFilter && c.category !== categoryFilter) return false;
    if (documentIds && documentIds.length > 0 && !documentIds.includes(c.documentId)) return false;
    return true;
  });

  if (userChunks.length === 0) {
    return {
      results: [],
      queryEmbedding: [],
      modelUsed: 'none',
      totalChunksSearched: 0,
    };
  }

  const { embedding: queryEmbedding, model: modelUsed } = await getEmbedding(query, customApiKey);

  const scored = userChunks.map(chunk => {
    // 1. Semantic Cosine similarity (normalized to 0..1)
    const rawSim = computeRawCosine(queryEmbedding, chunk.embedding);
    const semanticSim = Math.max(0, (rawSim + 1) / 2);

    // 2. Lexical Keyword & BM25-style overlap score
    const keywordSim = computeKeywordScore(query, chunk.content, chunk.documentTitle);

    // 3. Hybrid Combined Score (70% Semantic Vector + 30% Keyword Matching with exact bonus)
    const combinedScore = Math.min(1, semanticSim * 0.70 + keywordSim * 0.30);

    return { chunk, similarity: combinedScore, rawSemantic: semanticSim, keywordScore: keywordSim };
  });

  // Filter by threshold and sort descending
  const filtered = scored
    .filter(item => item.similarity >= similarityThreshold || item.keywordScore >= 0.45)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  // If filtered is empty but there are chunks, return top 1 with raw similarity for feedback
  const finalResults = filtered.length > 0 ? filtered : scored.sort((a, b) => b.similarity - a.similarity).slice(0, 1);

  // Compute PCA for visualization (including query + top chunks + background sample)
  const sampleChunks = userChunks.slice(0, 30);
  const vectorsForPca = [queryEmbedding, ...sampleChunks.map(c => c.embedding)];
  const pcaCoords = computePCA2D(vectorsForPca);

  const queryPca = pcaCoords[0];
  const chunkPcaMap = new Map<string, [number, number]>();
  for (let i = 0; i < sampleChunks.length; i++) {
    chunkPcaMap.set(sampleChunks[i].id, pcaCoords[i + 1]);
  }

  const enrichedResults = finalResults.map(item => ({
    chunk: item.chunk,
    similarity: item.similarity,
    pcaCoords: chunkPcaMap.get(item.chunk.id) || [0, 0],
  }));

  return {
    results: enrichedResults,
    queryEmbedding,
    queryPca,
    modelUsed,
    totalChunksSearched: userChunks.length,
  };
}

// Expand context for retrieved chunks by including surrounding chunks from same documents
export function getExpandedContextChunks(userId: string, topChunks: StoredChunk[]): StoredChunk[] {
  if (topChunks.length === 0) return [];
  const chunkIdSet = new Set<string>(topChunks.map(c => c.id));
  const expanded: StoredChunk[] = [...topChunks];

  // Group top chunks by documentId
  const docChunkIndices = new Map<string, number[]>();
  topChunks.forEach(c => {
    const list = docChunkIndices.get(c.documentId) || [];
    list.push(c.chunkIndex);
    docChunkIndices.set(c.documentId, list);
  });

  // For each document with matches, check if there are adjacent chunks that bridge continuity
  const userChunks = storedChunks.filter(c => c.userId === userId);
  userChunks.forEach(candidate => {
    if (chunkIdSet.has(candidate.id)) return;
    const indices = docChunkIndices.get(candidate.documentId);
    if (indices) {
      // If candidate is directly adjacent (+1 or -1) to any matched chunk in the same document
      const isAdjacent = indices.some(idx => Math.abs(idx - candidate.chunkIndex) === 1);
      if (isAdjacent && expanded.length < topChunks.length + 3) {
        chunkIdSet.add(candidate.id);
        expanded.push(candidate);
      }
    }
  });

  // Sort expanded chunks logically by document and chunkIndex
  return expanded.sort((a, b) => {
    if (a.documentId !== b.documentId) return a.documentTitle.localeCompare(b.documentTitle);
    return a.chunkIndex - b.chunkIndex;
  });
}
