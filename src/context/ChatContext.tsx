import React, { createContext, useContext, useState, ReactNode, useEffect, useLayoutEffect } from 'react';
import { ChatMessage, ChatSession } from '../types';
import { memoryService } from '../services/MemoryService';

interface ChatContextType {
  chatHistory: ChatMessage[];
  setChatHistory: (history: ChatMessage[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  updateChatMessage: (id: string, newContent: string) => void;
  deleteChatMessage: (id: string) => void;
  rateChatMessage: (id: string, rating: 'up' | 'down' | number | null) => void;
  addFeedbackComment: (id: string, comment: string) => void;
  clearHistory: () => void;
  sessions: ChatSession[];
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  createNewSession: (title?: string) => void;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, newTitle: string) => void;
  deleteAllSessions: () => void;
  isSuccessfullyLoaded: boolean;
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [stamp, setStamp] = useState(0);

  useEffect(() => {
    return memoryService.subscribe(() => setStamp(s => s + 1));
  }, []);

  const val: ChatContextType = {
    chatHistory: memoryService.getChatHistory(),
    setChatHistory: () => {}, // unused
    addChatMessage: (m) => memoryService.addChatMessage(m),
    updateChatMessage: (i, c) => memoryService.updateChatMessage(i, c),
    deleteChatMessage: (i) => memoryService.deleteChatMessage(i),
    rateChatMessage: () => {},
    addFeedbackComment: () => {},
    clearHistory: () => memoryService.clearHistory(),
    sessions: memoryService.getSessions(),
    setSessions: () => {},
    activeSessionId: memoryService.getActiveSessionId(),
    setActiveSessionId: (id) => { if (id) memoryService.switchSession(id); },
    createNewSession: (t) => memoryService.createNewSession(t),
    switchSession: (id) => memoryService.switchSession(id),
    deleteSession: (id) => memoryService.deleteSession(id),
    renameSession: (id, t) => memoryService.renameSession(id, t),
    deleteAllSessions: () => memoryService.deleteAllSessions(),
    isSuccessfullyLoaded: memoryService.isLoaded,
  };

  return <ChatContext.Provider value={val}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
};
