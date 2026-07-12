import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { gzipSync, strToU8, gunzipSync, strFromU8 } from 'fflate';
import { saveToDB, loadFromDB, deleteFromDB, clearDB } from '../services/db';
import { onForegroundMessage, requestNotificationPermission } from '../services/webPushService';
import { showNativeNotification } from '../services/notificationService';
import { backupToFirestore, restoreFromFirestore, uploadGalleryToFirebaseStorage, restoreGalleryFromFirebaseStorage, uploadKnowledgeBaseToFirebaseStorage, restoreKnowledgeBaseFromFirebaseStorage, uploadChatHistoryToFirebaseStorage, restoreChatHistoryFromFirebaseStorage, signInWithGoogle as fbSignInWithGoogle, signOutUser as fbSignOutUser, onAuthStateChange, FirebaseUser } from '../services/firebaseService';
import { AIProfile, UserProfile, ChatMessage, GalleryItem, JournalEntry, Memory, KnowledgeBaseDocument, ChatSession, ProactiveCommunication } from '../types';
import { memoryService } from '../services/MemoryService';

export interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

interface AppState {
  aiProfile: AIProfile;
  savedPersonas: AIProfile[];
  userProfile: UserProfile;
  gallery: GalleryItem[];
  journal: JournalEntry[];
  knowledgeBase: { name: string; content: string }[]; // Simple text files
  memories: Memory[];
  proactiveCommunications: ProactiveCommunication[];
  toasts: Toast[];
  apiKey: string | null;
  autoSaveChat: boolean;
  autoSaveChatInterval: number; // in seconds
  autoJsonBackup: boolean;
  autoJsonBackupInterval: number; // in minutes
  proactiveMessageFrequency: '1h' | '6h' | '12h' | '24h' | 'off' | 'low' | 'medium' | 'high';
  proactiveEmailFrequency: '1h' | '6h' | '12h' | '24h' | 'off' | 'low' | 'medium' | 'high';
  isSyncEnabled: boolean;
  syncFrequency: number;
  notificationsEnabled: boolean;
  fcmToken: string | null;
  showTimestamps: boolean;
  ambientMode: boolean;
  ambientFrequency: '1h' | '6h' | '12h' | '24h' | 'off' | 'low' | 'medium' | 'high';
  aiCanGenerateImages: boolean;
  isDebuggerEnabled: boolean;
  timeZone: string;
  firebaseApiKey: string | null;
  firebaseAuthDomain: string | null;
  firebaseProjectId: string | null;
  firebaseStorageBucket: string | null;
  firebaseAppId: string | null;
  firebaseMessagingSenderId: string | null;
  anthropicApiKey: string | null;
  elevenLabsApiKey: string | null;
  setElevenLabsApiKey: (key: string | null) => void;
  geminiApiKey: string | null;
  setGeminiApiKey: (key: string | null) => void;
  openrouterApiKey: string | null;
  setOpenrouterApiKey: (key: string | null) => void;
  wavespeedApiKey: string | null;
  setWavespeedApiKey: (key: string | null) => void;
  lastInteractionTime: number;
  userId: string;
  isSuccessfullyLoaded: boolean;
  galleryLoaded: boolean;
  isPersonaSwitching: boolean;
}

interface AppContextType extends AppState {
  setAIProfile: (profile: AIProfile) => void;
  savePersona: (profile: AIProfile, chatHistory: ChatMessage[], sessions: ChatSession[], activeSessionId: string | null) => void;
  deletePersona: (id: string) => void;
  loadPersona: (id: string, currentChatHistory: ChatMessage[], currentSessions: ChatSession[], currentActiveSessionId: string | null, setChatHistory: (h: ChatMessage[]) => void, setSessions: (s: ChatSession[]) => void, setActiveSessionId: (id: string | null) => void) => void;
  setUserProfile: (profile: UserProfile) => void;
  setUserReferenceImage: (image: string | null) => void;
  setIsSyncEnabled: (enabled: boolean) => void;
  setSyncFrequency: (frequency: number) => void;
  setFcmToken: (token: string | null) => void;
  addToGallery: (item: GalleryItem) => void;
  addMultipleToGallery: (items: GalleryItem[]) => void;
  deleteImageFromGallery: (id: string) => void;
  deleteImagesFromGallery: (ids: string[]) => void;
  updateGalleryItem: (id: string, updates: Partial<GalleryItem>) => void;
  addJournalEntry: (entry: JournalEntry) => void;
  updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void;
  deleteJournalEntry: (id: string) => void;
  addToKnowledgeBase: (file: { name: string; content: string }) => void;
  addMultipleToKnowledgeBase: (files: { name: string; content: string }[]) => void;
  deleteFromKnowledgeBase: (name: string) => void;
  deleteMultipleFromKnowledgeBase: (names: string[]) => void;
  addMemory: (memory: Memory) => void;
  updateMemory: (id: string, updates: Partial<Memory>) => void;
  deleteMemory: (id: string) => void;
  addProactiveCommunication: (comm: ProactiveCommunication) => void;
  deleteProactiveCommunication: (id: string) => void;
  addToast: (toast: Omit<Toast, 'id' | 'timestamp'>) => void;
  removeToast: (id: string) => void;
  resetApp: () => Promise<void>;
  exportData: (chatHistory: ChatMessage[], sessions: ChatSession[], activeSessionId: string | null) => Promise<any>;
  exportGalleryData: () => Promise<Uint8Array>;
  exportGalleryChunks: (chunkSize?: number, mediaType?: 'image' | 'video') => Promise<Uint8Array[]>;
  importGalleryData: (compressedData: Uint8Array) => Promise<void>;
  importGalleryChunks: (chunks: Uint8Array[]) => Promise<void>;
  syncGalleryToCloud: (mediaType?: 'image' | 'video') => Promise<void>;
  restoreGalleryFromCloud: (mediaType?: 'image' | 'video') => Promise<void>;
  importData: (json: string, setChatHistory: (history: ChatMessage[]) => void, setSessions: (sessions: ChatSession[]) => void, setActiveSessionId: (id: string | null) => void) => void;
  setApiKey: (key: string | null) => void;
  lastCloudSyncTime: number | null;
  lastFirebaseBackupTime: number | null;
  lastGalleryBackupTime: number | null;
  lastKBBackupTime: number | null;
  lastAutoJsonBackupTime: number | null;
  setLastCloudSyncTime: (t: number | null) => void;
  setLastFirebaseBackupTime: (t: number | null) => void;
  setLastGalleryBackupTime: (t: number | null) => void;
  setLastKBBackupTime: (t: number | null) => void;
  setLastAutoJsonBackupTime: (t: number | null) => void;
  restoreFromLocalAutoBackup: () => Promise<any | null>;
  saveLocalAutoBackup: (data: any) => Promise<void>;
  setAnthropicApiKey: (key: string | null) => void;
  showTutorial: boolean;
  setShowTutorial: (show: boolean) => void;
  setAutoSaveChat: (enabled: boolean) => void;
  setAutoSaveChatInterval: (interval: number) => void;
  setAutoJsonBackup: (enabled: boolean) => void;
  setAutoJsonBackupInterval: (interval: number) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setShowTimestamps: (show: boolean) => void;
  setProactiveMessageFrequency: (frequency: '1h' | '6h' | '12h' | '24h' | 'off' | 'low' | 'medium' | 'high') => void;
  proactiveEmailFrequency: 'off' | '1h' | '6h' | '12h' | '24h' | 'low' | 'medium' | 'high';
  setProactiveEmailFrequency: (frequency: '1h' | '6h' | '12h' | '24h' | 'off' | 'low' | 'medium' | 'high') => void;
  setAmbientMode: (enabled: boolean) => void;
  setAmbientFrequency: (frequency: '1h' | '6h' | '12h' | '24h' | 'off' | 'low' | 'medium' | 'high') => void;
  setAiCanGenerateImages: (enabled: boolean) => void;
  setIsDebuggerEnabled: (enabled: boolean) => void;
  setTimeZone: (tz: string) => void;
  updateAIProfile: (updates: Partial<AIProfile>) => void;
  fetchWithRetry: (url: string, options: RequestInit, retries?: number, backoff?: number) => Promise<Response>;
  firebaseBackup: (data: any) => Promise<void>;
  firebaseRestore: () => Promise<any | null>;
  firebaseGalleryBackup: (onProgress?: (done: number, total: number) => void) => Promise<number>;
  firebaseGalleryRestore: (onProgress?: (done: number, total: number) => void) => Promise<number>;
  firebaseKBBackup: (onProgress?: (done: number, total: number) => void) => Promise<number>;
  firebaseKBRestore: (onProgress?: (done: number, total: number) => void) => Promise<number>;
  firebaseChatBackup: (sessions: ChatSession[], activeSessionId: string | null) => Promise<number>;
  firebaseChatRestore: () => Promise<number>;
  applyRestoredSessions: (sessions: ChatSession[], activeSessionId: string | null) => Promise<void>;
  lastChatBackupTime: number | null;
  setLastChatBackupTime: (t: number | null) => void;
  realTimeSyncEnabled: boolean;
  setRealTimeSyncEnabled: (enabled: boolean) => void;
  autoBackupSchedule: 'off' | 'daily' | 'weekly';
  setAutoBackupSchedule: (s: 'off' | 'daily' | 'weekly') => void;
  firebaseApiKey: string | null;
  firebaseAuthDomain: string | null;
  firebaseProjectId: string | null;
  firebaseStorageBucket: string | null;
  firebaseAppId: string | null;
  firebaseMessagingSenderId: string | null;
  setFirebaseConfig: (config: {
    apiKey?: string | null; authDomain?: string | null; projectId?: string | null;
    storageBucket?: string | null; appId?: string | null;
    messagingSenderId?: string | null;
  }) => void;
  userLocation: { lat: number; lon: number; label: string } | null;
  userMotion: {
    activity: string;
    speed: number | null;
    orientation: { alpha: number | null; beta: number | null; gamma: number | null };
    acceleration: { x: number | null; y: number | null; z: number | null };
  } | null;
  environmentalSituation: {
    situation: string;        // human-readable summary for the AI prompt
    motionActivity: string;
    lightLevel: 'bright' | 'dim' | 'dark' | 'unknown';
    soundLevel: 'loud' | 'moderate' | 'quiet' | 'silent' | 'unknown';
    stillnessDurationMinutes: number;
    lastChangeType: 'movement_started' | 'movement_stopped' | 'light_changed' | 'sound_changed' | 'none';
    timestamp: number;
  } | null;
  isSuccessfullyLoaded: boolean;
  isLoaded: boolean;
  lastInteractionTime: number;
  setLastInteractionTime: (time: number) => void;
  userId: string;
  setUserId: (id: string) => void;
  isSyncing: boolean;
  setIsSyncing: (syncing: boolean) => void;
  galleryLoaded: boolean;
  loadGallery: () => Promise<void>;
  reloadGallery: () => Promise<void>;
  getGalleryItemUrl: (id: string) => Promise<string | null>;
  galleryLoading: boolean;
  resolveProfileImagesFromGallery: () => Promise<void>;
  currentUser: FirebaseUser | null;
  authLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initial States
  const [showTutorial, setShowTutorial] = useState(false);
  const [aiProfile, setAIProfileState] = useState<AIProfile>({
    id: 'default',
    name: 'Indigo',
    personality: 'Helpful, creative, and observant.',
    behavioralPatterns: '',
    goals: '',
    coreValues: '',
    likes: '',
    dislikes: '',
    speakingStyle: '',
    backstory: 'I am an AI companion created to assist and inspire.',
    appearance: 'A digital entity with a calming indigo aura.',
    referenceImage: null,
    voiceURI: null,
    voicePitch: 1.0,
    voiceSpeed: 1.0,
    autoReadMessages: false,
    voiceProvider: 'browser',
    responseLength: 'medium',
    responseDetail: 'medium',
    responseTone: 'friendly',
    customParagraphCount: null,
    customWordCount: null,
    proactiveMessageFrequency: 'off',
    proactiveEmailFrequency: 'off',
    proactiveEmailStyle: 'personal',
    proactiveEmailParagraphs: 3,
    proactiveBlogFrequency: 'off',
    proactiveBlogStyle: 'journal',
    proactiveBlogParagraphs: 5,
    proactiveBlogId: null,
    model: 'gemini-3.5-flash',
    temperature: 0.7,
    timeAwareness: true,
    ambientMode: false,
    ambientFrequency: 'off',
    aiCanGenerateImages: false,
    imageStyle: 'none',
    imageGenerationInstructions: [
      "If a character reference image is provided, you MUST use it as the absolute source of truth.",
      "COPY the face, body type, skin tone, hair color, and all physical features EXACTLY from the reference image.",
      "You are ONLY permitted to modify the pose, clothing, facial expression, and eye position.",
      "DO NOT alter the body type (muscularity, bust size, etc.) or facial structure in any way.",
      "If the prompt or description contradicts the reference image, the reference image ALWAYS takes precedence.",
    ],
    aiCanGenerateSpeech: false,
    aiCanUseTools: false,
    aiCanUseWebSearch: false,
    aiCanUseCalendar: false,
    aiCanUseGmail: false,
    aiCanUseYouTube: false,
    aiCanUseGoogleMaps: false,
    aiCanUseBlogger: false,
    aiCanBrowse: false,
    aiCanSendProactiveEmails: false,
    knowsItsAI: true,
    memories: [],
    journal: [],
  });

  const [savedPersonas, setSavedPersonas] = useState<AIProfile[]>([]);

  const [userProfile, setUserProfileState] = useState<UserProfile>({
    name: 'User',
    email: '',
    info: '',
    preferences: '',
    appearance: '',
    referenceImage: null,
  });

  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [galleryLoaded, setGalleryLoaded] = useState(false);
  // Tracks which gallery items have already been persisted to IndexedDB (by
  // reference) so the save effect further below only writes items that are
  // actually new or changed, instead of re-writing the entire gallery every
  // time the array changes. See loadGallery() and the gallery save effect.
  const savedGalleryItemsRef = React.useRef<Map<string, GalleryItem>>(new Map());

  // Items whose base64 data exceeds this are kept out of memory. This is
  // deliberately generous — normal AI-generated images and reasonably-sized
  // photos are nowhere near this — it's aimed at full-resolution phone
  // camera photos (uncompressed uploads can easily be 5-15MB+ each), which
  // is exactly the kind of thing that can crash a phone browser once you
  // have a few dozen of them all loaded into memory simultaneously.
  const OVERSIZED_ITEM_THRESHOLD_CHARS = 8 * 1024 * 1024; // ~8MB of base64 text

  // Guards: only ONE gallery load may ever run at a time. During app startup
  // the Gallery screen's load effect re-fires repeatedly (the app is still
  // settling, which re-renders the provider and hands the screen a fresh
  // loadGallery reference each time). Previously every re-fire started
  // ANOTHER full read of all gallery items in parallel — several concurrent
  // scans each holding multi-MB images in flight is exactly the memory spike
  // that crashed the tab when opening the gallery right after app launch.
  const galleryLoadInFlightRef = useRef(false);
  const galleryLoadedRef = useRef(false);
  const [galleryLoading, setGalleryLoading] = useState(false);

  // Reads every stored item once to build the lightweight index. Only needed
  // the first time after this update, or if the index ever falls out of step
  // with the id list (it then self-heals here).
  const scanAllItemMetadata = async (galleryIds: string[]): Promise<GalleryItem[]> => {
    const out: GalleryItem[] = [];
    for (const id of galleryIds) {
      let itemStr = await loadFromDB(`indigo_app_data_gallery_item_${id}`);
      if (!itemStr) continue;
      const isString = typeof itemStr === 'string';
      const approxLen = isString ? itemStr.length : JSON.stringify(itemStr).length;
      try {
        const parsed = isString ? JSON.parse(itemStr) : itemStr;
        itemStr = null; // release the raw string as soon as possible
        const url: string = typeof parsed.url === 'string' ? parsed.url : '';
        const inferredMediaType = parsed.mediaType
          ?? (url.startsWith('data:video/') || url.includes('.mp4') || url.includes('.webm') ? 'video' : 'image');
        const oversized = approxLen > OVERSIZED_ITEM_THRESHOLD_CHARS;
        out.push({
          id: parsed.id ?? id,
          type: parsed.type ?? 'uploaded',
          mediaType: inferredMediaType,
          url: '', // image data deliberately not held in memory
          prompt: parsed.prompt,
          provider: parsed.provider,
          timestamp: parsed.timestamp ?? parsed.createdAt ?? 0,
          personaId: parsed.personaId,
          onDisk: true, // full data lives in IndexedDB — never overwrite it with this placeholder
          ...(oversized ? { oversized: true, approxSizeMB: Math.round((approxLen / 1024 / 1024) * 10) / 10 } : {}),
        } as any);
      } catch {
        console.error(`Gallery item ${id} could not be parsed and was skipped.`);
      }
    }
    return out;
  };

  const doLoadGallery = async () => {
    if (galleryLoadInFlightRef.current) return; // a load is already running — never start a second one
    galleryLoadInFlightRef.current = true;
    setGalleryLoading(true);
    try {
      console.log("Loading gallery index...", Date.now());
      const galleryIds: string[] = (await loadFromDB('indigo_app_data_gallery_ids')) || [];

      // Fast path: a single small index record holds the metadata for every
      // item, so opening the gallery reads ONE tiny value — no full-size
      // image data is touched at all.
      let galleryData: GalleryItem[] | null = null;
      try {
        const meta = await loadFromDB('indigo_app_data_gallery_meta');
        if (Array.isArray(meta)) {
          const metaIds = new Set(meta.map((m: any) => m?.id));
          const inStep = metaIds.size === galleryIds.length && galleryIds.every(id => metaIds.has(id));
          if (inStep) galleryData = meta as GalleryItem[];
        }
      } catch { /* fall through to the one-time scan */ }

      // Migration / self-heal: build the index once, then persist it so every
      // future load takes the fast path.
      if (!galleryData) {
        galleryData = await scanAllItemMetadata(galleryIds);
        try { await saveToDB('indigo_app_data_gallery_meta', galleryData); } catch { /* next load rescans */ }
      }

      // Merge, don't overwrite: something may have called addToGallery /
      // addMultipleToGallery while this scan was running (most commonly, a
      // profile photo saved right after app launch, racing the automatic
      // background gallery load). A plain setGallery(galleryData) would wipe
      // that brand-new item straight out of state — it isn't on disk yet, so
      // it can't be in this scan's results — which orphaned the persona's
      // referenceImageGalleryId permanently (see syncReferenceImageGalleryLink's
      // self-heal for the recovery half of this fix). Keep anything present
      // in the live state that this scan doesn't know about yet.
      const scannedIds = new Set(galleryData.map(item => item.id));
      setGallery(prev => {
        const extras = prev.filter(item => !scannedIds.has(item.id));
        return extras.length > 0 ? [...extras, ...galleryData] : galleryData;
      });
      // Mark everything just loaded as already "saved" so the save effect
      // doesn't immediately re-write anything back to IndexedDB.
      const loadedMap = new Map<string, GalleryItem>();
      for (const item of galleryData) loadedMap.set(item.id, item);
      savedGalleryItemsRef.current = loadedMap;
      galleryLoadedRef.current = true;
      setGalleryLoaded(true);
      console.log("Gallery index loaded", Date.now());
    } finally {
      galleryLoadInFlightRef.current = false;
      setGalleryLoading(false);
    }
  };

  const loadGallery = async () => {
    if (galleryLoadedRef.current || galleryLoaded) return;
    await doLoadGallery();
  };

  // Re-reads the gallery from IndexedDB even if it's already loaded. Used after
  // a restore writes images straight to disk (bypassing React state so the
  // whole gallery is never held in memory at once during the download).
  const reloadGallery = async () => {
    await doLoadGallery();
  };

  // ── On-demand image data loader ──────────────────────────────────────────────
  // Gallery state only holds metadata; this fetches one item's actual image
  // data from IndexedDB when the Gallery screen needs to show it. A small
  // most-recently-used cache keeps scrolling back and forth smooth without
  // letting memory grow with gallery size.
  const galleryUrlCacheRef = useRef<Map<string, string>>(new Map());
  const GALLERY_URL_CACHE_MAX = 24;
  const getGalleryItemUrl = React.useCallback(async (id: string): Promise<string | null> => {
    // Freshly added items (this session) still carry their url in state
    const inState = gallery.find(g => g.id === id);
    if (inState?.url) return inState.url;

    const cache = galleryUrlCacheRef.current;
    const cached = cache.get(id);
    if (cached) {
      cache.delete(id);
      cache.set(id, cached); // bump to most-recent
      return cached;
    }

    try {
      const itemStr = await loadFromDB(`indigo_app_data_gallery_item_${id}`);
      if (!itemStr) return null;
      const parsed = typeof itemStr === 'string' ? JSON.parse(itemStr) : itemStr;
      const url: string | null = typeof parsed?.url === 'string' && parsed.url ? parsed.url : null;
      if (url) {
        cache.set(id, url);
        while (cache.size > GALLERY_URL_CACHE_MAX) {
          const oldest = cache.keys().next().value;
          if (oldest === undefined) break;
          cache.delete(oldest);
        }
      }
      return url;
    } catch {
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gallery]);

  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<{ name: string; content: string }[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [proactiveCommunications, setProactiveCommunications] = useState<ProactiveCommunication[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [lastCloudSyncTime,      setLastCloudSyncTimeState]      = useState<number | null>(null);
  const [lastFirebaseBackupTime, setLastFirebaseBackupTimeState] = useState<number | null>(null);
  const [lastGalleryBackupTime,  setLastGalleryBackupTimeState]  = useState<number | null>(null);
  const [lastKBBackupTime,       setLastKBBackupTimeState]       = useState<number | null>(null);
  const [lastChatBackupTime,     setLastChatBackupTimeState]     = useState<number | null>(null);
  const [lastAutoJsonBackupTime, setLastAutoJsonBackupTimeState] = useState<number | null>(null);
  const [autoBackupSchedule,     setAutoBackupScheduleState]     = useState<'off' | 'daily' | 'weekly'>('off');
  const [realTimeSyncEnabled,    setRealTimeSyncEnabledState]    = useState(false);
  const [anthropicApiKey, setAnthropicApiKeyState] = useState<string | null>(null);
  const [elevenLabsApiKey, setElevenLabsApiKeyState] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKeyState] = useState<string | null>(null);
  const [openrouterApiKey, setOpenrouterApiKeyState] = useState<string | null>(null);
  const [wavespeedApiKey, setWavespeedApiKeyState] = useState<string | null>(null);
  const [autoSaveChat, setAutoSaveChatState] = useState(true);
  const [autoSaveChatInterval, setAutoSaveChatInterval] = useState(30); // Default 30 seconds
  const [autoJsonBackup, setAutoJsonBackupState] = useState(false);
  const [autoJsonBackupInterval, setAutoJsonBackupIntervalState] = useState(5); // Default 5 minutes
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFrequency, setSyncFrequency] = useState(5); // Default 5 minutes
  const [notificationsEnabled, setNotificationsEnabledState] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );
  const [fcmToken, setFcmTokenState] = useState<string | null>(null);
  const [isDebuggerEnabled, setIsDebuggerEnabledState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('indigo_debugger_enabled') === 'true';
    }
    return false;
  });
  const [showTimestamps, setShowTimestampsState] = useState(true);
  const [timeZone, setTimeZoneState] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [firebaseApiKey,           setFirebaseApiKey]           = useState<string | null>(null);
  const [firebaseAuthDomain,       setFirebaseAuthDomain]       = useState<string | null>(null);
  const [firebaseProjectId,        setFirebaseProjectId]        = useState<string | null>(null);
  const [firebaseStorageBucket,    setFirebaseStorageBucket]    = useState<string | null>(null);
  const [firebaseAppId,            setFirebaseAppId]            = useState<string | null>(null);
  const [firebaseMessagingSenderId,setFirebaseMessagingSenderId]= useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [lastInteractionTime, setLastInteractionTime] = useState(Date.now());
  const [userId, setUserId] = useState<string>(() => {
    const storedId = localStorage.getItem('indigo_user_id') || '';
    if (storedId === '1772969457324cxo5dyvni') {
      localStorage.removeItem('indigo_user_id');
      return '';
    }
    return storedId;
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [userMotion, setUserMotion] = useState<{
    activity: string;
    speed: number | null;
    orientation: { alpha: number | null; beta: number | null; gamma: number | null };
    acceleration: { x: number | null; y: number | null; z: number | null };
  } | null>(null);
  const [environmentalSituation, setEnvironmentalSituation] = useState<{
    situation: string;
    motionActivity: string;
    lightLevel: 'bright' | 'dim' | 'dark' | 'unknown';
    soundLevel: 'loud' | 'moderate' | 'quiet' | 'silent' | 'unknown';
    stillnessDurationMinutes: number;
    lastChangeType: 'movement_started' | 'movement_stopped' | 'light_changed' | 'sound_changed' | 'none';
    timestamp: number;
  } | null>(null);
  const [isSuccessfullyLoaded, setIsSuccessfullyLoaded] = useState(false);

  // Kick off the gallery index load automatically once the rest of the app's
  // data has loaded — instead of waiting for the person to open the Gallery
  // screen. The load is single-flight-guarded (see doLoadGallery), so if they
  // open Gallery while this is still running, that just waits on the same
  // load rather than starting a second one. In practice the index is usually
  // ready before they ever tap Gallery, so there's nothing left to wait for.
  useEffect(() => {
    if (!isSuccessfullyLoaded || galleryLoadedRef.current) return;
    loadGallery().then(() => { resolveProfileImagesFromGallery(); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccessfullyLoaded]);
  const [isPersonaSwitching, setIsPersonaSwitching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showResetOption, setShowResetOption] = useState(false);
  const MAX_MEMORIES = 20; // Define maximum number of memories

  const initialAIProfileState: AIProfile = {
    id: 'default',
    name: 'Indigo',
    personality: 'Helpful, creative, and observant.',
    behavioralPatterns: '',
    goals: '',
    coreValues: '',
    likes: '',
    dislikes: '',
    speakingStyle: '',
    backstory: 'I am an AI companion created to assist and inspire.',
    appearance: 'A digital entity with a calming indigo aura.',
    referenceImage: null,
    voiceURI: null,
    voicePitch: 1.0,
    voiceSpeed: 1.0,
    autoReadMessages: false,
    voiceProvider: 'browser',
    responseLength: 'medium',
    responseDetail: 'medium',
    responseTone: 'friendly',
    customParagraphCount: null,
    customWordCount: null,
    proactiveMessageFrequency: 'off',
    proactiveEmailFrequency: 'off',
    proactiveBlogFrequency: 'off',
    proactiveBlogId: null,
    llmProvider: 'gemini',
    model: 'gemini-3.5-flash',
    temperature: 0.7,
    timeAwareness: true,
    ambientMode: false,
    ambientFrequency: 'off',
    aiCanGenerateImages: false,
    imageStyle: 'none',
    imageGenerationInstructions: [
      "If a character reference image is provided, you MUST use it as the absolute source of truth.",
      "COPY the face, body type, skin tone, hair color, and all physical features EXACTLY from the reference image.",
      "You are ONLY permitted to modify the pose, clothing, facial expression, and eye position.",
      "DO NOT alter the body type (muscularity, bust size, etc.) or facial structure in any way.",
      "If the prompt or description contradicts the reference image, the reference image ALWAYS takes precedence.",
    ],
    aiCanGenerateSpeech: false,
    aiCanUseTools: false,
    aiCanUseWebSearch: false,
    aiCanUseCalendar: false,
    aiCanUseGmail: false,
    aiCanUseYouTube: false,
    aiCanUseGoogleMaps: false,
    aiCanUseBlogger: false,
    aiCanBrowse: false,
    aiCanSendProactiveEmails: false,
    knowsItsAI: true,
    memories: [],
    journal: [],
  };

  const initialUserProfileState: UserProfile = {
    name: 'User',
    email: '',
    info: '',
    preferences: '',
    appearance: '',
    referenceImage: null,
  };

  // Function to prune or consolidate memories
  const pruneMemories = (currentMemories: Memory[]): Memory[] => {
    if (currentMemories.length <= MAX_MEMORIES) {
      return currentMemories;
    }

    // Separate important memories
    const importantMemories = currentMemories.filter(m => m.isImportant);
    let nonImportantMemories = currentMemories.filter(m => !m.isImportant);

    // If important memories alone exceed limit, prune them too (e.g., oldest important first)
    if (importantMemories.length > MAX_MEMORIES) {
      return importantMemories.sort((a, b) => a.timestamp - b.timestamp).slice(0, MAX_MEMORIES);
    }

    // Sort for pruning: weakest first, then oldest first among equal strength.
    // We want to DISCARD from the front, so slice from the end to keep the best ones.
    nonImportantMemories.sort((a, b) => {
      if (a.strength !== b.strength) {
        return a.strength - b.strength; // weakest first → pruned first
      }
      return a.lastAccessed - b.lastAccessed; // oldest first → pruned first
    });

    // Determine how many non-important memories to keep
    const numToKeep = MAX_MEMORIES - importantMemories.length;
    // slice from the END to keep the strongest/most-recent memories
    let keptNonImportantMemories = nonImportantMemories.slice(-numToKeep);

    // Combine and return
    return [...importantMemories, ...keptNonImportantMemories];
  };

  // Load from IndexedDB on mount
  // ── Geolocation: request once on mount ──────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const geo = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const geoData = await geo.json();
          const city =
            geoData.address?.city ||
            geoData.address?.town ||
            geoData.address?.village ||
            geoData.address?.county ||
            'Unknown location';
          const region = geoData.address?.state || geoData.address?.country || '';
          const label = region ? `${city}, ${region}` : city;
          setUserLocation({ lat, lon, label });
        } catch {
          setUserLocation({ lat, lon, label: `${lat.toFixed(2)}, ${lon.toFixed(2)}` });
        }
      },
      () => { /* permission denied — silently skip */ }
    );
  }, []);

  // ── Motion sensors: DeviceMotion + DeviceOrientation ─────────────────────
  useEffect(() => {
    let latestAccel = { x: null as number | null, y: null as number | null, z: null as number | null };
    let latestOrientation = { alpha: null as number | null, beta: null as number | null, gamma: null as number | null };
    let latestSpeed = null as number | null;

    const classifyActivity = (
      accel: { x: number | null; y: number | null; z: number | null },
      speed: number | null
    ): string => {
      const x = accel.x ?? 0;
      const y = accel.y ?? 0;
      const z = accel.z ?? 0;
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (speed !== null && speed > 5) return 'in a vehicle';
      if (magnitude > 15) return 'moving vigorously';
      if (magnitude > 4) return 'walking or moving';
      return 'stationary or resting';
    };

    const updateMotion = () => {
      setUserMotion({
        activity: classifyActivity(latestAccel, latestSpeed),
        speed: latestSpeed !== null ? Math.round(latestSpeed * 10) / 10 : null,
        orientation: {
          alpha: latestOrientation.alpha !== null ? Math.round(latestOrientation.alpha) : null,
          beta: latestOrientation.beta !== null ? Math.round(latestOrientation.beta) : null,
          gamma: latestOrientation.gamma !== null ? Math.round(latestOrientation.gamma) : null,
        },
        acceleration: {
          x: latestAccel.x !== null ? Math.round(latestAccel.x * 100) / 100 : null,
          y: latestAccel.y !== null ? Math.round(latestAccel.y * 100) / 100 : null,
          z: latestAccel.z !== null ? Math.round(latestAccel.z * 100) / 100 : null,
        },
      });
    };

    const handleMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (a) {
        latestAccel = { x: a.x ?? null, y: a.y ?? null, z: a.z ?? null };
      }
      updateMotion();
    };

    const handleOrientation = (e: DeviceOrientationEvent) => {
      latestOrientation = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
      updateMotion();
    };

    // Use GPS speed if location is available for better vehicle detection
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => { latestSpeed = pos.coords.speed; updateMotion(); },
        () => {},
        { enableHighAccuracy: false }
      );
    }

    window.addEventListener('devicemotion', handleMotion);
    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  // ── Environmental awareness: light + sound + situation classifier ──────────
  useEffect(() => {
    // --- Shared state for the classifier ---
    let motionActivity = 'unknown';
    let lightLevel: 'bright' | 'dim' | 'dark' | 'unknown' = 'unknown';
    let soundLevel: 'loud' | 'moderate' | 'quiet' | 'silent' | 'unknown' = 'unknown';
    let stillnessSince = Date.now();
    let lastActivity = 'unknown';
    let lastLight: typeof lightLevel = 'unknown';
    let lastSound: typeof soundLevel = 'unknown';

    const classifySituation = (changeType: 'movement_started' | 'movement_stopped' | 'light_changed' | 'sound_changed' | 'none') => {
      const stillMins = (Date.now() - stillnessSince) / 60000;
      const parts: string[] = [];
      if (motionActivity !== 'unknown') parts.push(`User is ${motionActivity}`);
      if (lightLevel !== 'unknown') parts.push(`environment is ${lightLevel}`);
      if (soundLevel !== 'unknown') parts.push(`ambient sound is ${soundLevel}`);
      if (stillMins > 1) parts.push(`has been still for ${Math.round(stillMins)} minute${Math.round(stillMins) !== 1 ? 's' : ''}`);
      setEnvironmentalSituation({
        situation: parts.length > 0 ? parts.join(', ') + '.' : 'No environmental data available.',
        motionActivity,
        lightLevel,
        soundLevel,
        stillnessDurationMinutes: Math.round(stillMins * 10) / 10,
        lastChangeType: changeType,
        timestamp: Date.now(),
      });
    };

    // --- Motion listener (reads from existing devicemotion) ---
    const handleMotionForEnv = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
      const newActivity = mag > 15 ? 'moving vigorously' : mag > 4 ? 'walking or moving' : 'stationary';
      if (newActivity !== 'stationary') stillnessSince = Date.now();
      const wasStationary = lastActivity === 'stationary' || lastActivity === 'unknown';
      const nowMoving = newActivity !== 'stationary';
      const wasMoving = lastActivity !== 'stationary' && lastActivity !== 'unknown';
      const nowStationary = newActivity === 'stationary';
      motionActivity = newActivity;
      if (wasStationary && nowMoving) {
        lastActivity = newActivity;
        classifySituation('movement_started');
      } else if (wasMoving && nowStationary) {
        stillnessSince = Date.now();
        lastActivity = newActivity;
        classifySituation('movement_stopped');
      } else {
        lastActivity = newActivity;
      }
    };
    window.addEventListener('devicemotion', handleMotionForEnv);

    // --- Ambient light via camera luma sampling ---
    let videoEl: HTMLVideoElement | null = null;
    let canvasEl: HTMLCanvasElement | null = null;
    let lightStream: MediaStream | null = null;
    let lightInterval: ReturnType<typeof setInterval> | null = null;

    const startLightSensor = async () => {
      try {
        lightStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 64, height: 64 } });
        videoEl = document.createElement('video');
        canvasEl = document.createElement('canvas');
        canvasEl.width = 64; canvasEl.height = 64;
        videoEl.srcObject = lightStream;
        videoEl.play();
        lightInterval = setInterval(() => {
          if (!videoEl || !canvasEl) return;
          const ctx = canvasEl.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(videoEl, 0, 0, 64, 64);
          const data = ctx.getImageData(0, 0, 64, 64).data;
          let luma = 0;
          for (let i = 0; i < data.length; i += 4) {
            luma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          }
          luma /= (data.length / 4);
          const newLight: typeof lightLevel = luma > 160 ? 'bright' : luma > 60 ? 'dim' : 'dark';
          if (newLight !== lastLight) {
            lightLevel = newLight;
            lastLight = newLight;
            classifySituation('light_changed');
          }
        }, 5000);
      } catch {
        // Camera permission denied or unavailable — light sensing skipped silently
      }
    };
    startLightSensor();

    // --- Sound level via mic amplitude ---
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let micStream: MediaStream | null = null;
    let soundInterval: ReturnType<typeof setInterval> | null = null;

    const startSoundSensor = async () => {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(micStream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        soundInterval = setInterval(() => {
          if (!analyser) return;
          analyser.getByteFrequencyData(buf);
          const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
          const newSound: typeof soundLevel = avg > 60 ? 'loud' : avg > 25 ? 'moderate' : avg > 8 ? 'quiet' : 'silent';
          if (newSound !== lastSound) {
            soundLevel = newSound;
            lastSound = newSound;
            classifySituation('sound_changed');
          }
        }, 3000);
      } catch {
        // Mic permission denied or unavailable — sound sensing skipped silently
      }
    };
    startSoundSensor();

    // Initial situation snapshot after 3 seconds
    const initTimer = setTimeout(() => classifySituation('none'), 3000);

    return () => {
      window.removeEventListener('devicemotion', handleMotionForEnv);
      clearTimeout(initTimer);
      if (lightInterval) clearInterval(lightInterval);
      if (soundInterval) clearInterval(soundInterval);
      if (lightStream) lightStream.getTracks().forEach(t => t.stop());
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      if (audioCtx) audioCtx.close();
    };
  }, []);


  useEffect(() => {
    const loadData = async () => {
        console.log("loadData started", Date.now());
        const timeoutId = setTimeout(() => {
            if (!isLoaded) {
                console.warn("loadData timeout reached");
                setShowResetOption(true);
            }
        }, 30000);

        try {
            let savedData = null;
            
            // Try loading chunked data first
            try {
                console.log("Attempting to load chunked data...", Date.now());
                const coreData = await loadFromDB('indigo_app_data_core');
                if (coreData) {
                    console.log("Core data found, loading parts...", Date.now());
                    const activeProfileStr = await loadFromDB('indigo_app_data_active_profile');
                    const galleryDataStr = await loadFromDB('indigo_app_data_gallery');
                    
                    const activeProfile = activeProfileStr ? (typeof activeProfileStr === 'string' ? JSON.parse(activeProfileStr) : activeProfileStr) : null;
                    
                    // Gallery loading moved to lazy load
                    let galleryData: GalleryItem[] = [];
                    
                    console.log("Skipping gallery load in loadData", Date.now());

                    const personaIds = await loadFromDB('indigo_app_data_persona_ids') || [];
                    console.log("Loading personas...", Date.now());
                    const personasData = [];
                    for (const id of personaIds) {
                        const pStr = await loadFromDB(`indigo_app_data_persona_${id}`);
                        if (pStr) {
                            personasData.push(typeof pStr === 'string' ? JSON.parse(pStr) : pStr);
                        }
                    }
                    console.log("Personas loaded", Date.now());
                    
                    savedData = {
                        ...coreData,
                        aiProfile: activeProfile || coreData.aiProfile,
                        gallery: galleryData || [],
                        savedPersonas: personasData.length > 0 ? personasData : (coreData.savedPersonas || [])
                    };
                    console.log("Chunked data loaded successfully", Date.now());
                }
            } catch (chunkLoadError) {
                console.warn("Failed to load chunked data, continuing with other formats", chunkLoadError);
            }
            
            // Fallback to stringified data
            if (!savedData) {
                try {
                    console.log("Attempting to load stringified chunks...", Date.now());
                    const numChunks = await loadFromDB('indigo_app_data_stringified_chunks');
                    if (numChunks) {
                        console.log(`Found ${numChunks} stringified chunks`, Date.now());
                        let stringifiedData = '';
                        for (let i = 0; i < numChunks; i++) {
                            const chunk = await loadFromDB(`indigo_app_data_stringified_chunk_${i}`);
                            if (chunk) stringifiedData += chunk;
                        }
                        savedData = JSON.parse(stringifiedData);
                        console.log("Stringified chunks loaded successfully", Date.now());
                    } else {
                        console.log("Attempting to load single stringified data...", Date.now());
                        const stringifiedData = await loadFromDB('indigo_app_data_stringified');
                        if (stringifiedData) {
                            savedData = JSON.parse(stringifiedData);
                            console.log("Single stringified data loaded successfully", Date.now());
                        }
                    }
                } catch (stringifiedLoadError) {
                    console.warn("Failed to load stringified data, continuing", stringifiedLoadError);
                }
            }
            
            // Fallback to old format
            if (!savedData) {
                try {
                    console.log("Attempting to load old format data...", Date.now());
                    savedData = await loadFromDB('indigo_app_data');
                    if (savedData) console.log("Old format data loaded successfully", Date.now());
                } catch (oldFormatError) {
                    console.warn("Failed to load old format data", oldFormatError);
                }
            }
            
            if (savedData && typeof savedData === 'object') {
                console.log("Data loaded, initializing state...", Date.now());
                setIsSuccessfullyLoaded(true);
                // Ensure ID exists for legacy data
                const loadedProfile = savedData.aiProfile || initialAIProfileState;
                if (loadedProfile && typeof loadedProfile === 'object' && !loadedProfile.id) loadedProfile.id = 'default';
                
                const loadedUserId = savedData.userId || localStorage.getItem('indigo_user_id') || '';
                setUserId(loadedUserId);
                localStorage.setItem('indigo_user_id', loadedUserId);
                
                setAIProfileState(prev => ({
                    ...initialAIProfileState, // Provide defaults for new fields
                    ...(typeof loadedProfile === 'object' ? loadedProfile : {}),
                    ambientMode: loadedProfile?.ambientMode ?? false,
                    ambientFrequency: loadedProfile?.ambientFrequency || 'off',
                    aiCanGenerateImages: loadedProfile?.aiCanGenerateImages ?? false,
                    aiCanUseWebSearch: loadedProfile?.aiCanUseWebSearch ?? false,
                    aiCanUseCalendar: loadedProfile?.aiCanUseCalendar ?? false,
                    aiCanUseGmail: loadedProfile?.aiCanUseGmail ?? false,
                    aiCanUseYouTube: loadedProfile?.aiCanUseYouTube ?? false,
                    aiCanUseGoogleMaps: loadedProfile?.aiCanUseGoogleMaps ?? false,
                    aiCanSendProactiveEmails: loadedProfile?.aiCanSendProactiveEmails ?? false,
                    imageStyle: loadedProfile?.imageStyle || 'none',
                    imageGenerationInstructions: loadedProfile?.imageGenerationInstructions !== undefined ? loadedProfile.imageGenerationInstructions : initialAIProfileState.imageGenerationInstructions,
                }));

                const loadedSavedPersonas = (Array.isArray(savedData.savedPersonas) ? savedData.savedPersonas : [loadedProfile]).map((p: any) => ({
                  ...initialAIProfileState,
                  ...(typeof p === 'object' ? p : {}),
                  imageGenerationInstructions: p?.imageGenerationInstructions !== undefined ? p.imageGenerationInstructions : initialAIProfileState.imageGenerationInstructions,
                }));
                setSavedPersonas(loadedSavedPersonas);
                setUserProfileState(savedData.userProfile || initialUserProfileState);
                setGallery(Array.isArray(savedData.gallery) ? savedData.gallery : []);
                setJournal(Array.isArray(savedData.journal) ? savedData.journal : []);
                setKnowledgeBase(Array.isArray(savedData.knowledgeBase) ? savedData.knowledgeBase : []);
                setMemories(Array.isArray(savedData.memories) ? savedData.memories : []);
                setProactiveCommunications(Array.isArray(savedData.proactiveCommunications) ? savedData.proactiveCommunications : []);
                setAnthropicApiKeyState(savedData.anthropicApiKey || null);
                setElevenLabsApiKeyState(savedData.elevenLabsApiKey || null);
                setGeminiApiKeyState(savedData.geminiApiKey || null);
                setOpenrouterApiKeyState(savedData.openrouterApiKey || null);
                setWavespeedApiKeyState(savedData.wavespeedApiKey || null);

                setLastCloudSyncTimeState(savedData.lastCloudSyncTime || null);
                setLastFirebaseBackupTimeState(savedData.lastFirebaseBackupTime || null);
                setLastGalleryBackupTimeState(savedData.lastGalleryBackupTime || null);
                setLastKBBackupTimeState(savedData.lastKBBackupTime || null);
                setLastChatBackupTimeState(savedData.lastChatBackupTime || null);
                setLastAutoJsonBackupTimeState(savedData.lastAutoJsonBackupTime || null);
                setAutoBackupScheduleState(savedData.autoBackupSchedule || 'off');
                setRealTimeSyncEnabledState(savedData.realTimeSyncEnabled ?? false);
                setFirebaseApiKey(savedData.firebaseApiKey || null);
                setFirebaseAuthDomain(savedData.firebaseAuthDomain || null);
                setFirebaseProjectId(savedData.firebaseProjectId || null);
                setFirebaseStorageBucket(savedData.firebaseStorageBucket || null);
                setFirebaseAppId(savedData.firebaseAppId || null);
                setFirebaseMessagingSenderId(savedData.firebaseMessagingSenderId || null);

                setApiKeyState(savedData.apiKey || null);
                setFcmTokenState(savedData.fcmToken || null);
                // Keep isDebuggerEnabled local-only to avoid sync issues during dev
                // if (savedData.isDebuggerEnabled !== undefined) {
                //   setIsDebuggerEnabled(savedData.isDebuggerEnabled);
                // }
                setAutoSaveChatState(savedData.autoSaveChat !== undefined ? savedData.autoSaveChat : true);
                setAutoSaveChatInterval(savedData.autoSaveChatInterval !== undefined ? savedData.autoSaveChatInterval : 30);
                setAutoJsonBackupState(savedData.autoJsonBackup !== undefined ? savedData.autoJsonBackup : false);
                setAutoJsonBackupIntervalState(savedData.autoJsonBackupInterval !== undefined ? savedData.autoJsonBackupInterval : 5);
                setIsSyncEnabled(savedData.isSyncEnabled !== undefined ? savedData.isSyncEnabled : false);
                setSyncFrequency(savedData.syncFrequency !== undefined ? savedData.syncFrequency : 5);
                setNotificationsEnabledState(savedData.notificationsEnabled !== undefined ? savedData.notificationsEnabled : (typeof Notification !== 'undefined' && Notification.permission === 'granted'));
                setTimeZoneState(savedData.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone);
                if (savedData.lastInteractionTime) {
                  setLastInteractionTime(savedData.lastInteractionTime);
                }
            } else {
                // Initialize saved personas with default if empty
                setIsSuccessfullyLoaded(true);
                setSavedPersonas([initialAIProfileState]);
                const storedUserId = localStorage.getItem('indigo_user_id');
                if (storedUserId) {
                    setUserId(storedUserId);
                } else {
                    const newUserId = '';
                    setUserId(newUserId);
                    localStorage.setItem('indigo_user_id', newUserId);
                }
            }
        } catch (e: any) {
            console.error("Failed to load saved data from DB during app initialization:", e);
            setLoadError(e.message || "Unknown error during initialization");
        } finally {
            clearTimeout(timeoutId);
            setIsLoaded(true);
        }
    };
    loadData();
  }, []);

  const saveData = useCallback(async () => {
    if (!isSuccessfullyLoaded) return; // Don't save before initial load is complete

    try {
      const data: any = {
          aiProfile,
          savedPersonas,
          userProfile,
          gallery,
          journal,
          knowledgeBase,
          memories,
          proactiveCommunications,
          toasts: [],
          apiKey,
          autoSaveChat,
          autoSaveChatInterval,
          autoJsonBackup,
          autoJsonBackupInterval,
          isSyncEnabled,
          syncFrequency,
          proactiveMessageFrequency: aiProfile.proactiveMessageFrequency,
          proactiveEmailFrequency: aiProfile.proactiveEmailFrequency,
          notificationsEnabled,
          fcmToken,
          showTimestamps,
          isDebuggerEnabled,
          ambientMode: aiProfile.ambientMode,
          ambientFrequency: aiProfile.ambientFrequency,
          aiCanGenerateImages: aiProfile.aiCanGenerateImages,
          timeZone,
          firebaseApiKey,
          firebaseAuthDomain,
          firebaseProjectId,
          firebaseStorageBucket,
          firebaseAppId,
          firebaseMessagingSenderId,
          anthropicApiKey,
          elevenLabsApiKey,
          geminiApiKey,
          openrouterApiKey,
          wavespeedApiKey,
          lastCloudSyncTime,
          lastFirebaseBackupTime,
          lastGalleryBackupTime,
          autoBackupSchedule,
          realTimeSyncEnabled,
          lastInteractionTime,
          userId,
          isSuccessfullyLoaded,
          galleryLoaded
      };
      
      try {
          // Split data to avoid out of memory errors
          const coreData = { ...data };
          delete coreData.savedPersonas;
          delete coreData.gallery;
          delete coreData.aiProfile;

          await saveToDB('indigo_app_data_core', coreData);
          await saveToDB('indigo_app_data_active_profile', JSON.stringify(aiProfile));
          // Gallery is saved separately in its own useEffect (see below saveData)
          // to avoid hook ordering issues and stale closure problems.

          const personaIds = savedPersonas.map(p => p.id);
          await saveToDB('indigo_app_data_persona_ids', personaIds);
          
          for (const p of savedPersonas) {
              await saveToDB(`indigo_app_data_persona_${p.id}`, JSON.stringify(p));
          }
          
          // Clean up deleted personas
          const existingPersonaIds = await loadFromDB('indigo_app_data_persona_ids') || [];
          for (const id of existingPersonaIds) {
              if (!personaIds.includes(id)) {
                  await deleteFromDB(`indigo_app_data_persona_${id}`);
              }
          }
          
          // Sync removed
      } catch (saveError) {
          console.warn("Failed to save chunked data, falling back to stringified save", saveError);
          try {
              const stringifiedData = JSON.stringify(data);
              const chunkSize = 1024 * 1024 * 5; // 5MB chunks
              const numChunks = Math.ceil(stringifiedData.length / chunkSize);
              await saveToDB('indigo_app_data_stringified_chunks', numChunks);
              for (let i = 0; i < numChunks; i++) {
                  await saveToDB(`indigo_app_data_stringified_chunk_${i}`, stringifiedData.substring(i * chunkSize, (i + 1) * chunkSize));
              }
              const lightData = { ...data, savedPersonas: [], gallery: [], knowledgeBase: [] };
              await saveToDB('indigo_app_data', lightData);
          } catch (stringifyError) {
              console.warn("Failed to stringify data, falling back to direct save", stringifyError);
              await saveToDB('indigo_app_data', data);
          }
      }
    } catch (e) {
      console.error("Failed to save data to DB", e);
    }

    // Debounce save to avoid excessive writes
  }, [aiProfile, savedPersonas, userProfile, gallery, journal, knowledgeBase, memories, apiKey, anthropicApiKey, elevenLabsApiKey, geminiApiKey, openrouterApiKey, wavespeedApiKey, fcmToken, autoSaveChat, autoJsonBackup, isLoaded, lastInteractionTime, userId, firebaseApiKey, firebaseAuthDomain, firebaseProjectId, firebaseStorageBucket, firebaseMessagingSenderId, firebaseAppId]);

  // Debounce save to avoid excessive writes
  useEffect(() => {
    if (!isLoaded) return;
    const timeoutId = setTimeout(saveData, 1000);
    return () => clearTimeout(timeoutId);
  }, [aiProfile, savedPersonas, userProfile, gallery, journal, knowledgeBase, memories, apiKey, anthropicApiKey, elevenLabsApiKey, geminiApiKey, openrouterApiKey, wavespeedApiKey, fcmToken, autoSaveChat, autoJsonBackup, isLoaded, lastInteractionTime, userId, firebaseApiKey, firebaseAuthDomain, firebaseProjectId, firebaseStorageBucket, firebaseMessagingSenderId, firebaseAppId, saveData]);

  // ── Gallery save — completely separate from saveData to avoid hook ordering issues.
  // Only runs when galleryLoaded is true, so it never overwrites with an empty list.
  // Tracks which items were already written to IndexedDB (via savedGalleryItemsRef,
  // declared above) so that adding N images (e.g. during a restore) does not
  // re-serialize and re-write every previously-saved image on every single gallery
  // state change — that O(n^2) behavior was heavy enough on large base64 images to
  // crash the tab on phones.
  useEffect(() => {
    if (!galleryLoaded) return; // Never save until gallery has been fully loaded from DB
    const saveGallery = async () => {
      try {
        const galleryIds = gallery.map(item => item.id);
        await saveToDB('indigo_app_data_gallery_ids', galleryIds);
        // Keep the lightweight index in step — future gallery opens read this
        // one small record instead of scanning every full-size item on disk.
        const metaIndex = gallery.map(item => {
          const anyItem = item as any;
          const freshBig = !anyItem.onDisk && typeof item.url === 'string' && item.url.length > OVERSIZED_ITEM_THRESHOLD_CHARS;
          return {
            id: item.id,
            type: anyItem.type ?? 'uploaded',
            mediaType: anyItem.mediaType,
            url: '',
            prompt: anyItem.prompt,
            provider: anyItem.provider,
            timestamp: anyItem.timestamp ?? anyItem.createdAt ?? 0,
            personaId: anyItem.personaId,
            onDisk: true,
            ...(anyItem.oversized || freshBig
              ? { oversized: true, approxSizeMB: anyItem.approxSizeMB ?? Math.round(((item.url?.length || 0) / 1024 / 1024) * 10) / 10 }
              : {}),
          };
        });
        await saveToDB('indigo_app_data_gallery_meta', metaIndex);
        const previouslySaved = savedGalleryItemsRef.current;
        const nowSaved = new Map<string, GalleryItem>();
        for (const item of gallery) {
          if (item.oversized || (item as any).onDisk) {
            // The full data for this item is already on disk and was never
            // loaded into memory. Writing the in-memory placeholder (which
            // has an intentionally empty url) would destroy it — so leave
            // the stored copy completely untouched. Its id remains in
            // galleryIds, which protects it from the cleanup pass below.
            // Metadata edits to these items are written through to disk by
            // updateGalleryItem itself.
            nowSaved.set(item.id, item);
            continue;
          }
          // Only write to IndexedDB if this exact item wasn't already persisted
          // (new item, or an existing item whose reference changed, e.g. edited).
          if (previouslySaved.get(item.id) !== item) {
            await saveToDB(`indigo_app_data_gallery_item_${item.id}`, JSON.stringify(item));
          }
          nowSaved.set(item.id, item);
        }
        savedGalleryItemsRef.current = nowSaved;
        // Clean up items that were deleted
        const existingIds: string[] = (await loadFromDB('indigo_app_data_gallery_ids')) || [];
        for (const id of existingIds) {
          if (!galleryIds.includes(id)) {
            await deleteFromDB(`indigo_app_data_gallery_item_${id}`);
          }
        }
      } catch (e) {
        console.error('Failed to save gallery', e);
      }
    };
    saveGallery();
  }, [gallery, galleryLoaded]);

  // Web Push notification setup — runs once after initial load
  useEffect(() => {
    if (!isLoaded) return;

    const setupNotifications = async () => {
      // Only auto-subscribe if the user already granted permission previously
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

      const result = await requestNotificationPermission(userId || undefined);
      if (result.success && result.endpoint) {
        // Store endpoint string as our "token" equivalent for display in Settings
        setFcmTokenState(result.endpoint);
      }
    };
    setupNotifications();

    // Listen for push messages that arrive while the app is open
    const unsubscribe = onForegroundMessage((payload) => {
      const title = payload.title || aiProfile.name;
      const body  = payload.body  || 'New message';
      // Show a toast only — the service worker already showed the system notification
      addToast({ title, message: body, type: 'info' });
    });

    return () => { if (unsubscribe) unsubscribe(); };
  }, [isLoaded, userId]);

  // Auto-Save App Data Interval (30s)
  useEffect(() => {
    if (!isLoaded || !autoSaveChat || autoSaveChatInterval <= 0) return;

    const intervalId = setInterval(async () => {
        await saveData();
        console.log(`Auto-saved app data (${autoSaveChatInterval}s interval)`);
    }, autoSaveChatInterval * 1000);

    return () => clearInterval(intervalId);
  }, [isLoaded, autoSaveChat, autoSaveChatInterval, saveData]);

  // Auto JSON Backup Interval - Moved to ChatManager to include chat data
  // Auto Google Drive Backup Interval - Moved to ChatManager to include chat data

  // ── Scheduled Firebase Auto-Backup ────────────────────────────────────────
  // Uses a ref to avoid stale closure issues with lastFirebaseBackupTime
  const lastAutoBackupRef = React.useRef<number | null>(null);
  useEffect(() => {
    lastAutoBackupRef.current = lastFirebaseBackupTime;
  }, [lastFirebaseBackupTime]);

  useEffect(() => {
    if (!isLoaded || autoBackupSchedule === 'off') return;
    if (!userId || !firebaseApiKey || !firebaseProjectId || !firebaseAppId) return;

    const INTERVAL_MS = autoBackupSchedule === 'daily'
      ? 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;

    const checkAndBackup = async () => {
      const now = Date.now();
      const last = lastAutoBackupRef.current || 0;
      if (now - last < INTERVAL_MS) return;

      try {
        await backupToFirestore(userId, {
          aiProfile, savedPersonas, userProfile,
          journal, knowledgeBase, memories,
          gallery,
          apiKey, anthropicApiKey, elevenLabsApiKey, geminiApiKey, openrouterApiKey,
          wavespeedApiKey,
          autoSaveChat, autoBackupSchedule,
        }, firebaseRuntimeConfig);
        // Profile photos are not part of this backup — they ride with the
        // gallery via referenceImageGalleryId (see syncReferenceImageGalleryLink
        // and resolveProfileImagesFromGallery). Nothing else to upload here.
        const ts = Date.now();
        lastAutoBackupRef.current = ts;
        setLastFirebaseBackupTimeState(ts);
        loadFromDB('indigo_app_data_core').then((core: any) => {
          if (core) saveToDB('indigo_app_data_core', { ...core, lastFirebaseBackupTime: ts });
        }).catch(() => {});
        addToast({ title: 'Auto-backup complete', message: `App data backed up to Firebase (${autoBackupSchedule} schedule).`, type: 'success' });
        showNativeNotification(`Indigo — Auto-backup complete`, {
          body: `All personas and app data were backed up to Firebase automatically.`,
          icon: '/icon-192.png',
        });
      } catch (e) {
        console.error('Auto-backup failed:', e);
      }
    };

    // Check immediately on mount, then every 10 minutes
    checkAndBackup();
    const id = setInterval(checkAndBackup, 10 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, autoBackupSchedule, userId, firebaseApiKey, firebaseProjectId, firebaseAppId]);

  // ── Real-time Firestore sync ───────────────────────────────────────────────
  // Debounces a Firestore backup 30s after any key state change.
  // Gallery images are handled separately (immediate upload in addToGallery).
  // Chat sessions are NOT backed up here (they live in ChatContext); use the
  // manual "Backup to Firestore" button in Settings for a full backup including chat.
  useEffect(() => {
    if (!isLoaded || !realTimeSyncEnabled) return;
    if (!userId?.trim() || !firebaseApiKey || !firebaseProjectId || !firebaseAppId) return;

    const timeoutId = setTimeout(async () => {
      try {
        await backupToFirestore(userId, {
          aiProfile, savedPersonas, userProfile,
          journal, knowledgeBase, memories,
          gallery,
          apiKey, anthropicApiKey, elevenLabsApiKey, geminiApiKey, openrouterApiKey,
          wavespeedApiKey,
          autoSaveChat, autoBackupSchedule, realTimeSyncEnabled,
        }, firebaseRuntimeConfig);
        console.log('[Indigo] Real-time sync → Firestore complete');
      } catch (e) {
        console.error('[Indigo] Real-time sync to Firebase failed:', e);
      }
    }, 30_000);

    return () => clearTimeout(timeoutId);
  }, [
    isLoaded, realTimeSyncEnabled, userId, firebaseApiKey, firebaseProjectId, firebaseAppId,
    aiProfile, savedPersonas, userProfile, journal, knowledgeBase, memories,
  ]);

  // Proactive Message Trigger
  useEffect(() => {
    if (!isLoaded || aiProfile.proactiveMessageFrequency === 'off') return;
    // Handled by ChatManager
  }, [isLoaded, aiProfile.proactiveMessageFrequency, lastInteractionTime, aiProfile, userProfile]);

  // Use a ref to track the last sync time to throttle requests
  const lastSyncTime = React.useRef(Date.now());

  const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, backoff = 1000): Promise<Response> => {
    try {
      // Ensure credentials are included for all requests to handle cookies in iframes
      const fetchOptions = {
        ...options,
        credentials: options.credentials || 'include'
      };
      console.log(`Fetching ${url} with options:`, fetchOptions);
      const response = await fetch(url, fetchOptions);
      console.log(`Fetch response for ${url}:`, response.status, response.statusText);
      if (!response.ok && retries > 0 && response.status >= 500) {
        console.warn(`Fetch failed with status ${response.status}, retrying in ${backoff}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      return response;
    } catch (error) {
      console.error(`Fetch error for ${url}:`, error);
      if (retries > 0) {
        console.warn(`Fetch error: ${error instanceof Error ? error.message : 'Unknown error'}, retrying in ${backoff}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      addToast({ title: "Fetch Error", message: `Fetch error for ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`, type: "error" });
      throw error;
    }
  };


  const setAIProfile = (profile: AIProfile) => setAIProfileState(profile);
  
  const updateAIProfile = (updates: Partial<AIProfile>) => {
    setAIProfileState(prev => ({ ...prev, ...updates }));
  };
  
  const savePersona = (profile: AIProfile, chatHistory: ChatMessage[], sessions: ChatSession[], activeSessionId: string | null) => {
    // Keep the photo's mirrored Gallery item in step with this save (see
    // syncReferenceImageGalleryLink above) before the profile is committed.
    const existingForId = savedPersonas.find(p => p.id === profile.id) || (aiProfile.id === profile.id ? aiProfile : undefined);
    const linkedId = syncReferenceImageGalleryLink(
      profile.name || 'Persona',
      profile.id,
      existingForId?.referenceImage,
      (existingForId as any)?.referenceImageGalleryId,
      profile.referenceImage,
    );
    profile = { ...profile, referenceImageGalleryId: linkedId };

    setSavedPersonas(prev => {
        const existingIndex = prev.findIndex(p => p.id === profile.id);
        if (existingIndex >= 0) {
            const existing = prev[existingIndex];
            
            // If we are saving the currently active persona, use the live state data
            // otherwise use what's in the profile or existing record
            const isActive = profile.id === aiProfile.id;
            
            const updatedProfile = {
                ...profile,
                chatHistory: isActive ? chatHistory : (profile.chatHistory || existing.chatHistory || []),
                sessions: isActive ? sessions : (profile.sessions || existing.sessions || []),
                activeSessionId: isActive ? activeSessionId : (profile.activeSessionId || existing.activeSessionId || null),
                memories: isActive ? memories : (profile.memories || existing.memories || []),
                journal: isActive ? journal : (profile.journal || existing.journal || []),
            };
            const newPersonas = [...prev];
            newPersonas[existingIndex] = updatedProfile;
            
            if (isActive) {
                setAIProfileState(updatedProfile);
            }
            
            return newPersonas;
        } else {
            return [...prev, {
                ...profile,
                chatHistory: profile.chatHistory || [],
                sessions: profile.sessions || [],
                activeSessionId: profile.activeSessionId || null,
                memories: profile.memories || [],
                journal: profile.journal || [],
            }];
        }
    });
    
    // Update current profile state if it matches
    if (aiProfile.id === profile.id) {
        setAIProfileState(prev => ({
            ...profile,
            chatHistory: chatHistory, // Always use live state
            sessions: sessions,
            activeSessionId: activeSessionId,
            memories: memories,
            journal: journal,
        }));
    }
  };

  const deletePersona = (id: string) => {
    setSavedPersonas(prev => prev.filter(p => p.id !== id));
    // If deleting current, switch to another or default
    if (aiProfile.id === id) {
        const remaining = savedPersonas.filter(p => p.id !== id);
        if (remaining.length > 0) {
            setAIProfileState(remaining[0]);
        } else {
            // Reset to default if no personas left
            setAIProfileState(initialAIProfileState);
        }
    }
  };

  const loadPersona = (id: string, currentChatHistory: ChatMessage[], currentSessions: ChatSession[], currentActiveSessionId: string | null, setChatHistory: (h: ChatMessage[]) => void, setSessions: (s: ChatSession[]) => void, setActiveSessionId: (id: string | null) => void) => {
    if (id === aiProfile.id) return; // Already loaded

    // Block sending until the switch below has fully settled (fixes a rare
    // race where a message sent immediately after switching could go out
    // with a mix of old/new persona details).
    setIsPersonaSwitching(true);

    // 1. First, capture current state into the savedPersonas list
    setSavedPersonas(prev => prev.map(p => 
      p.id === aiProfile.id 
        ? { ...p, chatHistory: currentChatHistory, memories, journal, sessions: currentSessions, activeSessionId: currentActiveSessionId } 
        : p
    ));

    // 2. Find and load the new persona
    const persona = savedPersonas.find(p => p.id === id);
    if (persona) {
        // Switch MemoryService to this persona's session context —
        // this filters the session list to only show this persona's chats
        memoryService.switchToPersona(persona.id, persona.activeSessionId || null);

        setMemories(persona.memories || []);
        setJournal(persona.journal || []);
        // Knowledge base filtering happens at read time via personaKnowledgeBase
        setAIProfileState({
          ...persona,
          imageGenerationInstructions: persona.imageGenerationInstructions !== undefined ? persona.imageGenerationInstructions : initialAIProfileState.imageGenerationInstructions
        });
        
        // Reset interaction time to prevent immediate proactive messages from wrong persona
        setLastInteractionTime(Date.now());
        
        addToast({ 
          title: "Persona Switched", 
          message: `Now chatting with ${persona.name}`, 
          type: "success" 
        });
    }

    // Release the guard once React has committed the persona switch above.
    setTimeout(() => setIsPersonaSwitching(false), 250);
  };

  const setUserProfile = (profile: UserProfile) => setUserProfileState(profile);

  const setUserReferenceImage = (image: string | null) => {
    // Computed outside the updater below — React may invoke a functional
    // setState updater more than once (e.g. in StrictMode), and the gallery
    // mutators this calls (addToGallery/updateGalleryItem/deleteImageFromGallery)
    // are side effects that must only run once per actual change.
    const linkedId = syncReferenceImageGalleryLink('User', undefined, userProfile.referenceImage, (userProfile as any).referenceImageGalleryId, image);
    setUserProfileState(prev => ({ ...prev, referenceImage: image, referenceImageGalleryId: linkedId } as any));
    saveData();
  };
  
  const addToGallery = React.useCallback((item: GalleryItem) => {
    const stamped = { ...item, personaId: item.personaId ?? aiProfile.id };
    setGallery(prev => [stamped, ...prev]);
    saveData();
    // Immediately upload to Firebase Storage when real-time sync is active
    if (realTimeSyncEnabled && userId?.trim() && firebaseApiKey && firebaseProjectId && firebaseAppId && firebaseStorageBucket) {
      const rtConfig = { apiKey: firebaseApiKey, projectId: firebaseProjectId, appId: firebaseAppId, storageBucket: firebaseStorageBucket };
      uploadGalleryToFirebaseStorage(userId, [stamped], rtConfig).catch(e => {
        console.error('Real-time gallery upload failed:', e);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveData, aiProfile.id, realTimeSyncEnabled, userId, firebaseApiKey, firebaseProjectId, firebaseAppId, firebaseStorageBucket]);

  // Batched version of addToGallery — adds many items in a single state update
  // instead of one setGallery() call per item. This matters a lot for restores:
  // calling addToGallery() in a loop for, say, 60 images causes 60 separate
  // gallery-array updates, and the IndexedDB save effect below re-persists the
  // *entire* gallery (all base64 image data) on every single one of those
  // updates — turning an O(n) restore into an O(n^2) memory/IO storm that can
  // crash the browser tab on phones. Adding everything at once avoids that.
  const addMultipleToGallery = React.useCallback((items: GalleryItem[]) => {
    if (items.length === 0) return;
    const stamped = items.map(item => ({ ...item, personaId: item.personaId ?? aiProfile.id }));
    setGallery(prev => [...stamped, ...prev]);
    saveData();
    if (realTimeSyncEnabled && userId?.trim() && firebaseApiKey && firebaseProjectId && firebaseAppId && firebaseStorageBucket) {
      const rtConfig = { apiKey: firebaseApiKey, projectId: firebaseProjectId, appId: firebaseAppId, storageBucket: firebaseStorageBucket };
      uploadGalleryToFirebaseStorage(userId, stamped, rtConfig).catch(e => {
        console.error('Real-time gallery upload failed:', e);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveData, aiProfile.id, realTimeSyncEnabled, userId, firebaseApiKey, firebaseProjectId, firebaseAppId, firebaseStorageBucket]);

  const deleteImageFromGallery = (id: string) => {
    setGallery(prev => prev.filter(item => item.id !== id));
    saveData();
  };

  const deleteImagesFromGallery = (ids: string[]) => {
    setGallery(prev => prev.filter(item => !ids.includes(item.id)));
    saveData();
  };

  const updateGalleryItem = (id: string, updates: Partial<GalleryItem>) => {
    const target = gallery.find(item => item.id === id) as any;
    const isOnDisk = !!(target && (target.onDisk || target.oversized));

    setGallery(prev => prev.map(item => {
      if (item.id !== id) return item;
      const anyItem = item as any;
      if ((anyItem.onDisk || anyItem.oversized) && 'url' in updates) {
        // These items are placeholders on purpose (their real image data
        // lives only on disk, never in memory). Letting a real url slip into
        // this state object — which is exactly what used to happen here —
        // silently broke persistence for it forever afterward: the gallery
        // save effect treats onDisk/oversized items as "already correct on
        // disk, nothing to do" and permanently skips writing them, so an
        // updated photo would look right on screen for the rest of this
        // session but the stale old image would still be what's actually on
        // disk — and therefore all that ever gets backed up or survives a
        // reload. Keep the placeholder empty; the disk write below is the
        // only place this update's url actually gets persisted.
        const { url, ...metaUpdates } = updates as any;
        return { ...item, ...metaUpdates };
      }
      return { ...item, ...updates };
    }));

    // For items whose image data lives only on disk, the save effect above
    // deliberately never writes them — so both metadata AND content changes
    // (persona reassignment, prompt edits, or a replaced photo) must be
    // merged into the stored copy directly, here.
    if (isOnDisk) {
      (async () => {
        try {
          const itemStr = await loadFromDB(`indigo_app_data_gallery_item_${id}`);
          // Self-heal: if the disk copy is missing for any reason (a prior
          // failed write, an interrupted restore, etc.), don't silently do
          // nothing — that's what let this go unnoticed indefinitely.
          // Reconstruct from what we know and write it, rather than losing
          // the update.
          const parsed = itemStr
            ? (typeof itemStr === 'string' ? JSON.parse(itemStr) : itemStr)
            : { id, ...target };
          await saveToDB(`indigo_app_data_gallery_item_${id}`, JSON.stringify({ ...parsed, ...updates }));
          // Drop any cached url for this item so the next read reflects the change.
          galleryUrlCacheRef.current.delete(id);
        } catch (e) {
          console.error('Failed to write gallery item update to disk:', e);
        }
      })();
    }
    saveData();
  };

  // ── Profile photo ↔ Gallery link ─────────────────────────────────────────────
  // Firestore can't hold profile photos directly (base64 images blow well past
  // its per-document size/quota limits). Instead, every profile photo (user +
  // each persona) is mirrored into the Gallery as a small "uploaded" item, and
  // the profile only carries that item's id (referenceImageGalleryId) — a tiny
  // string that backs up in Firestore without issue. The actual image data
  // rides along with the existing Gallery → Google Drive backup instead, which
  // has no such size limit.
  //
  // Called whenever a profile is saved with a photo that's new or changed:
  // reuses the existing linked Gallery item if there is one (so re-saving a
  // profile doesn't pile up duplicate gallery entries), creates one if this is
  // the first photo, or removes the link if the photo was cleared.
  const syncReferenceImageGalleryLink = (
    label: string,
    personaId: string | undefined,
    oldImage: string | null | undefined,
    oldGalleryId: string | null | undefined,
    newImage: string | null | undefined,
  ): string | null => {
    const oldVal = oldImage || null;
    const newVal = newImage || null;
    if (oldVal === newVal) return oldGalleryId || null;

    if (!newVal) {
      // Photo was removed — drop the mirrored gallery item too.
      if (oldGalleryId) deleteImageFromGallery(oldGalleryId);
      return null;
    }

    if (oldGalleryId) {
      // Verify the linked item actually still exists before assuming an
      // update will land somewhere. If it doesn't — e.g. an earlier bug or
      // a race during app startup dropped the mirrored item from the
      // gallery after this id was already assigned to the persona —
      // updateGalleryItem() below would silently do nothing (its id matches
      // no item), leaving the persona pointed at a permanent ghost that no
      // amount of re-uploading could ever fix. Detect that and fall through
      // to create a fresh item instead, self-healing the link.
      const stillExists = !galleryLoaded || gallery.some(item => item.id === oldGalleryId);
      if (stillExists) {
        // Photo changed — update the existing mirrored item in place rather
        // than creating a new one each time a profile photo is edited.
        updateGalleryItem(oldGalleryId, { url: newVal, timestamp: Date.now() } as any);
        return oldGalleryId;
      }
    }

    const newId = `profile-${personaId || 'user'}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    addToGallery({
      id: newId,
      type: 'uploaded',
      mediaType: 'image',
      url: newVal,
      prompt: `${label} profile photo`,
      timestamp: Date.now(),
      personaId,
    } as any);
    return newId;
  };

  // After a restore, Firestore's copy of each profile has referenceImage
  // stripped (too large for a Firestore doc) but keeps referenceImageGalleryId
  // — the id of the mirrored copy in the Gallery. Once the gallery itself has
  // been restored (from its own Drive backup) or already has that item
  // locally, this fills referenceImage back in from it. Safe to call anytime;
  // it only touches profiles that have a link but no photo yet.
  const resolveProfileImagesFromGallery = React.useCallback(async () => {
    if (aiProfile.referenceImageGalleryId && !aiProfile.referenceImage) {
      const url = await getGalleryItemUrl(aiProfile.referenceImageGalleryId);
      if (url) setAIProfileState(prev => (prev.id === aiProfile.id ? { ...prev, referenceImage: url } : prev));
    }

    const personasNeedingResolve = savedPersonas.filter(p => (p as any).referenceImageGalleryId && !p.referenceImage);
    if (personasNeedingResolve.length > 0) {
      const resolved = new Map<string, string>();
      for (const p of personasNeedingResolve) {
        const url = await getGalleryItemUrl((p as any).referenceImageGalleryId);
        if (url) resolved.set(p.id, url);
      }
      if (resolved.size > 0) {
        setSavedPersonas(prev => prev.map(p => (resolved.has(p.id) ? { ...p, referenceImage: resolved.get(p.id)! } : p)));
      }
    }

    const userGalleryId = (userProfile as any).referenceImageGalleryId;
    if (userGalleryId && !userProfile.referenceImage) {
      const url = await getGalleryItemUrl(userGalleryId);
      if (url) setUserProfileState(prev => ({ ...prev, referenceImage: url }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiProfile, savedPersonas, userProfile, getGalleryItemUrl]);

  const addJournalEntry = (entry: JournalEntry) => {
    setJournal(prev => [entry, ...prev]);
  };

  const updateJournalEntry = (id: string, updates: Partial<JournalEntry>) => {
    setJournal(prev => prev.map(entry => entry.id === id ? { ...entry, ...updates } : entry));
  };

  const deleteJournalEntry = (id: string) => {
    setJournal(prev => prev.filter(entry => entry.id !== id));
  };

  const addToKnowledgeBase = (file: { name: string; content: string }) => {
    setKnowledgeBase(prev => [...prev, { ...file, personaId: aiProfile.id }]);
  };

  const addMultipleToKnowledgeBase = (files: { name: string; content: string }[]) => {
    setKnowledgeBase(prev => [...prev, ...files.map(f => ({ ...f, personaId: aiProfile.id }))]);
  };

  const deleteFromKnowledgeBase = (name: string) => {
    setKnowledgeBase(prev => prev.filter(file => file.name !== name));
  };

  const deleteMultipleFromKnowledgeBase = (names: string[]) => {
    setKnowledgeBase(prev => prev.filter(file => !names.includes(file.name)));
  };

  const addMemory = (memory: Memory) => {
    setMemories(prev => pruneMemories([...prev, { ...memory, lastAccessed: Date.now(), isImportant: memory.isImportant || false }]));
  };

  const updateMemory = (id: string, updates: Partial<Memory>) => {
    setMemories(prev => prev.map(m => m.id === id ? { ...m, ...updates, lastAccessed: Date.now() } : m));
  };

  const deleteMemory = (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const addProactiveCommunication = (comm: ProactiveCommunication) => {
    setProactiveCommunications(prev => [comm, ...prev]);
    saveData();
  };

  const deleteProactiveCommunication = (id: string) => {
    setProactiveCommunications(prev => prev.filter(c => c.id !== id));
    saveData();
  };

  const addToast = (toast: Omit<Toast, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id, timestamp: Date.now() };
    setToasts(prev => [...prev, newToast]);

    // Error/warning toasts can now carry detailed diagnostic explanations
    // (e.g. why a response came back empty) — those need real reading time,
    // so they stay until manually dismissed rather than vanishing after a
    // few seconds. Success/info messages are short and fine to auto-clear.
    if (toast.type !== 'error' && toast.type !== 'warning') {
      setTimeout(() => {
        removeToast(id);
      }, 8000);
    }
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const setApiKey = (key: string | null) => {
      setApiKeyState(key);
  };

  const setLastCloudSyncTime = (t: number | null) => {
    setLastCloudSyncTimeState(t);
    loadFromDB('indigo_app_data_core').then((core: any) => {
      if (core) saveToDB('indigo_app_data_core', { ...core, lastCloudSyncTime: t });
    }).catch(() => {});
  };

  const setLastFirebaseBackupTime = (t: number | null) => {
    setLastFirebaseBackupTimeState(t);
    loadFromDB('indigo_app_data_core').then((core: any) => {
      if (core) saveToDB('indigo_app_data_core', { ...core, lastFirebaseBackupTime: t });
    }).catch(() => {});
  };

  const setLastGalleryBackupTime = (t: number | null) => {
    setLastGalleryBackupTimeState(t);
    loadFromDB('indigo_app_data_core').then((core: any) => {
      if (core) saveToDB('indigo_app_data_core', { ...core, lastGalleryBackupTime: t });
    }).catch(() => {});
  };

  const setLastKBBackupTime = (t: number | null) => {
    setLastKBBackupTimeState(t);
    loadFromDB('indigo_app_data_core').then((core: any) => {
      if (core) saveToDB('indigo_app_data_core', { ...core, lastKBBackupTime: t });
    }).catch(() => {});
  };

  const setLastChatBackupTime = (t: number | null) => {
    setLastChatBackupTimeState(t);
    loadFromDB('indigo_app_data_core').then((core: any) => {
      if (core) saveToDB('indigo_app_data_core', { ...core, lastChatBackupTime: t });
    }).catch(() => {});
  };

  const setLastAutoJsonBackupTime = (t: number | null) => {
    setLastAutoJsonBackupTimeState(t);
    loadFromDB('indigo_app_data_core').then((core: any) => {
      if (core) saveToDB('indigo_app_data_core', { ...core, lastAutoJsonBackupTime: t });
    }).catch(() => {});
  };

  const setAutoBackupSchedule = (s: 'off' | 'daily' | 'weekly') => {
    setAutoBackupScheduleState(s);
    loadFromDB('indigo_app_data_core').then((core: any) => {
      if (core) saveToDB('indigo_app_data_core', { ...core, autoBackupSchedule: s });
    }).catch(() => {});
  };

  const setRealTimeSyncEnabled = (enabled: boolean) => {
    setRealTimeSyncEnabledState(enabled);
    loadFromDB('indigo_app_data_core').then((core: any) => {
      if (core) saveToDB('indigo_app_data_core', { ...core, realTimeSyncEnabled: enabled });
    }).catch(() => {});
  };

  const setAnthropicApiKey = (key: string | null) => {
    setAnthropicApiKeyState(key);
    loadFromDB('indigo_app_data_core').then((core: any) => {
      if (core) saveToDB('indigo_app_data_core', { ...core, anthropicApiKey: key });
    }).catch(() => {});
  };

  const setElevenLabsApiKey = (key: string | null) => {
    setElevenLabsApiKeyState(key);
    loadFromDB('indigo_app_data_core').then((core: any) => {
      if (core) saveToDB('indigo_app_data_core', { ...core, elevenLabsApiKey: key });
    }).catch(() => {});
  };

  const setGeminiApiKey = (key: string | null) => {
    setGeminiApiKeyState(key);
    loadFromDB('indigo_app_data_core').then((core: any) => {
      if (core) saveToDB('indigo_app_data_core', { ...core, geminiApiKey: key });
    }).catch(() => {});
  };

  const setOpenrouterApiKey = (key: string | null) => {
    setOpenrouterApiKeyState(key);
    loadFromDB('indigo_app_data_core').then((core: any) => {
      if (core) saveToDB('indigo_app_data_core', { ...core, openrouterApiKey: key });
    }).catch(() => {});
  };

  const setWavespeedApiKey = (key: string | null) => {
    setWavespeedApiKeyState(key);
    loadFromDB('indigo_app_data_core').then((core: any) => {
      if (core) saveToDB('indigo_app_data_core', { ...core, wavespeedApiKey: key });
    }).catch(() => {});
  };

  // ── Firebase backup / restore ────────────────────────────────────────────────
  const firebaseRuntimeConfig = {
    apiKey: firebaseApiKey, authDomain: firebaseAuthDomain,
    projectId: firebaseProjectId, storageBucket: firebaseStorageBucket,
    appId: firebaseAppId, messagingSenderId: firebaseMessagingSenderId,
  };

  const firebaseBackup = async (dataToBackup: any) => {
    if (!userId) throw new Error("Set a User ID in Cloud Sync settings before backing up.");
    await backupToFirestore(userId, dataToBackup, firebaseRuntimeConfig);
    // Profile photos are NOT uploaded to Firebase Storage here — Storage
    // requires the paid Blaze plan and was throwing quota/permission errors
    // on accounts without it. Instead, each profile photo is mirrored into
    // the Gallery (see syncReferenceImageGalleryLink, called whenever a photo
    // is set) and only its small referenceImageGalleryId travels in this
    // Firestore document. The actual image rides along with the normal
    // gallery backup (Settings → Cloud Sync → Gallery Images), which already
    // handles arbitrarily large data without hitting Firestore's document
    // size limit or needing Storage at all.
  };

  const firebaseRestore = async (): Promise<any | null> => {
    if (!userId) throw new Error("Set a User ID in Cloud Sync settings before restoring.");
    const data = await restoreFromFirestore(userId, firebaseRuntimeConfig);
    if (!data) return data;
    // Profile photos are resolved separately, from the Gallery, via
    // resolveProfileImagesFromGallery() — called after this restore applies
    // and again after any gallery restore completes (see SettingsScreen).
    // This intentionally does NOT touch Firebase Storage.
    return data;
  };

  const firebaseGalleryBackup = async (onProgress?: (done: number, total: number) => void): Promise<number> => {
    if (!userId) throw new Error("Set a User ID in Cloud Sync settings before backing up the gallery.");
    // Always read full items directly from IndexedDB — gallery state now holds
    // metadata only (empty urls), and sequential loading keeps peak memory low.
    let galleryToBackup: GalleryItem[] = [];
    const galleryIds = await loadFromDB('indigo_app_data_gallery_ids');
    if (galleryIds && Array.isArray(galleryIds)) {
      for (const id of galleryIds) {
        try {
          const itemStr = await loadFromDB(`indigo_app_data_gallery_item_${id}`);
          if (!itemStr) continue;
          const parsed = typeof itemStr === 'string' ? JSON.parse(itemStr) : itemStr;
          if (parsed?.url) galleryToBackup.push(parsed);
        } catch { /* skip corrupt item */ }
      }
    }
    if (galleryToBackup.length === 0) {
      throw new Error("No gallery images found. Visit the Gallery screen first, then try again.");
    }
    return uploadGalleryToFirebaseStorage(userId, galleryToBackup, firebaseRuntimeConfig, onProgress);
  };

  const firebaseGalleryRestore = async (onProgress?: (done: number, total: number) => void): Promise<number> => {
    if (!userId) throw new Error("Set a User ID in Cloud Sync settings before restoring the gallery.");
    const restored = await restoreGalleryFromFirebaseStorage(userId, firebaseRuntimeConfig, onProgress);
    // Add all restored images to the local gallery in one batched update (skip
    // any already present by id) instead of one-at-a-time, which previously
    // caused the entire gallery to be re-saved to IndexedDB after every single
    // image — an O(n^2) memory/IO spike that could crash the tab on phones.
    const existingIds = new Set(gallery.map((g: any) => g.id));
    const toAdd = restored
      .filter(item => !existingIds.has(item.id))
      .map(item => ({ id: item.id, url: item.url, prompt: item.prompt || '', provider: item.provider || 'Firebase Storage', createdAt: Date.now() } as any));
    addMultipleToGallery(toAdd);
    return toAdd.length;
  };

  const firebaseKBBackup = async (onProgress?: (done: number, total: number) => void): Promise<number> => {
    if (!userId) throw new Error("Set a User ID in Cloud Sync settings before backing up the knowledge base.");
    return uploadKnowledgeBaseToFirebaseStorage(userId, knowledgeBase, firebaseRuntimeConfig, onProgress);
  };

  const firebaseKBRestore = async (onProgress?: (done: number, total: number) => void): Promise<number> => {
    if (!userId) throw new Error("Set a User ID in Cloud Sync settings before restoring the knowledge base.");
    const restored = await restoreKnowledgeBaseFromFirebaseStorage(userId, firebaseRuntimeConfig, onProgress);
    let added = 0;
    for (const file of restored) {
      addToKnowledgeBase({ name: file.name, content: file.content });
      added++;
    }
    return added;
  };

  // Chat history/sessions live in ChatContext, not here — the caller (the
  // Settings screen, which has both useApp() and useChat()) passes the
  // current sessions in directly, the same way exportData() already does.
  const firebaseChatBackup = async (sessions: ChatSession[], activeSessionId: string | null): Promise<number> => {
    if (!userId) throw new Error("Set a User ID in Cloud Sync settings before backing up chat history.");
    return uploadChatHistoryToFirebaseStorage(userId, sessions, activeSessionId, firebaseRuntimeConfig);
  };

  const firebaseChatRestore = async (): Promise<number> => {
    if (!userId) throw new Error("Set a User ID in Cloud Sync settings before restoring chat history.");
    const restored = await restoreChatHistoryFromFirebaseStorage(userId, firebaseRuntimeConfig);
    if (!restored) return 0;
    await memoryService.restoreSessions(restored.sessions, restored.activeSessionId);
    return restored.sessions.length;
  };

  // Applies sessions/activeSessionId fetched from ANY backup source (Drive,
  // Firebase Storage, local auto-backup) into MemoryService — the actual
  // store; ChatContext's setSessions is a no-op, same as importData's restore.
  const applyRestoredSessions = async (sessions: ChatSession[], activeSessionId: string | null): Promise<void> => {
    await memoryService.restoreSessions(sessions, activeSessionId);
  };

  const setFcmToken = (token: string | null) => {
    setFcmTokenState(token);
  };

  const exportData = async (chatHistory: ChatMessage[], sessions: ChatSession[], activeSessionId: string | null) => {
    // Create a lean export object to reduce redundancy and file size
    // We only need sessions, as chatHistory is just the messages of the active session
    return {
      aiProfile: {
        ...aiProfile,
        chatHistory: undefined,
        sessions: undefined,
        activeSessionId: undefined,
        backgroundImages: undefined // Exclude background images from standard backup
      },
      savedPersonas: savedPersonas.map(p => ({
        ...p,
        chatHistory: undefined,
        sessions: undefined,
        activeSessionId: undefined,
        backgroundImages: undefined // Exclude background images from standard backup
      })),
      userProfile,
      // chatHistory is redundant if it's already in the sessions
      // But we'll keep it for compatibility with the current importData logic
      // which expects it at the root. However, we can make it lean.
      chatHistory, 
      sessions,
      activeSessionId,
      journal,
      knowledgeBase,
      memories,
      // gallery is excluded from standard backup
      apiKey,
      fcmToken,
      autoSaveChatInterval,
      autoJsonBackupInterval,
      proactiveMessageFrequency: aiProfile.proactiveMessageFrequency,
      notificationsEnabled,
      showTimestamps,
      aiCanGenerateImages: aiProfile.aiCanGenerateImages,
      timeZone,
      // backgrounds is excluded from standard backup
    };
  };

  const exportGalleryData = async () => {
    const chunks = await exportGalleryChunks(999999); // One giant chunk
    return chunks[0];
  };

  const importGalleryData = async (compressedData: Uint8Array) => {
    return importGalleryChunks([compressedData]);
  };

  // WARNING: reads gallery state, which now holds metadata only (empty urls).
  // Not called from any screen — if ever revived, load items from IndexedDB.
  const exportGalleryChunks = async (chunkSize: number = 2, mediaType?: 'image' | 'video') => {
    const chunks: Uint8Array[] = [];
    
    const getItemMediaType = (item: GalleryItem): 'image' | 'video' => {
      if (item.mediaType) return item.mediaType;
      if (item.url.startsWith('data:video/') || item.url.startsWith('video/') || item.url.endsWith('.mp4') || item.url.endsWith('.webm') || item.url.endsWith('.mov')) return 'video';
      return 'image';
    };

    const filteredGallery = mediaType 
      ? gallery.filter(item => getItemMediaType(item) === mediaType)
      : gallery;

    // Split gallery into chunks
    for (let i = 0; i < filteredGallery.length; i += chunkSize) {
      const galleryChunk = filteredGallery.slice(i, i + chunkSize);
      const data = {
        gallery: galleryChunk,
      };
      const jsonString = JSON.stringify(data);
      const uint8 = strToU8(jsonString);
      chunks.push(gzipSync(uint8, { level: 9 }));
    }
    
    return chunks;
  };

  const importGalleryChunks = async (chunks: Uint8Array[]) => {
    try {
      let combinedGallery: any[] = [];
      
      for (const chunk of chunks) {
        const decompressed = gunzipSync(chunk);
        const jsonString = strFromU8(decompressed);
        const parsed = JSON.parse(jsonString);
        
        if (parsed.gallery) combinedGallery = [...combinedGallery, ...parsed.gallery];
      }
      
      // Use a Map to deduplicate by ID
      const deduplicate = (arr: any[]) => {
        const map = new Map();
        arr.forEach(item => map.set(item.id, item));
        return Array.from(map.values());
      };
      
      setGallery(prev => deduplicate([...prev, ...combinedGallery]));
      
      addToast({ title: "Gallery Restored", message: `Restored ${combinedGallery.length} images from ${chunks.length} chunks.`, type: "success" });
    } catch (e) {
      console.error("Failed to import gallery chunks", e);
      addToast({ title: "Import Failed", message: "Failed to decompress or parse gallery chunks.", type: "error" });
    }
  };

  const syncGalleryToCloud = async (mediaType?: 'image' | 'video') => {
    if (!userId) {
      addToast({ title: "Sync Failed", message: "User ID not found. Please interact with the AI first.", type: "error" });
      return;
    }

    try {
      addToast({ title: "Cloud Sync", message: `Preparing ${mediaType || 'gallery'} for cloud synchronization...`, type: "info" });
      const chunks = await exportGalleryChunks(1, mediaType); // 1 image per chunk for maximum reliability
      const timestamp = Date.now();
      
      if (chunks.length === 0) {
        addToast({ title: "Sync", message: `No ${mediaType || 'gallery items'} to sync.`, type: "info" });
        return;
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const blob = new Blob([chunk]);
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1]);
          };
          reader.readAsDataURL(blob);
        });

        const payload = JSON.stringify({
          userId,
          data: {
            galleryChunk: base64,
            chunkIndex: i,
            totalChunks: chunks.length,
            galleryBackupTimestamp: timestamp,
            mediaType: mediaType || 'all'
          }
        });
        
        const compressed = gzipSync(strToU8(payload));

        const response = await fetchWithRetry('/api/sync', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/octet-stream',
            // No Content-Encoding: gzip — Render's proxy would try to decompress it,
            // breaking the request. Server detects gzip by magic bytes instead.
          },
          body: compressed
        });

        if (!response.ok) {
          throw new Error(`Failed to sync chunk ${i + 1}/${chunks.length}: ${response.status}`);
        }
        
        if (i % 5 === 0 || i === chunks.length - 1) {
          console.log(`Synced gallery chunk ${i + 1}/${chunks.length}`);
        }
      }

      addToast({ title: "Cloud Sync", message: `${mediaType ? (mediaType.charAt(0).toUpperCase() + mediaType.slice(1) + 's') : 'Gallery'} successfully synced to cloud in ${chunks.length} chunks!`, type: "success" });
    } catch (e: any) {
      console.error("Gallery cloud sync failed", e);
      addToast({ title: "Sync Failed", message: e.message || "An error occurred during gallery cloud sync.", type: "error" });
    }
  };

  const restoreGalleryFromCloud = async (mediaType?: 'image' | 'video') => {
    if (!userId) {
      addToast({ title: "Restore Failed", message: "User ID not found.", type: "error" });
      return;
    }

    try {
      addToast({ title: "Cloud Restore", message: `Fetching ${mediaType || 'gallery'} backup from cloud...`, type: "info" });
      const response = await fetchWithRetry(`/api/sync/${userId}`, { method: 'GET' });
      if (!response.ok) {
        let errorMessage = "Failed to fetch cloud data";
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (jsonError) {
          console.warn("Failed to parse error response as JSON", jsonError);
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("Failed to parse cloud data as JSON", jsonError);
        throw new Error("Invalid data received from cloud storage.");
      }
      
      const chunksKey = mediaType ? `galleryChunks_${mediaType}` : 'galleryChunks';
      const backupData = data[chunksKey];

      // Handle both old single backup, new chunked backup, and raw gallery array
      if (backupData && Array.isArray(backupData)) {
        const chunks: Uint8Array[] = [];
        for (const base64 of backupData) {
          const res = await fetch(`data:application/octet-stream;base64,${base64}`);
          const blob = await res.blob();
          chunks.push(new Uint8Array(await blob.arrayBuffer()));
        }
        await importGalleryChunks(chunks);
      } else if (!mediaType && data.gallery && Array.isArray(data.gallery) && data.gallery.length > 0) {
        // Handle raw gallery array if it was synced via general sync
        setGallery(prev => {
          const map = new Map();
          [...prev, ...data.gallery].forEach(item => map.set(item.id, item));
          return Array.from(map.values());
        });
        addToast({ title: "Gallery Restored", message: `Restored ${data.gallery.length} images from cloud sync.`, type: "success" });
      } else if (!mediaType && data.galleryBackup) {
        const base64 = data.galleryBackup;
        const res = await fetch(`data:application/octet-stream;base64,${base64}`);
        const blob = await res.blob();
        const bytes = new Uint8Array(await blob.arrayBuffer());
        await importGalleryData(bytes);
      } else {
        addToast({ title: "No Backup Found", message: `No ${mediaType || 'gallery'} backup found in the cloud for this user.`, type: "warning" });
        return;
      }
    } catch (e: any) {
      console.error("Gallery cloud restore failed", e);
      addToast({ title: "Restore Failed", message: e.message || "An error occurred during cloud restore.", type: "error" });
    }
  };

  const importData = (
    json: string, 
    setChatHistory: (history: ChatMessage[]) => void,
    setSessions: (sessions: ChatSession[]) => void,
    setActiveSessionId: (id: string | null) => void
  ) => {
    try {
      const parsed = JSON.parse(json);
      
      // 1. Restore AI Profile and Personas
      // Firestore backups null out profile photos (1 MiB doc limit). Newer
      // backups get photos re-attached from Firebase Storage before reaching
      // this function, but for older backups: if the incoming profile has no
      // photo and we already have one locally for the same persona, keep the
      // local photo rather than wiping it (same principle as the gallery fix).
      const localPhotoFor = (id?: string): string | null => {
        if (!id) return null;
        if (aiProfile.id === id && aiProfile.referenceImage) return aiProfile.referenceImage;
        const match = savedPersonas.find(p => p.id === id);
        return match?.referenceImage || null;
      };
      const withLocalPhoto = (profile: any) =>
        profile && profile.referenceImage == null
          ? { ...profile, referenceImage: localPhotoFor(profile.id) }
          : profile;

      const importedProfile = withLocalPhoto(parsed.aiProfile || aiProfile);
      setAIProfileState({
        ...importedProfile,
        imageGenerationInstructions: importedProfile.imageGenerationInstructions !== undefined ? importedProfile.imageGenerationInstructions : initialAIProfileState.imageGenerationInstructions
      });
      setSavedPersonas((parsed.savedPersonas || [importedProfile]).map(withLocalPhoto));
      
      // 2. Restore Chat Data — must go through memoryService (setSessions/setChatHistory are no-ops)
      const importedSessions = parsed.sessions || importedProfile.sessions || [];
      const importedActiveId = parsed.activeSessionId || importedProfile.activeSessionId || (importedSessions.length > 0 ? importedSessions[0].id : null);

      // If backup has no sessions but has legacy flat chatHistory, wrap it into one session
      let sessionsToRestore = importedSessions;
      if (sessionsToRestore.length === 0 && (parsed.chatHistory || importedProfile.chatHistory)) {
        const legacyHistory = parsed.chatHistory || importedProfile.chatHistory || [];
        if (legacyHistory.length > 0) {
          sessionsToRestore = [{
            id: 'restored-' + Date.now(),
            title: 'Restored Chat',
            messages: legacyHistory,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }];
        }
      }

      // Restore sessions into MemoryService (the actual store — setSessions is a no-op)
      memoryService.restoreSessions(sessionsToRestore, importedActiveId).catch(e =>
        console.error('Failed to restore sessions into MemoryService:', e)
      );

      // 3. Restore Other App State
      const importedUser = parsed.userProfile || userProfile;
      setUserProfileState(
        importedUser.referenceImage == null && userProfile.referenceImage
          ? { ...importedUser, referenceImage: userProfile.referenceImage }
          : importedUser
      );
      // Only replace the gallery if the backup actually contains gallery items.
      // Firestore "Restore All" backups deliberately do NOT include the gallery
      // (it lives in its own Drive/Storage backup) — the old unconditional
      // setGallery(parsed.gallery || []) emptied the in-memory gallery here,
      // which made the gallery save effect write an empty id list and DELETE
      // every image from IndexedDB during step 1 of a full restore.
      if (Array.isArray(parsed.gallery) && parsed.gallery.length > 0) {
        setGallery(parsed.gallery);
      }
      setJournal(parsed.journal || []);
      setKnowledgeBase(parsed.knowledgeBase || []);
      setMemories(parsed.memories || []);
      setApiKeyState(parsed.apiKey || null);
      setFcmTokenState(parsed.fcmToken || null);
      setAutoSaveChatInterval(parsed.autoSaveChatInterval !== undefined ? parsed.autoSaveChatInterval : 30);
      setAutoJsonBackupIntervalState(parsed.autoJsonBackupInterval !== undefined ? parsed.autoJsonBackupInterval : 5);
      setProactiveMessageFrequency(parsed.proactiveMessageFrequency !== undefined ? parsed.proactiveMessageFrequency : 'off');
      setNotificationsEnabledState(parsed.notificationsEnabled !== undefined ? parsed.notificationsEnabled : (typeof Notification !== 'undefined' && Notification.permission === 'granted'));
      setShowTimestampsState(parsed.showTimestamps !== undefined ? parsed.showTimestamps : true);
      setTimeZoneState(parsed.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone);
      addToast({ title: "Import Successful", message: "All app data has been restored.", type: "success" });
    } catch (e) {
      console.error("Invalid JSON data", e);
      addToast({ title: "Import Failed", message: "Failed to import data. Invalid JSON.", type: "error" });
    }
  };

  const setFirebaseConfig = (config: {
    apiKey?: string | null; authDomain?: string | null; projectId?: string | null;
    storageBucket?: string | null; appId?: string | null;
    messagingSenderId?: string | null;
  }) => {
    // Update React state for each provided field, then patch IDB directly
    // (same pattern as setMongoUri / setAnthropicApiKey to avoid stale closure issues)
    const updates: Record<string, any> = {};
    if (config.apiKey           !== undefined) { setFirebaseApiKey(config.apiKey);                     updates.firebaseApiKey           = config.apiKey; }
    if (config.authDomain       !== undefined) { setFirebaseAuthDomain(config.authDomain);             updates.firebaseAuthDomain       = config.authDomain; }
    if (config.projectId        !== undefined) { setFirebaseProjectId(config.projectId);               updates.firebaseProjectId        = config.projectId; }
    if (config.storageBucket    !== undefined) { setFirebaseStorageBucket(config.storageBucket);       updates.firebaseStorageBucket    = config.storageBucket; }
    if (config.appId            !== undefined) { setFirebaseAppId(config.appId);                       updates.firebaseAppId            = config.appId; }
    if (config.messagingSenderId !== undefined){ setFirebaseMessagingSenderId(config.messagingSenderId);updates.firebaseMessagingSenderId = config.messagingSenderId; }
    if (Object.keys(updates).length > 0) {
      loadFromDB('indigo_app_data_core').then((core: any) => {
        if (core) saveToDB('indigo_app_data_core', { ...core, ...updates });
      }).catch(() => {});
    }
  };

  // ── Firebase Auth state listener ─────────────────────────────────────────────
  useEffect(() => {
    const hasConfig = firebaseApiKey || import.meta.env.VITE_FIREBASE_API_KEY;
    if (!hasConfig) {
      setAuthLoading(false);
      return;
    }
    // Safety timeout — never leave the app stuck on auth loading
    const timeout = setTimeout(() => setAuthLoading(false), 5000);
    let unsubscribe: (() => void) | undefined;
    try {
      const runtimeConfig = {
        apiKey: firebaseApiKey, authDomain: firebaseAuthDomain,
        projectId: firebaseProjectId, storageBucket: firebaseStorageBucket,
        appId: firebaseAppId, messagingSenderId: firebaseMessagingSenderId,
      };
      unsubscribe = onAuthStateChange((user) => {
        clearTimeout(timeout);
        setCurrentUser(user);
        if (user) {
          setUserId(user.uid);
          localStorage.setItem('indigo_user_id', user.uid);
        }
        setAuthLoading(false);
      }, runtimeConfig);
    } catch (e) {
      console.error('Firebase auth init failed:', e);
      clearTimeout(timeout);
      setAuthLoading(false);
    }
    return () => { clearTimeout(timeout); if (unsubscribe) unsubscribe(); };
  // Only re-subscribe when the core config values actually change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseApiKey, firebaseProjectId, firebaseAppId, firebaseAuthDomain]);

  const signInWithGoogle = async () => {
    const runtimeConfig = {
      apiKey: firebaseApiKey, authDomain: firebaseAuthDomain,
      projectId: firebaseProjectId, storageBucket: firebaseStorageBucket,
      appId: firebaseAppId, messagingSenderId: firebaseMessagingSenderId,
    };
    await fbSignInWithGoogle(runtimeConfig);
  };

  const signOut = async () => {
    const runtimeConfig = {
      apiKey: firebaseApiKey, authDomain: firebaseAuthDomain,
      projectId: firebaseProjectId, storageBucket: firebaseStorageBucket,
      appId: firebaseAppId, messagingSenderId: firebaseMessagingSenderId,
    };
    await fbSignOutUser(runtimeConfig);
    setCurrentUser(null);
  };

  const setAutoSaveChat = (enabled: boolean) => setAutoSaveChatState(enabled);
  const updateUserId = (id: string) => {
    setUserId(id);
    localStorage.setItem('indigo_user_id', id);
  };
  const setAutoJsonBackup = (enabled: boolean) => {
    setAutoJsonBackupState(enabled);
    loadFromDB('indigo_app_data_core').then((core: any) => {
      if (core) saveToDB('indigo_app_data_core', { ...core, autoJsonBackup: enabled });
    }).catch(() => {});
  };
  const setAutoJsonBackupInterval = (interval: number) => {
    setAutoJsonBackupIntervalState(interval);
    loadFromDB('indigo_app_data_core').then((core: any) => {
      if (core) saveToDB('indigo_app_data_core', { ...core, autoJsonBackupInterval: interval });
    }).catch(() => {});
  };

  // ── Auto JSON Backup ──────────────────────────────────────────────────────────
  // A rolling local snapshot of everything exportData() produces — including
  // chat history, sessions, and knowledge base, none of which the Firestore
  // backup carries (Firestore has a 1 MiB document limit; full conversation
  // history and knowledge base files can both exceed that easily). This is
  // the actual timer-driven implementation; the runner that calls this on a
  // schedule lives in AutoJsonBackupRunner.tsx because it needs chat/session
  // data from ChatContext, which — being a child of AppProvider — isn't
  // reachable from in here.
  const saveLocalAutoBackup = React.useCallback(async (data: any) => {
    try {
      await saveToDB('indigo_app_data_auto_json_backup', { data, savedAt: Date.now() });
      const ts = Date.now();
      setLastAutoJsonBackupTime(ts);
    } catch (e) {
      console.error('Auto JSON backup failed to save:', e);
      throw e;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restoreFromLocalAutoBackup = async (): Promise<any | null> => {
    try {
      const record = await loadFromDB('indigo_app_data_auto_json_backup');
      if (!record) return null;
      return (record as any).data ?? null;
    } catch (e) {
      console.error('Failed to read local auto backup:', e);
      return null;
    }
  };
  const setNotificationsEnabled = (enabled: boolean) => setNotificationsEnabledState(enabled);
  const setIsDebuggerEnabled = (enabled: boolean) => {
    console.log(`setIsDebuggerEnabled called with: ${enabled}`);
    console.trace("setIsDebuggerEnabled trace");
    setIsDebuggerEnabledState(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('indigo_debugger_enabled', String(enabled));
      window.dispatchEvent(new Event('indigo_debugger_toggle'));
    }
  };
  const setShowTimestamps = (show: boolean) => setShowTimestampsState(show);
  const setProactiveMessageFrequency = (frequency: '1h' | '6h' | '12h' | '24h' | 'off') => {
    setAIProfileState(prev => ({ ...prev, proactiveMessageFrequency: frequency }));
  };

  const setProactiveEmailFrequency = (frequency: '1h' | '6h' | '12h' | '24h' | 'off') => {
    setAIProfileState(prev => ({ ...prev, proactiveEmailFrequency: frequency }));
  };
  const setAmbientMode = (enabled: boolean) => setAIProfileState(prev => ({ ...prev, ambientMode: enabled }));
  const setAmbientFrequency = (frequency: '1h' | '6h' | '12h' | '24h' | 'off') => setAIProfileState(prev => ({ ...prev, ambientFrequency: frequency }));
  const setAiCanGenerateImages = (enabled: boolean) => setAIProfileState(prev => ({ ...prev, aiCanGenerateImages: enabled }));
  const setTimeZone = (tz: string) => setTimeZoneState(tz);

  const resetApp = async () => {
      try {
          await clearDB();
          localStorage.clear();
          // Reset all state variables to their initial values
          setAIProfileState(initialAIProfileState);
          setSavedPersonas([initialAIProfileState]);
          setUserProfileState(initialUserProfileState);
          setGallery([]);
          setJournal([]);
          setKnowledgeBase([]);
          setMemories([]);
          setApiKeyState(null);
          setAutoSaveChatState(true);
          setAutoSaveChatInterval(30);
          setAutoJsonBackupState(false);
          setAutoJsonBackupIntervalState(5);
          setAIProfileState(prev => ({ ...prev, proactiveMessageFrequency: 'off', timeAwareness: true, ambientMode: false, ambientFrequency: 'off' }));
          setTimeZoneState(Intl.DateTimeFormat().resolvedOptions().timeZone);
          setShowTutorial(false);
          setShowTimestampsState(true);
          window.location.reload();
      } catch (e) {
          console.error("Failed to reset app", e);
          throw e;
      }
  };

  return (
    <AppContext.Provider value={{
      aiProfile, setAIProfile, savePersona, deletePersona, loadPersona,
      savedPersonas, galleryLoaded, loadGallery, reloadGallery, getGalleryItemUrl, galleryLoading, resolveProfileImagesFromGallery,
      userProfile, setUserProfile, setUserReferenceImage,
      gallery, addToGallery, addMultipleToGallery, deleteImageFromGallery, deleteImagesFromGallery, updateGalleryItem,
      journal, addJournalEntry, updateJournalEntry, deleteJournalEntry,
      knowledgeBase,
      personaKnowledgeBase: knowledgeBase.filter(doc =>
        // Show docs tagged to this persona, OR legacy untagged docs if no tagged docs exist
        doc.personaId === aiProfile.id ||
        (!doc.personaId && !knowledgeBase.some(d => d.personaId === aiProfile.id))
      ),
      addToKnowledgeBase, addMultipleToKnowledgeBase, deleteFromKnowledgeBase, deleteMultipleFromKnowledgeBase,
      memories, addMemory, updateMemory, deleteMemory,
      proactiveCommunications, addProactiveCommunication, deleteProactiveCommunication,
      toasts, addToast, removeToast,
      resetApp, exportData, importData,
      apiKey, setApiKey,
      showTutorial, setShowTutorial,
      autoSaveChat, setAutoSaveChat,
      autoSaveChatInterval, setAutoSaveChatInterval,
      autoJsonBackup, setAutoJsonBackup,
      autoJsonBackupInterval, setAutoJsonBackupInterval,
      isSyncEnabled, setIsSyncEnabled,
      syncFrequency, setSyncFrequency,
      notificationsEnabled, setNotificationsEnabled,
      fcmToken, setFcmToken,
      isDebuggerEnabled, setIsDebuggerEnabled,
      showTimestamps, setShowTimestamps,
      proactiveMessageFrequency: aiProfile.proactiveMessageFrequency, setProactiveMessageFrequency,
      proactiveEmailFrequency: aiProfile.proactiveEmailFrequency, setProactiveEmailFrequency,
      ambientMode: aiProfile.ambientMode, setAmbientMode,
      ambientFrequency: aiProfile.ambientFrequency, setAmbientFrequency,
      aiCanGenerateImages: aiProfile.aiCanGenerateImages, setAiCanGenerateImages,
      timeZone, setTimeZone,
      firebaseApiKey, firebaseAuthDomain, firebaseProjectId, firebaseStorageBucket,
      firebaseAppId, firebaseMessagingSenderId, setFirebaseConfig,
      lastCloudSyncTime, lastFirebaseBackupTime, lastGalleryBackupTime,
      setLastCloudSyncTime, setLastFirebaseBackupTime, setLastGalleryBackupTime,
      lastKBBackupTime, setLastKBBackupTime,
      lastChatBackupTime, setLastChatBackupTime,
      firebaseChatBackup, firebaseChatRestore, applyRestoredSessions,
      lastAutoJsonBackupTime, setLastAutoJsonBackupTime,
      restoreFromLocalAutoBackup, saveLocalAutoBackup,
      anthropicApiKey, setAnthropicApiKey,
      elevenLabsApiKey, setElevenLabsApiKey,
      geminiApiKey, setGeminiApiKey,
      openrouterApiKey, setOpenrouterApiKey,
      wavespeedApiKey, setWavespeedApiKey,
      userLocation,
      userMotion,
      environmentalSituation,
      isLoaded, isSuccessfullyLoaded, isPersonaSwitching, lastInteractionTime, setLastInteractionTime,
      userId, setUserId, isSyncing, setIsSyncing,
      exportGalleryData, exportGalleryChunks, importGalleryData, importGalleryChunks, syncGalleryToCloud, restoreGalleryFromCloud,
      updateAIProfile, fetchWithRetry,
      firebaseBackup, firebaseRestore, firebaseGalleryBackup, firebaseGalleryRestore,
      firebaseKBBackup, firebaseKBRestore,
      autoBackupSchedule, setAutoBackupSchedule,
      realTimeSyncEnabled, setRealTimeSyncEnabled,
      currentUser, authLoading, signInWithGoogle, signOut,
    }}>
      {!isLoaded ? (
        <div className="flex h-screen flex-col items-center justify-center bg-indigo-50 dark:bg-indigo-950 p-4 text-center">
          <div className="text-indigo-900 dark:text-indigo-100 font-bold text-xl animate-pulse mb-4">Loading indigo AI...</div>
          {showResetOption && (
            <div className="max-w-xs animate-in fade-in slide-in-from-bottom-4 duration-700">
              <p className="text-sm text-indigo-600 dark:text-indigo-400 mb-4">This is taking longer than expected. There might be an issue with your local data.</p>
              <button 
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="text-xs text-red-600 dark:text-red-400 underline hover:text-red-800 dark:hover:text-red-200"
              >
                Reset App Data & Reload
              </button>
            </div>
          )}
        </div>
      ) : (
        children
      )}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
