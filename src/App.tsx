import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header, ActiveTab } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { DocumentModal } from './components/DocumentModal';
import { RagChatView } from './components/RagChatView';
import { SemanticSearchView } from './components/SemanticSearchView';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { VectorVisualizerView } from './components/VectorVisualizerView';
import { SettingsView } from './components/SettingsView';
import { KBDocument, DocumentChunk, RAGSettings } from './types';

function MainApp() {
  const { authHeader, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [settings, setSettings] = useState<RAGSettings>({
    topK: 4,
    similarityThreshold: 0.35,
    strictGrounding: true,
    model: 'gemini-3.7-flash',
    temperature: 0.3,
    chunkingStrategy: 'paragraph',
    chunkSize: 350,
    chunkOverlap: 50,
  });

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingData(true);
    try {
      // Fetch documents
      const docsRes = await fetch('/api/kb/documents', { headers: authHeader });
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(docsData.documents || []);
      }

      // Fetch chunks
      const chunksRes = await fetch('/api/kb/chunks', { headers: authHeader });
      if (chunksRes.ok) {
        const chunksData = await chunksRes.json();
        setChunks(chunksData.chunks || []);
      }
    } catch (err) {
      console.error('Error fetching RAG data:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [isAuthenticated, authHeader]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, fetchData]);

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] flex flex-col font-sans antialiased selection:bg-[#141414] selection:text-white">
      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        documentCount={documents.length}
        chunkCount={chunks.length}
      />

      {/* Main Tab Views */}
      <main className="flex-1 overflow-x-hidden">
        {activeTab === 'chat' && (
          <RagChatView
            settings={settings}
            onOpenDocModal={() => setIsDocModalOpen(true)}
            documentCount={documents.length}
            chunkCount={chunks.length}
          />
        )}

        {activeTab === 'search' && (
          <SemanticSearchView
            documentCount={documents.length}
            chunkCount={chunks.length}
          />
        )}

        {activeTab === 'knowledge' && (
          <KnowledgeBaseView
            documents={documents}
            chunks={chunks}
            isLoading={isLoadingData}
            onRefresh={fetchData}
            onOpenDocModal={() => setIsDocModalOpen(true)}
          />
        )}

        {activeTab === 'visualizer' && (
          <VectorVisualizerView chunks={chunks} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            setSettings={setSettings}
            documentCount={documents.length}
            chunkCount={chunks.length}
          />
        )}
      </main>

      {/* High Density System Footer */}
      <footer className="border-t border-[#141414] bg-[#141414] text-white p-2 px-4 sm:px-6 flex flex-wrap justify-between items-center gap-2 text-[10px] font-mono">
        <div className="flex flex-wrap gap-4 sm:gap-6 items-center">
          <span className="text-green-400 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            SYSTEM READY
          </span>
          <span className="opacity-70 uppercase hidden sm:inline">Engine: gemini-3.7-flash</span>
          <span className="opacity-70 uppercase hidden md:inline">Embedding: gemini-embedding-2</span>
        </div>
        <div className="flex flex-wrap gap-3 sm:gap-4 items-center opacity-80 uppercase">
          <span>Active Docs: {documents.length}</span>
          <span>•</span>
          <span>Indexed Chunks: {chunks.length}</span>
          <span>•</span>
          <span>Top-K: {settings.topK}</span>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <DocumentModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
