import { ChatMessage, ChatSession } from '../types';
import { saveToDB, loadFromDB, deleteFromDB } from './db';

const STORAGE_KEYS = {
  SESSIONS: 'indigo_chat_data_session_ids',
  ACTIVE: 'indigo_chat_data_active_session',
  PREFIX: 'indigo_chat_data_session_',
  ACTIVE_PERSONA: 'indigo_chat_data_active_persona',
};

type Listener = () => void;

class MemoryService {
  private sessions: ChatSession[] = [];
  private activeSessionId: string | null = null;
  private activePersonaId: string | null = null;
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
          this.sessions = loaded;
          this.activePersonaId = await loadFromDB(STORAGE_KEYS.ACTIVE_PERSONA) || null;
          const savedActiveId = await loadFromDB(STORAGE_KEYS.ACTIVE);
          const personaSessions = this.getSessionsForPersona(this.activePersonaId);
          if (savedActiveId && personaSessions.find(s => s.id === savedActiveId)) {
            this.activeSessionId = savedActiveId;
          } else if (personaSessions.length > 0) {
            this.activeSessionId = personaSessions[personaSessions.length - 1].id;
          } else {
            this.activeSessionId = null;
          }
        }
      }

      if (this.sessions.length === 0 || !this.activeSessionId) {
        this.createNewSession('Chat');
      }
    } catch (e) {
      console.error('Failed to load memory service data:', e);
      if (this.sessions.length === 0) {
        this.createNewSession('Chat');
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
      await saveToDB(STORAGE_KEYS.ACTIVE_PERSONA, this.activePersonaId);
      for (const session of this.sessions) {
        await saveToDB(`${STORAGE_KEYS.PREFIX}${session.id}`, session);
      }
    } catch (e) {
      console.error('Failed to persist memory:', e);
    }
  }

  private getSessionsForPersona(personaId: string | null): ChatSession[] {
    if (!personaId) return this.sessions.filter(s => !s.personaId);
    return this.sessions.filter(s => s.personaId === personaId);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  public getSessions(): ChatSession[] {
    return this.getSessionsForPersona(this.activePersonaId);
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

  // Called when switching persona — filters session list to that persona only
  public switchToPersona(personaId: string, preferredActiveSessionId?: string | null) {
    this.activePersonaId = personaId;
    const personaSessions = this.getSessionsForPersona(personaId);

    if (preferredActiveSessionId && personaSessions.find(s => s.id === preferredActiveSessionId)) {
      this.activeSessionId = preferredActiveSessionId;
    } else if (personaSessions.length > 0) {
      this.activeSessionId = personaSessions[personaSessions.length - 1].id;
    } else {
      // No sessions yet for this persona — create one
      const newSession: ChatSession = {
        id: 'session-' + Date.now() + '-' + Math.floor(Math.random() * 1000000),
        title: 'Chat',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        personaId,
      };
      this.sessions.push(newSession);
      this.activeSessionId = newSession.id;
    }
    this.persist();
    this.notify();
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
      personaId: this.activePersonaId || undefined,
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
      const personaSessions = this.getSessionsForPersona(this.activePersonaId);
      this.activeSessionId = personaSessions.length > 0
        ? personaSessions[personaSessions.length - 1].id
        : null;
    }
    if (this.getSessionsForPersona(this.activePersonaId).length === 0) {
      this.createNewSession('Chat');
    }
    this.persist();
    this.notify();
  }

  public deleteAllSessions() {
    // Only deletes sessions belonging to the current persona
    const toDelete = this.getSessionsForPersona(this.activePersonaId);
    toDelete.forEach(s => deleteFromDB(`${STORAGE_KEYS.PREFIX}${s.id}`).catch(() => {}));
    this.sessions = this.sessions.filter(s => !toDelete.includes(s));
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

  // Restore sessions from a backup (used by importData in AppContext)
  public async restoreSessions(sessions: ChatSession[], activeSessionId: string | null) {
    for (const s of this.sessions) {
      deleteFromDB(`${STORAGE_KEYS.PREFIX}${s.id}`).catch(() => {});
    }
    this.sessions = sessions.length > 0 ? sessions : [];
    this.activeSessionId = activeSessionId || (sessions.length > 0 ? sessions[0].id : null);
    if (this.sessions.length === 0) {
      this.createNewSession('Chat');
    } else {
      await this.persist();
      this.notify();
    }
  }
}

export const memoryService = new MemoryService();
