import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useChat } from '../context/ChatContext';

const ChatManager: React.FC = () => {
  const {
    aiProfile,
    setAIProfile,
    userProfile,
    anthropicApiKey,
    geminiApiKey,
    timeZone,
    isLoaded,
    userId,
    lastInteractionTime,
    autoJsonBackup,
    autoJsonBackupInterval,
    exportData,
    fetchWithRetry,
    environmentalSituation,
  } = useApp();

  const { addChatMessage, chatHistory, sessions, activeSessionId } = useChat();

  // ── Persona growth analysis every 10 messages ──────────────────────
  useEffect(() => {
    if (!isLoaded || chatHistory.length === 0 || chatHistory.length % 10 !== 0) return;

    const analyzePersona = async () => {
      try {
        const res = await fetch('/api/analyze-persona', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: chatHistory.slice(-20),
            aiProfile,
            anthropicKey: anthropicApiKey || undefined,
          }),
        });
        if (!res.ok) return;
        const updatedFields = await res.json();
        if (Object.keys(updatedFields).length > 0) {
          setAIProfile({ ...aiProfile, ...updatedFields });
        }
      } catch (e) {
        console.error("Persona analysis failed:", e);
      }
    };

    analyzePersona();
  }, [chatHistory.length]);

  // ── Auto JSON backup — actually downloads a file ──────────────────
  useEffect(() => {
    if (!isLoaded || !autoJsonBackup || autoJsonBackupInterval <= 0) return;

    const id = setInterval(async () => {
      try {
        const data = await exportData(chatHistory, sessions, activeSessionId);
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        a.download = `indigo_auto_backup_${ts}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        console.log('Auto JSON backup downloaded');
      } catch (e) {
        console.error('Auto JSON backup failed:', e);
      }
    }, autoJsonBackupInterval * 60 * 1000);

    return () => clearInterval(id);
  }, [isLoaded, autoJsonBackup, autoJsonBackupInterval]);

  // ── Stable refs so interval callbacks always see fresh values ──────
  const lastInteractionRef  = React.useRef(lastInteractionTime);
  const chatHistoryRef      = React.useRef(chatHistory);
  const aiProfileRef        = React.useRef(aiProfile);
  const userProfileRef      = React.useRef(userProfile);
  const userIdRef           = React.useRef(userId);
  const anthropicKeyRef     = React.useRef(anthropicApiKey);
  const geminiKeyRef        = React.useRef(geminiApiKey);
  const envSituationRef     = React.useRef(environmentalSituation);

  useEffect(() => { lastInteractionRef.current  = lastInteractionTime;      }, [lastInteractionTime]);
  useEffect(() => { chatHistoryRef.current       = chatHistory;              }, [chatHistory]);
  useEffect(() => { aiProfileRef.current         = aiProfile;                }, [aiProfile]);
  useEffect(() => { userProfileRef.current       = userProfile;              }, [userProfile]);
  useEffect(() => { userIdRef.current            = userId;                   }, [userId]);
  useEffect(() => { anthropicKeyRef.current      = anthropicApiKey;          }, [anthropicApiKey]);
  useEffect(() => { geminiKeyRef.current         = geminiApiKey;             }, [geminiApiKey]);
  useEffect(() => { envSituationRef.current      = environmentalSituation;  }, [environmentalSituation]);

  const sessionStartRef       = React.useRef(Date.now());
  const isProcessingRef       = React.useRef(false);
  const lastEnvTriggerRef     = React.useRef(0);
  const lastSituationRef      = React.useRef<string>('');

  // ── Environmental awareness engine (replaces proactive + ambient loops) ────
  // Triggers when the situation classifier detects a meaningful state change
  // and the persona has environmental awareness enabled.
  useEffect(() => {
    if (!isLoaded) return;

    const check = async () => {
      const profile = aiProfileRef.current;
      if (profile.aiInitiatedMessagesEnabled === false) return;
      if (!profile.environmentalAwarenessEnabled) return;
      if (isProcessingRef.current) return;

      const env = envSituationRef.current;
      if (!env) return;

      const now = Date.now();
      const minGapMs = (profile.envMinGapMinutes ?? 30) * 60 * 1000;
      const sinceLastTrigger = now - lastEnvTriggerRef.current;
      const sinceSession = now - sessionStartRef.current;
      const hasUserMsg = chatHistoryRef.current.some(m => m.role === 'user');

      if (sinceSession < 60 * 1000) return;  // wait 1 min after session start
      if (sinceLastTrigger < minGapMs) return;
      if (!hasUserMsg) return;

      // Decide if this situation warrants a message
      const shouldTrigger = (() => {
        const changeType = env.lastChangeType;

        // Sustained stillness check
        if (profile.envStillnessMinutes && env.stillnessDurationMinutes >= profile.envStillnessMinutes) {
          return { reason: 'stillness', tone: 'soft' };
        }
        // Movement started after stillness
        if (profile.envMovementResponse && changeType === 'movement_started') {
          return { reason: 'movement_started', tone: 'light' };
        }
        // Movement stopped (settled)
        if (changeType === 'movement_stopped') {
          return { reason: 'movement_stopped', tone: 'soft' };
        }
        // Significant sound change
        if (profile.envSoundResponse && changeType === 'sound_changed') {
          return { reason: 'sound_changed', tone: 'curious' };
        }
        // Significant light change
        if (profile.envLightResponse && changeType === 'light_changed') {
          return { reason: 'light_changed', tone: 'observational' };
        }
        return null;
      })();

      // Avoid re-triggering for the exact same situation description
      if (!shouldTrigger) return;
      if (env.situation === lastSituationRef.current) return;

      isProcessingRef.current = true;
      lastEnvTriggerRef.current = now;
      lastSituationRef.current = env.situation;

      try {
        const res = await fetchWithRetry('/api/proactive-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userIdRef.current,
            chatHistory: chatHistoryRef.current.slice(-5),
            aiProfile: aiProfileRef.current,
            userProfile: userProfileRef.current,
            anthropicApiKey: anthropicKeyRef.current || undefined,
            geminiKey: geminiKeyRef.current || undefined,
            timeZone,
            isAmbient: true,
            environmentalContext: env.situation,
            triggerTone: shouldTrigger.tone,
            triggerReason: shouldTrigger.reason,
          }),
        });

        if (res.ok) {
          const { message } = await res.json();
          if (message && message !== 'IN_PROGRESS') {
            addChatMessage({
              id: `env-${Date.now()}`,
              role: 'model',
              content: message,
              timestamp: Date.now(),
            });
          }
        }
      } catch (e) {
        console.error('Environmental awareness trigger error:', e);
      } finally {
        isProcessingRef.current = false;
      }
    };

    // Check every 60 seconds — the real gating is situation change + min gap
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, [isLoaded]);

  return null;
};

export default ChatManager;
