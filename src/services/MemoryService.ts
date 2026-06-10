import { ChatMessage, ChatSession } from '../types';
import { saveToDB, loadFromDB, deleteFromDB } from './db';

const STORAGE_KEYS = {
  SESSIONS: 'indigo_chat_data_session_ids',
  ACTIVE: 'indigo_chat_data_active_session',
  PREFIX: 'indigo_chat_data_session_'
};

type Listener = () => void;

class MemoryService {
  private sessions: ChatSession[] = [];
  private activeSessionId: string | null = null;
  private listeners: Set<Listener> = new Set();
  public isLoaded = false;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const sessionIds = await loadFromDB(STORAGE_KEYS.SESSIONS);
      if (sessionIds && Array.isArray(sessionIds) && sessionIds.length > 0) {
        const loaded: ChatSession[] = [];
        for (const id of sessionIds) {
          const raw = await loadFromDB(`${STORAGE_KEYS.PREFIX}${id}`);
          if (raw) loaded.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
        }
        if (loaded.length > 0) {
          const activeId = await loadFromDB(STORAGE_KEYS.ACTIVE) || loaded[0].id;
          this.sessions = loaded;
          this.activeSessionId = activeId;
        }
      }

      if (this.sessions.length === 0) {
        this.createNewSession('Initial Session');
      }
    } catch (e) {
      console.error('Failed to load memory service data:', e);
      if (this.sessions.length === 0) {
        this.createNewSession('Initial Session');
      }
    } finally {
      this.isLoaded = true;
      this.notify();
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  private async persist() {
    try {
      await saveToDB(STORAGE_KEYS.SESSIONS, this.sessions.map((s) => s.id));
      await saveToDB(STORAGE_KEYS.ACTIVE, this.activeSessionId);
      for (const session of this.sessions) {
        await saveToDB(`${STORAGE_KEYS.PREFIX}${session.id}`, session);
      }
    } catch (e) {
      console.error('Failed to persist memory:', e);
    }
  }

  public getSessions() {
    return this.sessions;
  }

  public getActiveSessionId() {
    return this.activeSessionId;
  }

  public getActiveSession(): ChatSession | null {
    return this.sessions.find(s => s.id === this.activeSessionId) || null;
  }

  public getChatHistory(): ChatMessage[] {
    const active = this.getActiveSession();
    return active ? active.messages : [];
  }

  public addChatMessage(message: ChatMessage) {
    const active = this.getActiveSession();
    if (active) {
      active.messages.push(message);
      active.updatedAt = Date.now();
      this.persist();
      this.notify();
    }
  }

  public updateChatMessage(id: string, newContent: string) {
    const active = this.getActiveSession();
    if (active) {
      const msg = active.messages.find(m => m.id === id);
      if (msg) {
        msg.content = newContent;
        active.updatedAt = Date.now();
        this.persist();
        this.notify();
      }
    }
  }

  public deleteChatMessage(id: string) {
    const active = this.getActiveSession();
    if (active) {
      active.messages = active.messages.filter(m => m.id !== id);
      active.updatedAt = Date.now();
      this.persist();
      this.notify();
    }
  }

  public clearHistory() {
    const active = this.getActiveSession();
    if (active) {
      active.messages = [];
      active.updatedAt = Date.now();
      this.persist();
      this.notify();
    }
  }

  public createNewSession(title: string = 'Chat') {
    const newSession: ChatSession = {
      id: 'session-' + Date.now() + '-' + Math.floor(Math.random() * 1000000),
      title,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.sessions.push(newSession);
    this.activeSessionId = newSession.id;
    this.persist();
    this.notify();
  }

  public switchSession(sessionId: string) {
    if (this.sessions.find(s => s.id === sessionId)) {
      this.activeSessionId = sessionId;
      this.persist();
      this.notify();
    }
  }

  public deleteSession(sessionId: string) {
    this.sessions = this.sessions.filter(s => s.id !== sessionId);
    deleteFromDB(`${STORAGE_KEYS.PREFIX}${sessionId}`).catch(() => {});
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = this.sessions.length > 0 ? this.sessions[this.sessions.length - 1].id : null;
    }
    if (this.sessions.length === 0) {
       this.createNewSession('Chat');
    }
    this.persist();
    this.notify();
  }

  public deleteAllSessions() {
    this.sessions.forEach(s => deleteFromDB(`${STORAGE_KEYS.PREFIX}${s.id}`).catch(() => {}));
    this.sessions = [];
    this.activeSessionId = null;
    this.createNewSession('Chat');
  }

  public renameSession(sessionId: string, newTitle: string) {
    const s = this.sessions.find(x => x.id === sessionId);
    if (s) {
      s.title = newTitle;
      s.updatedAt = Date.now();
      this.persist();
      this.notify();
    }
  }
}

export const memoryService = new MemoryService();
