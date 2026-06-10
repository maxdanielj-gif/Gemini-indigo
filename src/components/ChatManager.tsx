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

  // ── Auto JSON backup ────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !autoJsonBackup || autoJsonBackupInterval <= 0) return;

    const id = setInterval(async () => {
      try {
        await exportData(chatHistory, sessions, activeSessionId);
        console.log("Auto JSON backup triggered");
      } catch (e) {
        console.error("Auto JSON backup failed:", e);
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

  useEffect(() => { lastInteractionRef.current  = lastInteractionTime; }, [lastInteractionTime]);
  useEffect(() => { chatHistoryRef.current       = chatHistory;        }, [chatHistory]);
  useEffect(() => { aiProfileRef.current         = aiProfile;          }, [aiProfile]);
  useEffect(() => { userProfileRef.current       = userProfile;        }, [userProfile]);
  useEffect(() => { userIdRef.current            = userId;             }, [userId]);
  useEffect(() => { anthropicKeyRef.current      = anthropicApiKey;    }, [anthropicApiKey]);
  useEffect(() => { geminiKeyRef.current         = geminiApiKey;       }, [geminiApiKey]);

  const sessionStartRef         = React.useRef(Date.now());
  const isProcessingRef         = React.useRef(false);
  const lastProactiveTriggerRef = React.useRef(0);
  const lastAmbientTriggerRef   = React.useRef(0);

  const getIntervalMs = (freq: string) => {
    switch (freq) {
      // Proactive message intervals
      case '2h':  return 2  * 60 * 60 * 1000;
      case '3h':  return 3  * 60 * 60 * 1000;
      case '5h':  return 5  * 60 * 60 * 1000;
      case '11h': return 11 * 60 * 60 * 1000;
      // Legacy values (in case old settings are stored)
      case '1h':  return 2  * 60 * 60 * 1000;
      case '6h':  return 5  * 60 * 60 * 1000;
      case '12h': return 11 * 60 * 60 * 1000;
      case '24h': return 11 * 60 * 60 * 1000;
      // Ambient mode intervals
      case '15m': return 15 * 60 * 1000;
      case '30m': return 30 * 60 * 1000;
      case '45m': return 45 * 60 * 1000;
      case '60m': return 60 * 60 * 1000;
      default: return Infinity;
    }
  };

  // ── Proactive messages (user is AWAY) ──────────────────────────────
  useEffect(() => {
    if (!isLoaded || aiProfile.proactiveMessageFrequency === 'off') return;
    const interval = getIntervalMs(aiProfile.proactiveMessageFrequency);
    if (interval === Infinity) return;

    const check = async () => {
      if (isProcessingRef.current) return;
      const now = Date.now();
      const sinceInteraction = now - lastInteractionRef.current;
      const sinceSession     = now - sessionStartRef.current;
      const sinceTrigger     = now - lastProactiveTriggerRef.current;
      const hasUserMsg = chatHistoryRef.current.some(m => m.role === 'user');

      if (
        sinceInteraction >= interval &&
        sinceSession     >= 2 * 60 * 1000 && // app open for at least 2 minutes
        sinceTrigger     >= interval &&
        hasUserMsg
      ) {
        isProcessingRef.current = true;
        lastProactiveTriggerRef.current = now;
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
              geminiKey: geminiApiKey || undefined,
              timeZone,
              type: 'message',
            }),
          });

          if (res.ok) {
            const { message } = await res.json();
            if (message && message !== 'IN_PROGRESS') {
              addChatMessage({
                id: `proactive-${Date.now()}`,
                role: 'model',
                content: message,
                timestamp: Date.now(),
              });
              // Push notification is sent server-side automatically using
              // the stored push subscription for this userId.
            }
          }
        } catch (e) {
          console.error("Proactive message error:", e);
        } finally {
          isProcessingRef.current = false;
        }
      }
    };

    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [isLoaded, aiProfile.proactiveMessageFrequency]);

  // ── Ambient messages (user is ACTIVE) ─────────────────────────────
  useEffect(() => {
    if (!isLoaded || !aiProfile.ambientMode || aiProfile.ambientFrequency === 'off') return;
    const interval = getIntervalMs(aiProfile.ambientFrequency);
    if (interval === Infinity) return;

    const check = async () => {
      if (isProcessingRef.current) return;
      const now = Date.now();
      const sinceSession   = now - sessionStartRef.current;
      const sinceTrigger   = now - lastAmbientTriggerRef.current;
      const sinceLastMsg   = now - lastInteractionRef.current;
      const proactiveMs    = getIntervalMs(aiProfileRef.current.proactiveMessageFrequency);
      const hasUserMsg = chatHistoryRef.current.some(m => m.role === 'user');

      if (
        sinceSession >= 60 * 1000 &&    // app open for at least 1 minute
        sinceTrigger >= interval &&
        sinceLastMsg >= 30000 &&        // at least 30s since last interaction
        sinceLastMsg <  proactiveMs &&  // but not so long it should be proactive
        hasUserMsg
      ) {
        isProcessingRef.current = true;
        lastAmbientTriggerRef.current = now;
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
              geminiKey: geminiApiKey || undefined,
              timeZone,
              isAmbient: true,
            }),
          });

          if (res.ok) {
            const { message } = await res.json();
            if (message && message !== 'IN_PROGRESS') {
              addChatMessage({
                id: `ambient-${Date.now()}`,
                role: 'model',
                content: message,
                timestamp: Date.now(),
              });
            }
          }
        } catch (e) {
          console.error("Ambient message error:", e);
        } finally {
          isProcessingRef.current = false;
        }
      }
    };

    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [isLoaded, aiProfile.ambientMode, aiProfile.ambientFrequency]);

  return null;
};

export default ChatManager;
