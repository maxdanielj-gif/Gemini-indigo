import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useChat } from '../context/ChatContext';

// The Auto JSON Backup toggle in Settings used to do nothing — it saved its
// own on/off state and interval, but nothing ever read those values to
// actually perform a backup. This component is that missing piece.
//
// It lives here, outside AppContext itself, because the data it needs to
// back up (chat history, sessions) comes from ChatContext — which is a
// *child* of AppProvider in the component tree, so AppContext can't reach it
// directly. Mounted once inside both providers (see App.tsx), it has access
// to both and drives the actual timer.
//
// Unlike the Firestore backup (which deliberately excludes chat history and
// knowledge base — both can be too large for Firestore's 1 MiB document
// limit), this saves a complete local snapshot via exportData(), which does
// include them, straight into IndexedDB. It's a same-device safety net, not
// a substitute for cloud backup — but it's exactly what "Auto JSON Backup"
// was always meant to be.
const AutoJsonBackupRunner: React.FC = () => {
  const { isSuccessfullyLoaded, autoJsonBackup, autoJsonBackupInterval, exportData, saveLocalAutoBackup, lastAutoJsonBackupTime } = useApp();
  const { chatHistory, sessions, activeSessionId } = useChat();

  // Avoids re-running the same check/backup twice for the same tick, and
  // lets the effect read the very latest values without re-subscribing the
  // interval itself every time something changes.
  const stateRef = useRef({ chatHistory, sessions, activeSessionId, exportData, saveLocalAutoBackup, lastAutoJsonBackupTime });
  useEffect(() => {
    stateRef.current = { chatHistory, sessions, activeSessionId, exportData, saveLocalAutoBackup, lastAutoJsonBackupTime };
  }, [chatHistory, sessions, activeSessionId, exportData, saveLocalAutoBackup, lastAutoJsonBackupTime]);

  useEffect(() => {
    if (!isSuccessfullyLoaded || !autoJsonBackup || !autoJsonBackupInterval || autoJsonBackupInterval <= 0) return;
    const intervalMs = autoJsonBackupInterval * 60 * 1000;

    const runIfDue = async () => {
      const { chatHistory, sessions, activeSessionId, exportData, saveLocalAutoBackup, lastAutoJsonBackupTime } = stateRef.current;
      const last = lastAutoJsonBackupTime || 0;
      if (Date.now() - last < intervalMs) return;
      try {
        const data = await exportData(chatHistory, sessions, activeSessionId);
        await saveLocalAutoBackup(data);
      } catch (e) {
        console.error('Auto JSON backup run failed:', e);
      }
    };

    // Check shortly after becoming enabled, then on a steady cadence. Checking
    // every minute (rather than exactly on `intervalMs`) means a change to the
    // interval setting takes effect quickly instead of waiting out whatever
    // the old interval happened to be.
    const initial = setTimeout(runIfDue, 5_000);
    const id = setInterval(runIfDue, 60_000);
    return () => { clearTimeout(initial); clearInterval(id); };
  }, [isSuccessfullyLoaded, autoJsonBackup, autoJsonBackupInterval]);

  return null;
};

export default AutoJsonBackupRunner;
