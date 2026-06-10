import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Search, Trash2, Edit2, Calendar, Clock, ChevronRight, Plus, History as HistoryIcon, FileText, FileCode, FileJson, File as FileIcon, Download, Upload, CheckSquare, Square, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useChat } from '../context/ChatContext';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { performOCR, processFile } from '../services/ocrService';

const HistoryScreen: React.FC = () => {
  const { sessions, switchSession, deleteSession, deleteAllSessions, renameSession, activeSessionId, createNewSession } = useChat();
  const { knowledgeBase, deleteFromKnowledgeBase, deleteMultipleFromKnowledgeBase, addMultipleToKnowledgeBase, addToast, proactiveCommunications, deleteProactiveCommunication } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [activeTab, setActiveTab] = useState<'chats' | 'knowledge' | 'proactive'>('chats');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const kbUploadRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    
    const query = searchQuery.toLowerCase();
    return sessions.filter(session => {
      const titleMatch = session.title.toLowerCase().includes(query);
      const messageMatch = session.messages.some(msg => 
        msg.content.toLowerCase().includes(query)
      );
      return titleMatch || messageMatch;
    });
  }, [sessions, searchQuery]);

  const filteredKnowledge = useMemo(() => {
    if (!searchQuery.trim()) return knowledgeBase;
    
    const query = searchQuery.toLowerCase();
    return knowledgeBase.filter(file => 
      file.name.toLowerCase().includes(query) || 
      file.content.toLowerCase().includes(query)
    );
  }, [knowledgeBase, searchQuery]);

  const filteredProactive = useMemo(() => {
    if (!searchQuery.trim()) return proactiveCommunications;
    
    const query = searchQuery.toLowerCase();
    return proactiveCommunications.filter(comm => 
      comm.title.toLowerCase().includes(query) || 
      comm.content.toLowerCase().includes(query)
    );
  }, [proactiveCommunications, searchQuery]);

  const handleSwitch = (id: string) => {
    switchSession(id);
    navigate('/chat');
  };

  const handleRename = async (id: string) => {
    if (newTitle.trim()) {
      addToast({ title: "History", message: "Renaming conversation...", type: "info" });
      await new Promise(resolve => setTimeout(resolve, 500));
      renameSession(id, newTitle.trim());
      setEditingSessionId(null);
      setNewTitle('');
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const className = "w-full h-full";
    if (ext === 'json') return <FileJson className={`${className} text-yellow`} />;
    if (['js', 'ts', 'tsx', 'py', 'html', 'css'].includes(ext || '')) return <FileCode className={`${className} text-blue`} />;
    return <FileText className={`${className} text-primary`} />;
  };

  const handleBatchDelete = async () => {
    if (selectedFiles.length === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedFiles.length} selected files?`)) {
      addToast({ title: "Knowledge Base", message: `Deleting ${selectedFiles.length} files...`, type: "info" });
      await new Promise(resolve => setTimeout(resolve, 800));
      deleteMultipleFromKnowledgeBase(selectedFiles);
      setSelectedFiles([]);
      addToast({ title: "Knowledge Base", message: "Batch delete complete", type: "success" });
    }
  };

  const handleBatchDownload = async () => {
    if (selectedFiles.length === 0) return;
    
    try {
      addToast({ title: "Knowledge Base", message: "Preparing download...", type: "info" });
      const zip = new JSZip();
      
      selectedFiles.forEach(fileName => {
        const file = knowledgeBase.find(f => f.name === fileName);
        if (file) {
          zip.file(file.name, file.content);
        }
      });
      
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `knowledge_base_export_${Date.now()}.zip`);
      addToast({ title: "Knowledge Base", message: "Download started", type: "success" });
    } catch (error) {
      console.error("Batch download failed:", error);
      addToast({ title: "Knowledge Base", message: "Download failed", type: "error" });
    }
  };

  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    addToast({ title: "Knowledge Base", message: `Processing ${files.length} files...`, type: "info" });
    
    const newDocs: { name: string; content: string }[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const processedFiles = await processFile(file, file.name);
        newDocs.push(...processedFiles);
      } catch (err) {
        console.error(`Failed to process file ${file.name}:`, err);
        addToast({ title: "Processing Error", message: `Failed to process ${file.name}`, type: "error" });
      }
    }
    
    if (newDocs.length > 0) {
      addMultipleToKnowledgeBase(newDocs);
      addToast({ title: "Knowledge Base", message: `Successfully added ${newDocs.length} files to knowledge base`, type: "success" });
    }
    
    if (kbUploadRef.current) kbUploadRef.current.value = '';
  };

  const toggleFileSelection = (name: string) => {
    setSelectedFiles(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const toggleSelectAll = () => {
    if (selectedFiles.length === filteredKnowledge.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(filteredKnowledge.map(f => f.name));
    }
  };

  return (
    <div className="w-full h-full bg-transparent transition-colors duration-500 max-w-4xl mx-auto space-y-4 sm:space-y-6 pb-20 px-4 sm:px-0">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-indigo-900 dark:text-indigo-50 flex items-center">
            <HistoryIcon className="w-6 h-6 sm:w-8 h-8 mr-2 sm:mr-3 text-indigo-600 dark:text-indigo-400" />
            History & Knowledge
          </h1>
          <p className="text-sm sm:text-base text-indigo-700 dark:text-indigo-300 mt-1">Manage your past interactions and uploaded knowledge</p>
        </div>
        <div className="flex flex-row gap-2">
          {activeTab === 'chats' && (
            <button
              onClick={async () => {
                if (window.confirm('Are you sure you want to delete ALL conversations? This cannot be undone.')) {
                    addToast({ title: "History", message: "Deleting all conversations...", type: "info" });
                    await new Promise(resolve => setTimeout(resolve, 800));
                    deleteAllSessions();
                }
              }}
              className="flex-1 sm:flex-none flex items-center justify-center px-3 sm:px-4 py-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 transition-colors shadow-sm text-sm sm:text-base"
            >
              <Trash2 className="w-4 h-4 sm:w-5 h-5 mr-1 sm:mr-2" />
              Delete All
            </button>
          )}
          <button
            onClick={async () => {
              addToast({ title: "History", message: "Creating new chat session...", type: "info" });
              await new Promise(resolve => setTimeout(resolve, 500));
              createNewSession();
              navigate('/chat');
            }}
            className="flex-1 sm:flex-none flex items-center justify-center px-3 sm:px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors shadow-sm text-sm sm:text-base"
          >
            <Plus className="w-4 h-4 sm:w-5 h-5 mr-1 sm:mr-2" />
            New Chat
          </button>
        </div>
      </header>

      {/* Tabs & Batch Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex p-1 bg-indigo-100 dark:bg-indigo-900 rounded-xl w-full sm:w-fit overflow-x-auto">
          <button
            onClick={() => setActiveTab('chats')}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'chats' 
                ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100'
            }`}
          >
            Conversations ({sessions.length})
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'knowledge' 
                ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100'
            }`}
          >
            Knowledge Base ({knowledgeBase.length})
          </button>
          <button
            onClick={() => setActiveTab('proactive')}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'proactive' 
                ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100'
            }`}
          >
            Proactive ({proactiveCommunications.length})
          </button>
        </div>

        {activeTab === 'knowledge' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input 
              type="file" 
              ref={kbUploadRef} 
              className="hidden" 
              multiple 
              onChange={handleBatchUpload}
              accept=".txt,.md,.json,.js,.ts,.tsx,.py,.html,.css,.pdf,.zip,image/*"
            />
            
            {selectedFiles.length > 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between sm:justify-start gap-1 sm:gap-2 bg-indigo-100 dark:bg-indigo-900 p-1 rounded-xl border border-indigo-200 dark:border-indigo-800 w-full sm:w-auto"
              >
                <span className="text-[10px] sm:text-xs font-bold text-indigo-600 dark:text-indigo-400 px-2 whitespace-nowrap">
                  {selectedFiles.length} <span className="hidden xs:inline">selected</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleBatchDownload}
                    className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-lg transition-colors"
                    title="Download Selected"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleBatchDelete}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900 rounded-lg transition-colors"
                    title="Delete Selected"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-indigo-200 dark:bg-indigo-800 mx-1" />
                  <button
                    onClick={() => setSelectedFiles([])}
                    className="p-2 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-lg transition-colors"
                    title="Clear Selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <button
                onClick={() => kbUploadRef.current?.click()}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors shadow-sm text-sm font-medium"
              >
                <Upload className="w-4 h-4" />
                Batch Upload
              </button>
            )}
          </div>
        )}
      </div>

      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-indigo-400 dark:text-indigo-600" />
        </div>
        <input
          type="text"
          placeholder={activeTab === 'chats' ? "Search..." : "Search files..."}
          className="block w-full pl-10 pr-24 py-3 border border-indigo-200 dark:border-indigo-800 rounded-xl bg-indigo-50 dark:bg-indigo-950 shadow-sm focus:ring-2 focus:ring-indigo-600 dark:focus:ring-indigo-400 focus:border-transparent transition-all text-sm sm:text-base text-indigo-900 dark:text-indigo-100"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {activeTab === 'knowledge' && filteredKnowledge.length > 0 && (
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1 px-2 py-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-500 hover:text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-lg transition-all"
            >
              {selectedFiles.length === filteredKnowledge.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              <span className="hidden xs:inline">{selectedFiles.length === filteredKnowledge.length ? 'Deselect All' : 'Select All'}</span>
              <span className="xs:hidden">{selectedFiles.length === filteredKnowledge.length ? 'None' : 'All'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        <AnimatePresence mode="popLayout">
          {activeTab === 'chats' ? (
            filteredSessions.length > 0 ? (
              filteredSessions.map((session) => (
                <motion.div
                  key={session.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`group relative bg-indigo-50 dark:bg-indigo-950 rounded-2xl border transition-all hover:shadow-md ${
                    activeSessionId === session.id ? 'border-indigo-500 dark:border-indigo-400 ring-1 ring-indigo-500 dark:ring-indigo-400' : 'border-indigo-200 dark:border-indigo-800'
                  }`}
                >
                  <div className="p-4 sm:p-5 flex items-start justify-between gap-3 sm:gap-4">
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleSwitch(session.id)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {editingSessionId === session.id ? (
                          <div className="flex items-center gap-2 w-full" onClick={e => e.stopPropagation()}>
                            <input
                              autoFocus
                              className="flex-1 bg-indigo-100 dark:bg-indigo-900 border border-indigo-300 dark:border-indigo-700 rounded px-2 py-1 text-base sm:text-lg font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                              value={newTitle}
                              onChange={(e) => setNewTitle(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleRename(session.id)}
                              onBlur={() => handleRename(session.id)}
                            />
                          </div>
                        ) : (
                          <h3 className="text-base sm:text-lg font-semibold text-indigo-900 dark:text-indigo-50 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {session.title}
                          </h3>
                        )}
                        {activeSessionId === session.id && (
                          <span className="flex-shrink-0 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-[9px] sm:text-[10px] font-bold uppercase rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      
                      <p className="text-xs sm:text-sm text-indigo-700 dark:text-indigo-300 line-clamp-1 mb-2 sm:mb-3">
                        {session.messages.length > 0 
                          ? session.messages[session.messages.length - 1].content 
                          : 'No messages yet'}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-xs text-indigo-500 dark:text-indigo-400">
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1" />
                          {formatDate(session.updatedAt)}
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1" />
                          {formatTime(session.updatedAt)}
                        </div>
                        <div className="flex items-center">
                          <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1" />
                          {session.messages.length} <span className="hidden sm:inline ml-1">messages</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 sm:gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSessionId(session.id);
                          setNewTitle(session.title);
                        }}
                        className="p-1.5 sm:p-2 text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-lg transition-all"
                        title="Rename"
                      >
                        <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm('Are you sure you want to delete this conversation?')) {
                            addToast({ title: "History", message: "Deleting conversation...", type: "info" });
                            await new Promise(resolve => setTimeout(resolve, 500));
                            deleteSession(session.id);
                          }
                        }}
                        className="p-1.5 sm:p-2 text-indigo-500 dark:text-indigo-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        onClick={() => handleSwitch(session.id)}
                        className="p-1.5 sm:p-2 text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-lg transition-all"
                        title="Open Chat"
                      >
                        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-20 bg-indigo-50 dark:bg-indigo-950 rounded-3xl border border-dashed border-indigo-200 dark:border-indigo-800">
                <div className="bg-indigo-100 dark:bg-indigo-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <HistoryIcon className="w-8 h-8 text-indigo-300 dark:text-indigo-600" />
                </div>
                <h3 className="text-lg font-medium text-indigo-900 dark:text-indigo-50">No conversations found</h3>
                <p className="text-indigo-700 dark:text-indigo-300 mt-1">Try a different search or start a new chat.</p>
              </div>
            )
          ) : activeTab === 'knowledge' ? (
            filteredKnowledge.length > 0 ? (
              filteredKnowledge.map((file, idx) => (
                <motion.div
                  key={`${file.name}-${idx}`}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative bg-indigo-50 dark:bg-indigo-950 rounded-2xl border border-indigo-200 dark:border-indigo-800 transition-all hover:shadow-md"
                >
                  <div className="p-4 sm:p-5 flex items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                      <button 
                        onClick={() => toggleFileSelection(file.name)}
                        className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${selectedFiles.includes(file.name) ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900' : 'text-indigo-400 dark:text-indigo-600 hover:text-indigo-500 dark:hover:text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900'}`}
                      >
                        {selectedFiles.includes(file.name) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      </button>
                      
                      <div className="p-2 sm:p-3 bg-indigo-100 dark:bg-indigo-900 rounded-xl group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800 transition-colors flex-shrink-0 hidden xs:flex">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
                          {getFileIcon(file.name)}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm sm:text-base font-semibold text-indigo-900 dark:text-indigo-50 truncate pr-2">
                          {file.name}
                        </h3>
                        <p className="text-[10px] sm:text-xs text-indigo-700 dark:text-indigo-300 line-clamp-1">
                          {file.content.length > 100 ? `${file.content.substring(0, 100)}...` : file.content}
                        </p>
                        <div className="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1 text-[9px] sm:text-xs text-indigo-500 dark:text-indigo-400">
                          <span>{(file.content.length / 1024).toFixed(1)} KB</span>
                          <span className="hidden xs:inline">•</span>
                          <span className="truncate hidden xs:inline">Text Document</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 sm:gap-1">
                      <button
                        onClick={async () => {
                          if (window.confirm(`Are you sure you want to delete "${file.name}" from the knowledge base?`)) {
                            addToast({ title: "Knowledge Base", message: "Removing file...", type: "info" });
                            await new Promise(resolve => setTimeout(resolve, 500));
                            deleteFromKnowledgeBase(file.name);
                          }
                        }}
                        className="p-1.5 sm:p-2 text-indigo-500 dark:text-indigo-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-all"
                        title="Delete File"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-20 bg-indigo-50 dark:bg-indigo-950 rounded-3xl border border-dashed border-indigo-200 dark:border-indigo-800">
                <div className="bg-indigo-100 dark:bg-indigo-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileIcon className="w-8 h-8 text-indigo-300 dark:text-indigo-600" />
                </div>
                <h3 className="text-lg font-medium text-indigo-900 dark:text-indigo-50">Knowledge base is empty</h3>
                <p className="text-indigo-700 dark:text-indigo-300 mt-1">Upload files in the chat to see them here.</p>
              </div>
            )
          ) : (
            filteredProactive.length > 0 ? (
              filteredProactive.map((comm) => (
                <motion.div
                  key={comm.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative bg-indigo-50 dark:bg-indigo-950 rounded-2xl border border-indigo-200 dark:border-indigo-800 transition-all hover:shadow-md"
                >
                  <div className="p-4 sm:p-5 flex items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                      <div className="p-2 sm:p-3 bg-indigo-100 dark:bg-indigo-900 rounded-xl group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800 transition-colors flex-shrink-0">
                        {comm.type === 'message' && <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
                        {comm.type === 'email' && <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
                        {comm.type === 'blog' && <FileCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm sm:text-base font-semibold text-indigo-900 dark:text-indigo-50 truncate pr-2">
                          {comm.title}
                        </h3>
                        <p className="text-[10px] sm:text-xs text-indigo-700 dark:text-indigo-300 line-clamp-1">
                          {comm.content}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 sm:gap-1">
                      <button
                        onClick={async () => {
                          const blob = new Blob([comm.content], { type: 'text/plain' });
                          saveAs(blob, `${comm.title.replace(/\s+/g, '_')}_${new Date(comm.timestamp).toISOString().split('T')[0]}.txt`);
                          addToast({ title: "Proactive", message: "Downloading...", type: "info" });
                        }}
                        className="p-1.5 sm:p-2 text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-lg transition-all"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm(`Are you sure you want to delete this ${comm.type}?`)) {
                            addToast({ title: "Proactive", message: "Removing...", type: "info" });
                            await new Promise(resolve => setTimeout(resolve, 500));
                            deleteProactiveCommunication(comm.id);
                          }
                        }}
                        className="p-1.5 sm:p-2 text-indigo-500 dark:text-indigo-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-20 bg-indigo-50 dark:bg-indigo-950 rounded-3xl border border-dashed border-indigo-200 dark:border-indigo-800">
                <div className="bg-indigo-100 dark:bg-indigo-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileIcon className="w-8 h-8 text-indigo-300 dark:text-indigo-600" />
                </div>
                <h3 className="text-lg font-medium text-indigo-900 dark:text-indigo-50">No proactive communications</h3>
                <p className="text-indigo-700 dark:text-indigo-300 mt-1">Proactive messages, emails, and blog posts will appear here.</p>
              </div>
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  );

};

export default HistoryScreen;
