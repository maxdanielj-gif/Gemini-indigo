import React, { useRef, useState } from 'react';
import { gzipSync, strToU8 } from 'fflate';
import { useApp } from '../context/AppContext';
import { useChat } from '../context/ChatContext';
import { requestNotificationPermission } from '../services/webPushService';
import { processFile } from '../services/ocrService';
import { Download, Upload, Trash2, Bell, FileText, Key, Save, Database, Smartphone, Cloud, RefreshCw, Clock, Shield, Edit2, LogOut, User, AlertCircle } from 'lucide-react';
import { driveBackupGallery, driveRestoreGallery, driveSignOut, GalleryBackupItem } from '../services/googleDriveService';
import { saveToDB, loadFromDB } from '../services/db';

const SettingsScreen: React.FC = () => {
  const {
    importData, knowledgeBase, addToKnowledgeBase,
    anthropicApiKey, setAnthropicApiKey,
    elevenLabsApiKey, setElevenLabsApiKey,
    geminiApiKey, setGeminiApiKey,
    openrouterApiKey, setOpenrouterApiKey,
    autoSaveChat, setAutoSaveChat, autoSaveChatInterval, setAutoSaveChatInterval,
    autoJsonBackup, setAutoJsonBackup, autoJsonBackupInterval, setAutoJsonBackupInterval,
    resetApp, aiProfile, userProfile,
    notificationsEnabled, setNotificationsEnabled,
    fcmToken, setFcmToken,
    exportData, addToast, reloadGallery,
    showTimestamps, setShowTimestamps,
    timeZone, setTimeZone,
    userId, setUserId,
    isSyncing, setIsSyncing,
    isSyncEnabled, setIsSyncEnabled,
    syncFrequency, setSyncFrequency,
    updateAIProfile,
    isDebuggerEnabled, setIsDebuggerEnabled,
    firebaseBackup, firebaseRestore,
    firebaseKBBackup, firebaseKBRestore,
    wavespeedApiKey, setWavespeedApiKey,
    firebaseApiKey, firebaseAuthDomain, firebaseProjectId,
    firebaseStorageBucket, firebaseMessagingSenderId, firebaseAppId,
    setFirebaseConfig,
    currentUser, signOut,
    lastCloudSyncTime, setLastCloudSyncTime,
    lastFirebaseBackupTime, setLastFirebaseBackupTime,
    lastGalleryBackupTime, setLastGalleryBackupTime,
    autoBackupSchedule, setAutoBackupSchedule,
    realTimeSyncEnabled, setRealTimeSyncEnabled,
    gallery,
  } = useApp();

  const { chatHistory, addChatMessage, setChatHistory, sessions, setSessions, activeSessionId, setActiveSessionId } = useChat();

  const fileInputRef  = useRef<HTMLInputElement>(null);

  const [localAnthropicApiKey,    setLocalAnthropicApiKey]    = useState(anthropicApiKey || '');
  const [localElevenLabsApiKey,   setLocalElevenLabsApiKey]   = useState(elevenLabsApiKey || '');
  const [localGeminiApiKey,       setLocalGeminiApiKey]       = useState(geminiApiKey || '');
  const [localOpenrouterApiKey,   setLocalOpenrouterApiKey]   = useState(openrouterApiKey || '');
  const [localWavespeedApiKey,    setLocalWavespeedApiKey]    = useState(wavespeedApiKey || '');
  const [isFirebaseBackingUp,  setIsFirebaseBackingUp]  = useState(false);
  const [isFirebaseRestoring,  setIsFirebaseRestoring]  = useState(false);
  const [isGalleryBackingUp,   setIsGalleryBackingUp]   = useState(false);
  const [galleryBackupStep,    setGalleryBackupStep]    = useState<string | null>(null);
  const [isGalleryRestoring,   setIsGalleryRestoring]   = useState(false);
  const [galleryRestoreStep,   setGalleryRestoreStep]   = useState<string | null>(null);
  const [isFullRestoring,      setIsFullRestoring]      = useState(false);
  const [fullRestoreStep,      setFullRestoreStep]       = useState<string | null>(null);
  const [showRestoreConfirm,   setShowRestoreConfirm]   = useState(false);

  // Local state for Firebase config fields (never bind inputs directly to context state)
  const [localFbApiKey,       setLocalFbApiKey]       = useState(firebaseApiKey       || '');
  const [localFbAuthDomain,   setLocalFbAuthDomain]   = useState(firebaseAuthDomain   || '');
  const [localFbProjectId,    setLocalFbProjectId]    = useState(firebaseProjectId    || '');
  const [localFbStorageBucket,setLocalFbStorageBucket]= useState(firebaseStorageBucket|| '');
  const [localFbSenderId,     setLocalFbSenderId]     = useState(firebaseMessagingSenderId || '');
  const [localFbAppId,        setLocalFbAppId]        = useState(firebaseAppId        || '');

  // Firebase is ready if the UI fields are filled OR if env vars provide the values.
  // This mirrors the buildConfig() fallback in firebaseService.ts.
  const fbConfigReady = !!(
    (localFbApiKey   || import.meta.env.VITE_FIREBASE_API_KEY) &&
    (localFbProjectId|| import.meta.env.VITE_FIREBASE_PROJECT_ID) &&
    (localFbAppId    || import.meta.env.VITE_FIREBASE_APP_ID)
  );
  const fbStorageReady = !!(localFbStorageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET);

  // Sync local firebase fields when context loads from IndexedDB
  React.useEffect(() => { setLocalFbApiKey(firebaseApiKey || ''); },              [firebaseApiKey]);
  React.useEffect(() => { setLocalFbAuthDomain(firebaseAuthDomain || ''); },      [firebaseAuthDomain]);
  React.useEffect(() => { setLocalFbProjectId(firebaseProjectId || ''); },        [firebaseProjectId]);
  React.useEffect(() => { setLocalFbStorageBucket(firebaseStorageBucket || ''); },[firebaseStorageBucket]);
  React.useEffect(() => { setLocalFbSenderId(firebaseMessagingSenderId || ''); }, [firebaseMessagingSenderId]);
  React.useEffect(() => { setLocalFbAppId(firebaseAppId || ''); },                [firebaseAppId]);

  // Sync local key fields once the context loads saved values from IndexedDB
  React.useEffect(() => { setLocalAnthropicApiKey(anthropicApiKey || ''); }, [anthropicApiKey]);
  React.useEffect(() => { setLocalElevenLabsApiKey(elevenLabsApiKey || ''); }, [elevenLabsApiKey]);
  React.useEffect(() => { setLocalGeminiApiKey(geminiApiKey || ''); }, [geminiApiKey]);
  React.useEffect(() => { setLocalOpenrouterApiKey(openrouterApiKey || ''); }, [openrouterApiKey]);
  React.useEffect(() => { setLocalWavespeedApiKey(wavespeedApiKey || ''); }, [wavespeedApiKey]);
  const [localSyncId,          setLocalSyncId]          = useState(userId || '');
  const [isExporting,          setIsExporting]          = useState(false);
  const [isImporting,          setIsImporting]          = useState(false);
  const [isTestingProactive,   setIsTestingProactive]   = useState(false);

  // Keep local sync ID in step with context userId
  React.useEffect(() => { if (userId) setLocalSyncId(userId); }, [userId]);

  // ── Sync & Recovery ──────────────────────────────────────────────
  const handleSync = async () => {
    setIsSyncing(true);
    addToast({ title: 'Sync', message: 'Syncing to cloud…', type: 'info' });
    try {
      const data = await exportData(chatHistory, sessions, activeSessionId);
      const compressed = gzipSync(strToU8(JSON.stringify({ userId: localSyncId, data })));
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: compressed,
      });
      if (!res.ok) throw new Error('Sync failed');
      setLastCloudSyncTime(Date.now());
      addToast({ title: 'Sync', message: 'Data synced to cloud!', type: 'success' });
    } catch (e: any) {
      addToast({ title: 'Sync Failed', message: e.message || 'Unknown error', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveSyncId = () => {
    if (!localSyncId.trim()) {
      addToast({ title: 'Settings', message: 'Sync ID cannot be empty.', type: 'warning' });
      return;
    }
    setUserId(localSyncId.trim());
    localStorage.setItem('indigo_user_id', localSyncId.trim());
    addToast({ title: 'Saved', message: 'Sync ID updated.', type: 'success' });
  };

  // ── API keys ─────────────────────────────────────────────────────
  const handleSaveAnthropicKey = () => {
    setAnthropicApiKey(localAnthropicApiKey.trim() || null);
    addToast({ title: 'Saved', message: 'Anthropic API key saved.', type: 'success' });
  };

  const handleSaveElevenLabsKey = () => {
    setElevenLabsApiKey(localElevenLabsApiKey.trim() || null);
    addToast({ title: 'Saved', message: 'ElevenLabs API key saved.', type: 'success' });
  };

  const handleSaveGeminiKey = () => {
    setGeminiApiKey(localGeminiApiKey.trim() || null);
    addToast({ title: 'Saved', message: 'Gemini API key saved.', type: 'success' });
  };

  const handleSaveOpenrouterKey = () => {
    setOpenrouterApiKey(localOpenrouterApiKey.trim() || null);
    addToast({ title: 'Saved', message: 'OpenRouter API key saved.', type: 'success' });
  };

  const handleSaveWavespeedKey = () => {
    setWavespeedApiKey(localWavespeedApiKey.trim() || null);
    addToast({ title: 'Saved', message: 'WaveSpeed API key saved.', type: 'success' });
  };

  const handleSaveFirebaseConfig = () => {
    setFirebaseConfig({
      apiKey:            localFbApiKey.trim()        || null,
      authDomain:        localFbAuthDomain.trim()    || null,
      projectId:         localFbProjectId.trim()     || null,
      storageBucket:     localFbStorageBucket.trim() || null,
      messagingSenderId: localFbSenderId.trim()      || null,
      appId:             localFbAppId.trim()          || null,
    });
    addToast({ title: 'Firebase Config Saved', message: 'Firebase configuration saved and ready for backup/restore.', type: 'success' });
  };
  const handleFirebaseBackup = async () => {
    if (!fbConfigReady) {
      addToast({ title: 'Firebase not configured', message: 'Fill in API Key, Project ID and App ID in the Firebase Configuration section above, then save.', type: 'error' });
      return;
    }
    setIsFirebaseBackingUp(true);
    addToast({ title: 'Backup starting…', message: 'Packaging full app data for Firebase…', type: 'info' });
    try {
      // exportData produces the COMPLETE data package (personas, chat, memories, journal, settings)
      const fullData = await exportData(chatHistory, sessions, activeSessionId);
      await firebaseBackup(fullData);
      setLastFirebaseBackupTime(Date.now());
      addToast({ title: 'Backup complete', message: `Full app data backed up to Firebase Firestore for user: ${userId}`, type: 'success' });
    } catch (e: any) {
      addToast({ title: 'Backup failed', message: e.message || 'Could not back up to Firebase. Check your Firebase config.', type: 'error' });
    } finally {
      setIsFirebaseBackingUp(false);
    }
  };

  const handleFirebaseRestore = async () => {
    setIsFirebaseRestoring(true);
    try {
      const backup = await firebaseRestore();
      if (!backup) {
        addToast({ title: 'No backup found', message: `No Firebase backup found for user ID: ${userId}`, type: 'warning' });
        return;
      }
      // Restore all app data directly into local state
      importData(JSON.stringify(backup), setChatHistory, setSessions, setActiveSessionId);
      addToast({ title: 'Restore complete', message: 'App data restored from Firebase. Gallery images can be restored using Full Restore below.', type: 'success' });
    } catch (e: any) {
      addToast({ title: 'Restore failed', message: e.message || 'Could not reach Firebase.', type: 'error' });
    } finally {
      setIsFirebaseRestoring(false);
    }
  };

  // ── Notifications ────────────────────────────────────────────────
  // Helper: format a timestamp as "X minutes/hours/days ago"
  const timeAgo = (ts: number | null): string | null => {
    if (!ts) return null;
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  };

  const handleGalleryDriveBackup = async () => {
    setIsGalleryBackingUp(true);
    setGalleryBackupStep(null);
    try {
      // Feed the backup one image at a time straight from IndexedDB — gallery
      // state only holds metadata now, and this keeps memory flat regardless
      // of gallery size (the whole gallery never sits in memory at once).
      async function* iterateGalleryFromDisk(): AsyncGenerator<GalleryBackupItem> {
        const ids: string[] = (await loadFromDB('indigo_app_data_gallery_ids')) || [];
        for (const id of ids) {
          try {
            const itemStr = await loadFromDB(`indigo_app_data_gallery_item_${id}`);
            if (!itemStr) continue;
            const parsed = typeof itemStr === 'string' ? JSON.parse(itemStr) : itemStr;
            if (parsed?.url) yield parsed as GalleryBackupItem;
          } catch { /* skip corrupt item */ }
        }
      }
      const count = await driveBackupGallery(
        iterateGalleryFromDisk,
        (step) => setGalleryBackupStep(step),
      );
      setLastGalleryBackupTime(Date.now());
      addToast({ title: 'Gallery backed up', message: `${count} image(s) saved to Google Drive.`, type: 'success' });
    } catch (e: any) {
      addToast({ title: 'Gallery backup failed', message: e.message || 'Could not back up to Google Drive.', type: 'error' });
    } finally {
      setIsGalleryBackingUp(false);
      setGalleryBackupStep(null);
    }
  };

  // ── Full restore: Firestore (all app data) + Storage (gallery images) ────────
  // ── Streaming Drive gallery restore ─────────────────────────────────────────
  // Each image is written straight to IndexedDB the moment it arrives and then
  // released, so the phone never holds more than ~one image in memory at a
  // time. (Restoring via React state meant the whole gallery — every base64
  // string — sat in memory at once, which crashed the tab on Android.)
  // Returns null if no backup was found in Drive.
  const restoreDriveGalleryToDisk = async (
    onStep: (step: string) => void,
  ): Promise<{ added: number; skipped: number } | null> => {
    const existingIds: string[] = (await loadFromDB('indigo_app_data_gallery_ids')) || [];
    const idSet = new Set(existingIds);
    const ids = [...existingIds];
    let added = 0;
    let skipped = 0;

    // Keep the lightweight gallery index in step with what we write, so the
    // next gallery open can read one small record instead of rescanning every
    // item. If the existing index is already out of step, skip it — the next
    // gallery load will rebuild it from scratch (self-heal).
    const OVERSIZED_CHARS = 8 * 1024 * 1024; // matches OVERSIZED_ITEM_THRESHOLD_CHARS in AppContext
    let metaIndex: any[] | null = null;
    try {
      const existingMeta = await loadFromDB('indigo_app_data_gallery_meta');
      if (Array.isArray(existingMeta)) {
        const metaIds = new Set(existingMeta.map((m: any) => m?.id));
        if (metaIds.size === ids.length && ids.every(id => metaIds.has(id))) metaIndex = [...existingMeta];
      } else if (ids.length === 0) {
        metaIndex = [];
      }
    } catch { /* index self-heals on next gallery load */ }

    const result = await driveRestoreGallery(onStep, async (item) => {
      if (!item?.id || idSet.has(item.id)) { skipped++; return; }
      // Keep the same persona-stamping behavior the old restore had
      const stamped = { ...item, personaId: item.personaId ?? aiProfile.id };
      const json = JSON.stringify(stamped);
      await saveToDB(`indigo_app_data_gallery_item_${stamped.id}`, json);
      idSet.add(stamped.id);
      ids.push(stamped.id);
      // Update the id list after every image so a mid-restore interruption
      // never leaves saved images orphaned (orphans would be cleaned up/lost).
      await saveToDB('indigo_app_data_gallery_ids', ids);
      if (metaIndex) {
        const url = typeof stamped.url === 'string' ? stamped.url : '';
        metaIndex.push({
          id: stamped.id,
          type: (stamped as any).type ?? 'generated',
          mediaType: (stamped as any).mediaType ?? (url.startsWith('data:video/') ? 'video' : 'image'),
          url: '',
          prompt: stamped.prompt,
          provider: (stamped as any).provider,
          timestamp: (stamped as any).timestamp ?? Date.now(),
          personaId: stamped.personaId,
          onDisk: true,
          ...(json.length > OVERSIZED_CHARS
            ? { oversized: true, approxSizeMB: Math.round((json.length / 1024 / 1024) * 10) / 10 }
            : {}),
        });
        await saveToDB('indigo_app_data_gallery_meta', metaIndex);
      }
      added++;
      onStep(`Saved image ${added} to this device…`);
    });

    if (result === null) return null;
    return { added, skipped };
  };

  const handleFullFirebaseRestore = async () => {
    if (!fbConfigReady) {
      addToast({ title: 'Firebase not configured', message: 'Fill in API Key, Project ID and App ID in Firebase Configuration and save first.', type: 'error' });
      return;
    }
    setIsFullRestoring(true);
    setFullRestoreStep(null);
    try {
      // Step 1: Restore app data (personas, chat, memories, journal, settings) from Firestore
      setFullRestoreStep('Step 1 / 2 — Downloading app data from Firestore…');
      const rawData = await firebaseRestore();
      if (!rawData) throw new Error('No backup found for this User ID in Firestore. Create a backup first.');
      // importData applies ALL state: AI profile, personas, chat history, sessions,
      // journal, memories, knowledge base, user profile, and settings
      importData(JSON.stringify(rawData), setChatHistory, setSessions, setActiveSessionId);

      // Step 2: Restore gallery images from Google Drive (streamed to disk)
      let galleryMsg = '';
      try {
        const res = await restoreDriveGalleryToDisk((step) => setFullRestoreStep(`Step 2 / 2 — ${step}`));
        if (res) {
          setFullRestoreStep('Step 2 / 2 — Refreshing gallery…');
          await reloadGallery();
          galleryMsg = res.added > 0 ? ` ${res.added} gallery image(s) restored from Google Drive.` : ' Gallery already up to date.';
        } else {
          galleryMsg = ' No gallery backup found in Google Drive.';
        }
      } catch (galleryErr: any) {
        galleryMsg = ' (Gallery restore skipped: ' + (galleryErr.message || 'unknown error') + ')';
      }

      addToast({
        title: 'Restore complete',
        message: `App data restored from Firebase.${galleryMsg}`,
        type: 'success',
      });
    } catch (e: any) {
      addToast({ title: 'Restore failed', message: e.message || 'Could not restore from Firebase.', type: 'error' });
    } finally {
      setIsFullRestoring(false);
      setFullRestoreStep(null);
      setShowRestoreConfirm(false);
    }
  };

  const handleGalleryDriveRestore = async () => {
    setIsGalleryRestoring(true);
    setGalleryRestoreStep(null);
    try {
      const res = await restoreDriveGalleryToDisk((step) => setGalleryRestoreStep(step));
      if (!res) {
        addToast({ title: 'No backup found', message: 'No gallery backup was found in your Google Drive.', type: 'warning' });
        return;
      }
      setGalleryRestoreStep('Refreshing gallery…');
      await reloadGallery();
      addToast({
        title: 'Gallery restored',
        message: res.added > 0
          ? `${res.added} image(s) restored from Google Drive.`
          : 'All backed-up images are already in your gallery.',
        type: 'success',
      });
    } catch (e: any) {
      addToast({ title: 'Gallery restore failed', message: e.message || 'Could not restore gallery from Google Drive.', type: 'error' });
    } finally {
      setIsGalleryRestoring(false);
      setGalleryRestoreProgress(null);
    }
  };

  // Format next auto-backup time
  const nextBackupIn = (): string | null => {
    if (autoBackupSchedule === 'off' || !lastFirebaseBackupTime) return null;
    const INTERVAL = autoBackupSchedule === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const due = lastFirebaseBackupTime + INTERVAL;
    const diff = due - Date.now();
    if (diff <= 0) return 'due now';
    if (diff < 3_600_000) return `${Math.ceil(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.ceil(diff / 3_600_000)}h`;
    return `${Math.ceil(diff / 86_400_000)}d`;
  };

  const handleNotificationToggle = async () => {
    if (typeof Notification === 'undefined') {
      addToast({ title: 'Not Supported', message: 'Notifications not supported in this browser.', type: 'warning' });
      return;
    }
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    if (next) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        addToast({ title: 'Enabled', message: 'Notifications enabled.', type: 'success' });
      } else {
        addToast({ title: 'Permission Denied', message: 'Enable notifications in browser settings.', type: 'warning' });
        setNotificationsEnabled(false);
      }
    }
  };

  const handleEnablePush = async () => {
    const result = await requestNotificationPermission(userId || undefined);
    if (result.success && result.endpoint) {
      setFcmToken(result.endpoint);
      addToast({ title: 'Push Enabled', message: result.message, type: 'success' });
    } else {
      addToast({ title: 'Push Failed', message: result.message, type: 'error' });
    }
  };

  const handleTestPush = async () => {
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title: 'indigo AI', body: 'Test push notification!' }),
      });
      if (res.ok) {
        addToast({ title: 'Test Sent', message: 'Push notification sent.', type: 'success' });
      } else {
        const err = await res.json();
        addToast({ title: 'Test Failed', message: err.error || 'Failed', type: 'error' });
      }
    } catch (e: any) {
      addToast({ title: 'Test Failed', message: e.message, type: 'error' });
    }
  };

  // ── Proactive message test ────────────────────────────────────────
  const handleTestProactiveMessage = async () => {
    setIsTestingProactive(true);
    addToast({ title: 'Proactive Message', message: 'Generating…', type: 'info' });
    try {
      const res = await fetch('/api/proactive-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatHistory: chatHistory.slice(-5),
          aiProfile, userProfile,
          anthropicApiKey: anthropicApiKey || undefined,
          userId,
        }),
      });
      if (res.ok) {
        const { message } = await res.json();
        if (message && message !== 'IN_PROGRESS') {
          addChatMessage({ id: `proactive-${Date.now()}`, role: 'model', content: message, timestamp: Date.now() });
          addToast({ title: 'Proactive Message', message: 'Message generated.', type: 'success' });
        }
      } else {
        const err = await res.json();
        addToast({ title: 'Failed', message: err.error || 'Unknown error', type: 'error' });
      }
    } catch (e: any) {
      addToast({ title: 'Error', message: e.message, type: 'error' });
    } finally {
      setIsTestingProactive(false);
    }
  };

  // ── Export / Import ───────────────────────────────────────────────
  const handleExport = async () => {
    setIsExporting(true);
    addToast({ title: 'Exporting', message: 'Preparing backup…', type: 'info' });
    try {
      const data = await exportData(chatHistory, sessions, activeSessionId);
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const ts   = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      a.download = `${aiProfile.name}_backup_${ts}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); setIsExporting(false); }, 100);
      addToast({ title: 'Exported', message: 'Backup downloaded.', type: 'success' });
    } catch {
      addToast({ title: 'Export Failed', message: 'Failed to export.', type: 'error' });
      setIsExporting(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    addToast({ title: 'Importing', message: 'Restoring data…', type: 'info' });
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        if (ev.target?.result) importData(ev.target.result as string, setChatHistory, setSessions, setActiveSessionId);
      } finally { setIsImporting(false); }
    };
    reader.onerror = () => { addToast({ title: 'Import Failed', message: 'Could not read file.', type: 'error' }); setIsImporting(false); };
    reader.readAsText(file);
  };

  const handleStorageCheck = async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const { usage, quota } = await navigator.storage.estimate();
      const usedMB  = ((usage  || 0) / 1024 / 1024).toFixed(1);
      const totalMB = ((quota  || 0) / 1024 / 1024).toFixed(0);
      addToast({ title: 'Storage', message: `${usedMB} MB used of ~${totalMB} MB`, type: 'info' });
    } else {
      addToast({ title: 'Not Supported', message: 'Storage estimation not available.', type: 'warning' });
    }
  };

  // ── JSX ───────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full p-4 overflow-y-auto bg-transparent">
      <h2 className="text-2xl font-bold mb-6 text-indigo-600 dark:text-indigo-400">Settings</h2>

      {isSyncing && (
        <div className="w-full h-1 bg-indigo-100 dark:bg-indigo-900 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-indigo-600 animate-pulse w-full" />
        </div>
      )}

      <div className="space-y-8">

        {/* ── API Keys ── */}
        <section>
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4 border-b border-indigo-200 dark:border-indigo-800 pb-2">API Keys</h3>
          <div className="space-y-4">

            {/* Anthropic */}
            <div>
              <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                Anthropic API Key <span className="text-indigo-400 dark:text-indigo-500 font-normal">(required for AI chat)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input
                    type="password"
                    value={localAnthropicApiKey}
                    onChange={(e) => setLocalAnthropicApiKey(e.target.value)}
                    placeholder="sk-ant-…"
                    className="app-input pl-9"
                  />
                </div>
                <button onClick={handleSaveAnthropicKey} className="app-btn-primary">Save</button>
              </div>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                Get a key at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="underline">console.anthropic.com</a>.
                If the server has a key set, you can leave this blank.
              </p>
            </div>

            {/* ElevenLabs */}
            <div>
              <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                ElevenLabs API Key <span className="text-indigo-400 dark:text-indigo-500 font-normal">(optional — for ElevenLabs TTS)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input
                    type="password"
                    value={localElevenLabsApiKey}
                    onChange={(e) => setLocalElevenLabsApiKey(e.target.value)}
                    placeholder="Your ElevenLabs API key"
                    className="app-input pl-9"
                  />
                </div>
                <button onClick={handleSaveElevenLabsKey} className="app-btn-primary">Save</button>
              </div>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                Get a key at <a href="https://elevenlabs.io" target="_blank" rel="noreferrer" className="underline">elevenlabs.io</a>. Used as an alternative TTS engine in Voice Settings.
              </p>
            </div>

            {/* Gemini */}
            <div>
              <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                Gemini API Key <span className="text-indigo-400 dark:text-indigo-500 font-normal">(optional — for Gemini chat models)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input
                    type="password"
                    value={localGeminiApiKey}
                    onChange={(e) => setLocalGeminiApiKey(e.target.value)}
                    placeholder="Your Gemini API key"
                    className="app-input pl-9"
                  />
                </div>
                <button onClick={handleSaveGeminiKey} className="app-btn-primary">Save</button>
              </div>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                Get a key at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="underline">aistudio.google.com</a>. Enables Gemini models in AI Profile settings, and auto-fallback if Claude is unavailable.
              </p>
            </div>

            {/* OpenRouter */}
            <div>
              <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                OpenRouter API Key <span className="text-indigo-400 dark:text-indigo-500 font-normal">(optional — access hundreds of models from one key)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input
                    type="password"
                    value={localOpenrouterApiKey}
                    onChange={(e) => setLocalOpenrouterApiKey(e.target.value)}
                    placeholder="Your OpenRouter API key"
                    className="app-input pl-9"
                  />
                </div>
                <button onClick={handleSaveOpenrouterKey} className="app-btn-primary">Save</button>
              </div>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                Get a key at <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="underline">openrouter.ai/keys</a>. Requires prepaid credit on your OpenRouter account. Enables OpenRouter as an AI Provider option in AI Profile settings, with a searchable catalog of 300+ models.
              </p>
            </div>

            {/* WaveSpeed */}
            <div>
              <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">
                WaveSpeed API Key <span className="text-indigo-400 dark:text-indigo-500 font-normal">(required for image generation)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input
                    type="password"
                    value={localWavespeedApiKey}
                    onChange={(e) => setLocalWavespeedApiKey(e.target.value)}
                    placeholder="Your WaveSpeed API key"
                    className="app-input pl-9"
                  />
                </div>
                <button onClick={handleSaveWavespeedKey} className="app-btn-primary">Save</button>
              </div>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">
                Get a key at <a href="https://wavespeed.ai" target="_blank" rel="noreferrer" className="underline">wavespeed.ai</a>. Required for the Image Generator.
              </p>
            </div>

          </div>
        </section>

        {/* ── Cloud Sync ── */}
        <section>
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4 border-b border-indigo-200 dark:border-indigo-800 pb-2">Cloud Sync & Recovery</h3>
          <div className="space-y-4">

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-indigo-900 dark:text-indigo-100 block">Enable Auto-Sync</span>
                <span className="text-xs text-indigo-500 dark:text-indigo-400">Sync to cloud automatically.</span>
              </div>
              <button
                onClick={() => setIsSyncEnabled(!isSyncEnabled)}
                className={`w-10 h-6 rounded-full transition-colors ${isSyncEnabled ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${isSyncEnabled ? 'translate-x-2' : '-translate-x-2'}`} />
              </button>
            </div>

            {isSyncEnabled && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-indigo-700 dark:text-indigo-300 whitespace-nowrap">Every</label>
                <input
                  type="number" min="1"
                  value={syncFrequency}
                  onChange={(e) => setSyncFrequency(parseInt(e.target.value) || 5)}
                  className="app-input w-20 text-center"
                />
                <label className="text-sm text-indigo-700 dark:text-indigo-300">minutes</label>
              </div>
            )}

            {/* Google Account */}
            {currentUser && (
              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 flex items-center gap-3">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="avatar" className="w-10 h-10 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-300 dark:bg-indigo-700 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-indigo-700 dark:text-indigo-200" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100 truncate">{currentUser.displayName || 'Google User'}</p>
                  <p className="text-xs text-indigo-500 dark:text-indigo-400 truncate">{currentUser.email}</p>
                  <p className="text-xs text-indigo-400 dark:text-indigo-500 font-mono truncate mt-0.5">UID: {currentUser.uid}</p>
                </div>
                <button
                  onClick={async () => { await signOut(); addToast({ title: 'Signed out', message: 'You have been signed out.', type: 'info' }); }}
                  title="Sign out"
                  className="app-btn-ghost flex-shrink-0 flex items-center gap-1 text-sm px-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            )}

            <div>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="app-btn-primary w-full flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing…' : 'Sync Now'}
              </button>
              {lastCloudSyncTime && (
                <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-1 text-center">
                  Last synced: {timeAgo(lastCloudSyncTime)}
                </p>
              )}
            </div>

          </div>
        </section>

        {/* ── Firebase Configuration ── */}
        <section>
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4 border-b border-indigo-200 dark:border-indigo-800 pb-2">Firebase Configuration</h3>
          <div className="space-y-4">
            <p className="text-sm text-indigo-600 dark:text-indigo-400">
              Enter your Firebase project credentials to enable cloud backup. Find these in the{' '}
              <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="underline font-medium">Firebase Console</a>{' '}
              → Project Settings → Your apps → SDK config.
            </p>

            {/* 2-col grid for short fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'API Key',              key: 'apiKey',            val: localFbApiKey,       set: setLocalFbApiKey,       ph: 'AIzaSy...' },
                { label: 'Auth Domain',          key: 'authDomain',        val: localFbAuthDomain,   set: setLocalFbAuthDomain,   ph: 'project.firebaseapp.com' },
                { label: 'Project ID',           key: 'projectId',         val: localFbProjectId,    set: setLocalFbProjectId,    ph: 'my-project-id' },
                { label: 'Storage Bucket',       key: 'storageBucket',     val: localFbStorageBucket,set: setLocalFbStorageBucket,ph: 'project.firebasestorage.app' },
                { label: 'Messaging Sender ID',  key: 'messagingSenderId', val: localFbSenderId,     set: setLocalFbSenderId,     ph: '123456789012' },
                { label: 'App ID',               key: 'appId',             val: localFbAppId,        set: setLocalFbAppId,        ph: '1:123:web:abc123' },
              ].map(({ label, key, val, set, ph }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">{label}</label>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    placeholder={ph}
                    data-testid={`firebase-${key}-input`}
                    className="app-input font-mono text-xs"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleSaveFirebaseConfig}
              data-testid="firebase-config-save"
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors text-sm">
              Save Firebase Configuration
            </button>

            {/* Backup / Restore */}
            <div className="pt-2 border-t border-indigo-100 dark:border-indigo-800 space-y-3">
              <p className="text-sm text-indigo-600 dark:text-indigo-400">
                Back up your <strong>full app data</strong> (personas, chat, memories, journal, settings) to Firestore. Your Google account UID is used to identify your backup.
              </p>

              {/* App data backup / check */}
              <div>
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1.5">App Data (Firestore)</p>
                <div className="flex gap-3">
                  <button onClick={handleFirebaseBackup} disabled={isFirebaseBackingUp || !fbConfigReady}
                    data-testid="firebase-backup-btn"
                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                    {isFirebaseBackingUp ? <><RefreshCw className="w-4 h-4 animate-spin" />Backing up…</> : 'Backup to Firestore'}
                  </button>
                  <button onClick={handleFirebaseRestore} disabled={isFirebaseRestoring || !fbConfigReady}
                    data-testid="firebase-restore-btn"
                    className="flex-1 py-2.5 bg-white dark:bg-indigo-900 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 rounded-xl font-medium hover:bg-indigo-50 dark:hover:bg-indigo-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                    {isFirebaseRestoring ? <><RefreshCw className="w-4 h-4 animate-spin" />Restoring…</> : 'Restore from Firestore'}
                  </button>
                </div>
                {lastFirebaseBackupTime && (
                  <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-1 text-center">
                    Last backed up: {timeAgo(lastFirebaseBackupTime)}
                  </p>
                )}
              </div>

              {/* Full restore on new device */}
              <div className="border-t border-indigo-100 dark:border-indigo-800 pt-3">
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Restore Everything to This Device</p>
                <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-2">
                  Downloads and applies your full backup: AI personas, chat history, memories, journal, settings, and gallery images.
                  <strong className="text-amber-600 dark:text-amber-400"> This overwrites current app data.</strong>
                </p>
                {!showRestoreConfirm ? (
                  <button
                    onClick={() => setShowRestoreConfirm(true)}
                    disabled={!userId || isFullRestoring}
                    data-testid="full-restore-trigger-btn"
                    className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                    Restore All Data from Firebase
                  </button>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl space-y-2">
                    {isFullRestoring ? (
                      <div className="flex flex-col items-center gap-2 py-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                        <p className="text-xs text-indigo-700 dark:text-indigo-300 text-center">{fullRestoreStep || 'Preparing…'}</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Are you sure?</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">This will overwrite all current app data with your Firebase backup.</p>
                        <div className="flex gap-2 pt-1">
                          <button onClick={handleFullFirebaseRestore}
                            data-testid="full-restore-confirm-btn"
                            className="flex-1 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors">
                            Yes, Restore Now
                          </button>
                          <button onClick={() => setShowRestoreConfirm(false)}
                            className="flex-1 py-2 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 rounded-xl text-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-900 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Gallery backup — Google Drive */}
              <div className="border-t border-indigo-100 dark:border-indigo-800 pt-3">
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Gallery Images (Google Drive)</p>
                <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-2">
                  Backs up your gallery as a single file in your Google Drive.
                  Tapping either button will prompt you to sign in to Google if needed.
                  {gallery.length > 0
                    ? ` You have ${gallery.length} image(s) in your local gallery.`
                    : ' Your gallery is currently empty.'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {/* Backup */}
                  <div>
                    <button
                      onClick={handleGalleryDriveBackup}
                      disabled={isGalleryBackingUp || gallery.length === 0}
                      className="w-full py-2.5 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                      {isGalleryBackingUp ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span className="truncate text-xs">{galleryBackupStep || 'Working…'}</span>
                        </>
                      ) : 'Backup Gallery'}
                    </button>
                    {lastGalleryBackupTime && (
                      <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-1 text-center">
                        Last backup: {timeAgo(lastGalleryBackupTime)}
                      </p>
                    )}
                  </div>
                  {/* Restore */}
                  <div>
                    <button
                      onClick={handleGalleryDriveRestore}
                      disabled={isGalleryRestoring}
                      className="w-full py-2.5 bg-white dark:bg-indigo-900 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 rounded-xl font-medium hover:bg-indigo-50 dark:hover:bg-indigo-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                      {isGalleryRestoring ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span className="truncate text-xs">{galleryRestoreStep || 'Working…'}</span>
                        </>
                      ) : 'Restore Gallery'}
                    </button>
                    <p className="text-[10px] text-indigo-400 dark:text-indigo-500 mt-1 text-center">Downloads images back to this device</p>
                  </div>
                </div>
              </div>

              {/* Real-time sync */}
              <div className="border-t border-indigo-100 dark:border-indigo-800 pt-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Real-time Sync</p>
                    <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
                      Syncs personas, memories, journal and settings to Firestore within 30 seconds of any change.
                      New gallery images upload to Firebase Storage instantly.
                      Requires Firebase to be configured above.
                    </p>
                  </div>
                  <button
                    data-testid="real-time-sync-toggle"
                    onClick={() => setRealTimeSyncEnabled(!realTimeSyncEnabled)}
                    className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors ${realTimeSyncEnabled ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-700'}`}>
                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${realTimeSyncEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                {realTimeSyncEnabled && (
                  <p className="text-[10px] text-green-600 dark:text-green-400 mt-1.5">
                    Real-time sync is active. Changes will upload to Firestore within 30s. New images upload immediately.
                  </p>
                )}
              </div>

              {/* Auto-backup schedule */}
              <div className="border-t border-indigo-100 dark:border-indigo-800 pt-3">
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Auto-Backup Schedule (App Data)</p>
                <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-2">
                  Automatically backs up app data to Firestore in the background. Requires Firebase to be configured and a User ID set.
                  A push notification is sent on completion if notifications are enabled.
                </p>
                <div className="flex gap-2">
                  {(['off', 'daily', 'weekly'] as const).map(opt => (
                    <button
                      key={opt}
                      data-testid={`auto-backup-${opt}`}
                      onClick={() => setAutoBackupSchedule(opt)}
                      className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors capitalize
                        ${autoBackupSchedule === opt
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-800'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
                {autoBackupSchedule !== 'off' && (
                  <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-1.5">
                    {lastFirebaseBackupTime
                      ? `Last backup: ${timeAgo(lastFirebaseBackupTime)} · Next in: ${nextBackupIn() ?? '…'}`
                      : 'First backup will run shortly after the app loads.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Data Management ── */}
        <section>
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4 border-b border-indigo-200 dark:border-indigo-800 pb-2">Data Management</h3>
          <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-3">JSON backups do not include images or videos.</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleExport} disabled={isExporting}
              className="flex items-center justify-center p-3 border border-indigo-200 dark:border-indigo-700 rounded-lg bg-white dark:bg-indigo-900 hover:bg-indigo-50 dark:hover:bg-indigo-800 transition-colors disabled:opacity-50 text-sm text-indigo-700 dark:text-indigo-300">
              {isExporting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {isExporting ? 'Exporting…' : 'Export JSON'}
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={isImporting}
              className="flex items-center justify-center p-3 border border-indigo-200 dark:border-indigo-700 rounded-lg bg-white dark:bg-indigo-900 hover:bg-indigo-50 dark:hover:bg-indigo-800 transition-colors disabled:opacity-50 text-sm text-indigo-700 dark:text-indigo-300">
              {isImporting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {isImporting ? 'Importing…' : 'Import JSON'}
            </button>
          </div>
          <input ref={fileInputRef} type="file" onChange={handleImport} accept=".json" className="hidden" />
        </section>

        {/* ── Preferences ── */}
        <section>
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4 border-b border-indigo-200 dark:border-indigo-800 pb-2">Preferences</h3>
          <div className="space-y-4">

            {/* JSON backup interval */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-indigo-900 dark:text-indigo-100 block">Auto JSON Backup</span>
                <span className="text-xs text-indigo-500 dark:text-indigo-400">Interval in minutes (0 to disable).</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min="0" value={autoJsonBackupInterval}
                  onChange={(e) => setAutoJsonBackupInterval(Number(e.target.value))}
                  className="app-input w-20 text-center text-sm" />
                <button onClick={() => setAutoJsonBackup(!autoJsonBackup)}
                  className={`w-10 h-6 rounded-full transition-colors ${autoJsonBackup ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${autoJsonBackup ? 'translate-x-2' : '-translate-x-2'}`} />
                </button>
              </div>
            </div>

            {/* Proactive test */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-indigo-900 dark:text-indigo-100 block">Test Proactive Message</span>
                <span className="text-xs text-indigo-500 dark:text-indigo-400">Send one immediately.</span>
              </div>
              <button onClick={handleTestProactiveMessage} disabled={isTestingProactive}
                className="app-btn-primary flex items-center gap-1 text-sm">
                {isTestingProactive && <RefreshCw className="w-3 h-3 animate-spin" />}
                {isTestingProactive ? 'Generating…' : 'Test'}
              </button>
            </div>

            {/* In-app notifications toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-indigo-900 dark:text-indigo-100 block">In-App Notifications</span>
                <span className="text-xs text-indigo-500 dark:text-indigo-400">Show toast notifications inside the app.</span>
              </div>
              <button onClick={handleNotificationToggle}
                className={`w-10 h-6 rounded-full transition-colors ${notificationsEnabled ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${notificationsEnabled ? 'translate-x-2' : '-translate-x-2'}`} />
              </button>
            </div>

            {/* Timestamps */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-indigo-900 dark:text-indigo-100 block">Message Timestamps</span>
                <span className="text-xs text-indigo-500 dark:text-indigo-400">Show date/time on each message.</span>
              </div>
              <button onClick={() => setShowTimestamps(!showTimestamps)}
                className={`w-10 h-6 rounded-full transition-colors ${showTimestamps ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${showTimestamps ? 'translate-x-2' : '-translate-x-2'}`} />
              </button>
            </div>

            {/* Mobile Debugger toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <span className="text-sm text-indigo-900 dark:text-indigo-100 block">🐛 Mobile Debugger</span>
                <span className="text-xs text-indigo-500 dark:text-indigo-400">Shows a floating bug button for viewing logs and running JS.</span>
              </div>
              <button onClick={() => setIsDebuggerEnabled(!isDebuggerEnabled)}
                className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${isDebuggerEnabled ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${isDebuggerEnabled ? 'translate-x-2' : '-translate-x-2'}`} />
              </button>
            </div>

            {/* Time zone */}
            <div>
              <label className="text-sm text-indigo-900 dark:text-indigo-100 block mb-1">Time Zone</label>
              <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className="app-input">
                {Intl.supportedValuesOf('timeZone').map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

          </div>
        </section>

        {/* ── Browser Tools ── */}
        <section>
          <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-4 border-b border-indigo-200 dark:border-indigo-800 pb-2">Browser Tools</h3>

          {/* Push notifications — prominent warning when not yet enabled */}
          {!fcmToken && (
            <div className="mb-4 flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Push notifications are off</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Enable push to receive auto-backup alerts and AI messages. Tap the button below — your browser will ask for permission.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button onClick={handleStorageCheck}
              className="flex flex-col items-center justify-center p-4 border border-indigo-200 dark:border-indigo-800 rounded-xl bg-white dark:bg-indigo-950 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-all">
              <Database className="w-5 h-5 mb-1 text-indigo-400" />
              <span className="text-xs text-indigo-700 dark:text-indigo-300">Storage</span>
            </button>
            <button onClick={handleEnablePush}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                fcmToken
                  ? 'border-indigo-200 dark:border-indigo-800 bg-white dark:bg-indigo-950 hover:bg-indigo-50 dark:hover:bg-indigo-900'
                  : 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50'
              }`}>
              <Smartphone className={`w-5 h-5 mb-1 ${fcmToken ? 'text-indigo-400' : 'text-amber-500'}`} />
              <span className={`text-xs font-medium ${fcmToken ? 'text-indigo-700 dark:text-indigo-300' : 'text-amber-700 dark:text-amber-400'}`}>
                Enable Push
              </span>
            </button>
            <button onClick={handleTestPush}
              className="flex flex-col items-center justify-center p-4 border border-indigo-200 dark:border-indigo-800 rounded-xl bg-white dark:bg-indigo-950 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-all">
              <Bell className="w-5 h-5 mb-1 text-indigo-400" />
              <span className="text-xs text-indigo-700 dark:text-indigo-300">Test Push</span>
            </button>
          </div>

          {fcmToken ? (
            <p className="mt-3 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Push notifications active
            </p>
          ) : (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              Push notifications not enabled
            </p>
          )}
        </section>

        {/* ── Danger Zone ── */}
        <section>
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4 border-b border-red-100 dark:border-red-900/30 pb-2">Danger Zone</h3>
          <button
            onClick={async () => {
              if (window.confirm('This will wipe all local data and reset the app. Are you sure?')) {
                try { await resetApp(); }
                catch { addToast({ title: 'Reset Failed', message: 'Failed to reset.', type: 'error' }); }
              }
            }}
            className="flex items-center text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium text-sm"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Reset All Data
          </button>
          <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">Cannot be undone.</p>
        </section>

      </div>

    </div>
  );
};

export default SettingsScreen;
