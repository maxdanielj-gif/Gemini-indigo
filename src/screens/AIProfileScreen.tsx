import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { generateElevenLabsSpeech, listElevenLabsVoices } from '../services/asyncService';
import { useApp } from '../context/AppContext';
import { useChat } from '../context/ChatContext';
import { AIProfile, ChatMessage, ChatSession } from '../types';
import { 
  Upload, 
  Plus, 
  Save, 
  Trash2, 
  Users, 
  Play, 
  Download, 
  Mic, 
  Loader2, 
  RotateCcw, 
  HelpCircle,
  Volume2,
  Headphones,
  Settings,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  MessageSquare,
  X
} from 'lucide-react';
import PreviewChat from '../components/PreviewChat';

const AIProfileScreen: React.FC = () => {
  const {
    aiProfile, setAIProfile, savePersona, deletePersona, savedPersonas, loadPersona,
    setAmbientMode, setAmbientFrequency, addToast,
    anthropicApiKey, elevenLabsApiKey, geminiApiKey, openrouterApiKey, userId,
  } = useApp();
  const { chatHistory, sessions, activeSessionId, setChatHistory, setSessions, setActiveSessionId } = useChat();
  const [name, setName] = useState(aiProfile.name);
  const [personality, setPersonality] = useState(aiProfile.personality);
  const [behavioralPatterns, setBehavioralPatterns] = useState(aiProfile.behavioralPatterns || '');
  const [goals, setGoals] = useState(aiProfile.goals || '');
  const [coreValues, setCoreValues] = useState(aiProfile.coreValues || '');
  const [likes, setLikes] = useState(aiProfile.likes || '');
  const [dislikes, setDislikes] = useState(aiProfile.dislikes || '');
  const [speakingStyle, setSpeakingStyle] = useState(aiProfile.speakingStyle || '');
  const [backstory, setBackstory] = useState(aiProfile.backstory);
  const [appearance, setAppearance] = useState(aiProfile.appearance);
  const [voiceURI, setVoiceURI] = useState(aiProfile.voiceURI || '');
  const [voicePitch, setVoicePitch] = useState(aiProfile.voicePitch || 1.0);
  const [voiceSpeed, setVoiceSpeed] = useState(aiProfile.voiceSpeed || 1.0);
  const [autoReadMessages, setAutoReadMessages] = useState(aiProfile.autoReadMessages || false);
  const [voiceDescription, setVoiceDescription] = useState(aiProfile.voiceDescription || '');
  const [voiceProvider, setVoiceProvider] = useState<'browser' | 'elevenlabs' | 'gemini'>(
    (aiProfile.voiceProvider === 'elevenlabs') ? 'elevenlabs' : (aiProfile.voiceProvider === 'gemini') ? 'gemini' : 'browser'
  );
  const [responseLength, setResponseLength] = useState<AIProfile['responseLength']>(aiProfile.responseLength || 'medium');
  const [responseDetail, setResponseDetail] = useState<AIProfile['responseDetail']>(aiProfile.responseDetail || 'standard');
  const [responseTone, setResponseTone] = useState<AIProfile['responseTone']>(aiProfile.responseTone || 'friendly');
  const [customParagraphCount, setCustomParagraphCount] = useState<number | null>(aiProfile.customParagraphCount || null);
  const [customWordCount, setCustomWordCount] = useState<number | null>(aiProfile.customWordCount || null);
  const [proactiveMessageFrequency, setProactiveMessageFrequency] = useState<AIProfile['proactiveMessageFrequency']>(aiProfile.proactiveMessageFrequency || 'off');

  const [availableBlogs, setAvailableBlogs] = useState<{id: string, name: string}[]>([]);
  const [isFetchingBlogs, setIsFetchingBlogs] = useState(false);
  const [googleToolsEnabled, setGoogleToolsEnabled] = useState<boolean>(aiProfile.googleToolsEnabled || false);
  const [aiCanUseMotion, setAiCanUseMotion] = useState<boolean>(aiProfile.aiCanUseMotion || false);

  const handleMotionToggle = () => {
    if (aiCanUseMotion) {
      // Turning off — just do it
      setAiCanUseMotion(false);
      return;
    }
    // Turning on — test the sensor first
    addToast({ title: 'Motion Context', message: 'Checking motion sensors...', type: 'info' });
    let received = false;
    const testHandler = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (a && (a.x !== null || a.y !== null || a.z !== null)) {
        received = true;
      }
    };
    window.addEventListener('devicemotion', testHandler);
    setTimeout(() => {
      window.removeEventListener('devicemotion', testHandler);
      if (received) {
        setAiCanUseMotion(true);
        addToast({ title: 'Motion Context', message: 'Motion sensors active — context will be shared with the AI.', type: 'success' });
      } else {
        addToast({ title: 'Motion Context', message: 'No motion data detected. Your device or browser may not support this.', type: 'error' });
      }
    }, 2000);
  };
  const [aiCanUseWebSearch, setAiCanUseWebSearch] = useState<boolean>(aiProfile.aiCanUseWebSearch || false);
  const [aiCanUseWeather, setAiCanUseWeather] = useState<boolean>(aiProfile.aiCanUseWeather || false);
  const [aiCanUseCalendar, setAiCanUseCalendar] = useState<boolean>(aiProfile.aiCanUseCalendar || false);
  const [aiCanUseGoogleMaps, setAiCanUseGoogleMaps] = useState<boolean>(aiProfile.aiCanUseGoogleMaps || false);
  const [aiCanGenerateSpeech, setAiCanGenerateSpeech] = useState<boolean>(aiProfile.aiCanGenerateSpeech ?? true);
  const [textOnlyMode, setTextOnlyMode] = useState<boolean>(aiProfile.textOnlyMode ?? false);
  const [knowsItsAI, setKnowsItsAI] = useState<boolean>(aiProfile.knowsItsAI ?? true);
  
  useEffect(() => {
    const fetchLatestProfile = async () => {
      if (!userId) return;
      try {
        const response = await fetch(`/api/sync/${userId}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.lastProactiveStatus) {
            setAIProfile({ ...aiProfile, lastProactiveStatus: data.lastProactiveStatus });
          }
        }
      } catch (e) {
        console.error("Error fetching latest profile:", e);
      }
    };
    fetchLatestProfile();
  }, [userId]);
  
  // Small fallback list used only if the live fetch (below) fails or hasn't
  // completed yet — e.g. no API key saved, or offline. Kept intentionally
  // short since it's just a safety net, not the primary source of models.
  const FALLBACK_CLAUDE_MODELS = [
    { id: 'claude-sonnet-5', name: 'Claude Sonnet (Recommended)' },
    { id: 'claude-opus-4-8', name: 'Claude Opus (Most capable)' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku (Fastest)' },
  ];
  const FALLBACK_GEMINI_MODELS = [
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview' },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  ];
  // Accept any model string
  const validateModel = (m: string | undefined): string => {
    if (m) return m;
    return 'claude-sonnet-5';
  };

  // Live model lists — fetched from Anthropic/Google directly (via our server,
  // which has the actual API keys) so this dropdown reflects whatever models
  // are currently available, without needing an app update every time either
  // provider changes their lineup. Falls back to the static lists above if
  // the fetch fails or no key is saved yet.
  const [liveClaudeModels, setLiveClaudeModels] = useState<{ id: string; name: string }[] | null>(null);
  const [liveGeminiModels, setLiveGeminiModels] = useState<{ id: string; name: string }[] | null>(null);
  const [liveOpenRouterModels, setLiveOpenRouterModels] = useState<{ id: string; name: string; contextLength?: number | null; promptPrice?: string | null; completionPrice?: string | null }[] | null>(null);
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);

  const refreshModelLists = useCallback(async () => {
    setIsRefreshingModels(true);
    const [claudeResult, geminiResult, openrouterResult] = await Promise.allSettled([
      anthropicApiKey
        ? fetch('/api/models/claude', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: anthropicApiKey }),
          }).then(r => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
        : Promise.reject(new Error('no key')),
      // Gemini's list is a curated static list on our own server (see
      // /api/models/gemini) — no API key is needed just to fetch it.
      fetch('/api/models/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).then(r => (r.ok ? r.json() : Promise.reject(new Error('failed')))),
      // OpenRouter's catalog is public — no API key needed to browse it,
      // only to actually chat with a model.
      fetch('/api/models/openrouter').then(r => (r.ok ? r.json() : Promise.reject(new Error('failed')))),
    ]);
    if (claudeResult.status === 'fulfilled' && Array.isArray(claudeResult.value.models) && claudeResult.value.models.length > 0) {
      setLiveClaudeModels(claudeResult.value.models);
    }
    if (geminiResult.status === 'fulfilled' && Array.isArray(geminiResult.value.models) && geminiResult.value.models.length > 0) {
      setLiveGeminiModels(geminiResult.value.models);
    }
    if (openrouterResult.status === 'fulfilled' && Array.isArray(openrouterResult.value.models) && openrouterResult.value.models.length > 0) {
      setLiveOpenRouterModels(openrouterResult.value.models);
    }
    setIsRefreshingModels(false);
  }, [anthropicApiKey]);

  // Fetch once on load — quietly falls back to the static lists if it fails,
  // so this never blocks or breaks the screen.
  useEffect(() => { refreshModelLists(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const claudeModelOptions = liveClaudeModels && liveClaudeModels.length > 0 ? liveClaudeModels : FALLBACK_CLAUDE_MODELS;
  const geminiModelOptions = liveGeminiModels && liveGeminiModels.length > 0 ? liveGeminiModels : FALLBACK_GEMINI_MODELS;

  // OpenRouter's catalog is large (300+ models), so instead of a native
  // dropdown we show a search box that filters down to matching results —
  // much easier to use on a phone than scrolling a huge <select>.
  const [openRouterSearch, setOpenRouterSearch] = useState('');
  const openRouterModelOptions = liveOpenRouterModels || [];
  const filteredOpenRouterModels = (() => {
    const q = openRouterSearch.trim().toLowerCase();
    if (!q) return openRouterModelOptions.slice(0, 40);
    return openRouterModelOptions
      .filter(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
      .slice(0, 40);
  })();

  const [model, setModel] = useState(validateModel(aiProfile.model));
  const selectedOpenRouterModel = openRouterModelOptions.find(m => m.id === model);
  const [llmProvider, setLlmProvider] = useState<'claude' | 'gemini' | 'openrouter'>(
    (aiProfile.llmProvider === 'gemini' ? 'gemini' : aiProfile.llmProvider === 'openrouter' ? 'openrouter' : 'claude')
  );
  const [temperature, setTemperature] = useState(aiProfile.temperature || 0.7);
  const [timeAwareness, setTimeAwareness] = useState<boolean>(aiProfile.timeAwareness ?? true);
  const [ambientModeState, setAmbientModeState] = useState<boolean>(aiProfile.ambientMode ?? false);
  const [ambientFrequencyState, setAmbientFrequencyState] = useState<AIProfile['ambientFrequency']>(aiProfile.ambientFrequency || 'off');
  // Environmental awareness state
  const [envAwarenessEnabled, setEnvAwarenessEnabled] = useState<boolean>(aiProfile.environmentalAwarenessEnabled || false);
  const [envStillnessMinutes, setEnvStillnessMinutes] = useState<number>(aiProfile.envStillnessMinutes ?? 20);
  const [envStillnessInput, setEnvStillnessInput] = useState<string>(String(aiProfile.envStillnessMinutes ?? 20));
  const [envMovementResponse, setEnvMovementResponse] = useState<boolean>(aiProfile.envMovementResponse ?? true);
  const [envSoundResponse, setEnvSoundResponse] = useState<boolean>(aiProfile.envSoundResponse ?? false);
  const [envLightResponse, setEnvLightResponse] = useState<boolean>(aiProfile.envLightResponse ?? false);
  const [envMinGapMinutes, setEnvMinGapMinutes] = useState<number>(aiProfile.envMinGapMinutes ?? 30);
  const [envMinGapInput, setEnvMinGapInput] = useState<string>(String(aiProfile.envMinGapMinutes ?? 30));
  const [aiInitiatedMessagesEnabled, setAiInitiatedMessagesEnabled] = useState<boolean>(aiProfile.aiInitiatedMessagesEnabled ?? true);
  const [pendingImport, setPendingImport] = useState<{ persona: AIProfile; existingName: string } | null>(null);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(aiProfile.id);
  const [imageStyle, setImageStyle] = useState<string>(aiProfile.imageStyle || 'none');
  const [imageGenerationInstructions, setImageGenerationInstructions] = useState<string[]>(aiProfile.imageGenerationInstructions || []);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [referenceImage, setReferenceImage] = useState<string | null>(aiProfile.referenceImage);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Preview Chat State
  const [previewInput, setPreviewInput] = useState('');
  const [previewMessages, setPreviewMessages] = useState<{role: 'user' | 'model', content: string, attachments?: {type: string, content: string, name: string}[]}[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const geminiVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

  const handleTestVoice = async () => {
    if (isTestingVoice) return;
    addToast({ title: "Voice Test", message: "Generating voice sample...", type: "info" });
    await new Promise(resolve => setTimeout(resolve, 600));
    setIsTestingVoice(true);
    const text = `Hello! I am ${name}. This is an example of how I sound.`;

    if (voiceProvider === 'elevenlabs' && elevenLabsVoiceId) {
      try {
        const audioBlob = await generateElevenLabsSpeech(text, elevenLabsVoiceId, elevenLabsApiKey, elevenLabsModelId, {
          stability: elStability, similarityBoost: elSimilarity, style: elStyle,
          useSpeakerBoost: elSpeakerBoost, speakingRate: elSpeakingRate,
        });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.onended = () => { setIsTestingVoice(false); URL.revokeObjectURL(audioUrl); };
        audio.onerror = () => { setIsTestingVoice(false); URL.revokeObjectURL(audioUrl); };
        audio.play().catch(() => setIsTestingVoice(false));
      } catch (error: any) {
        addToast({ title: "Voice Error", message: error.message || "ElevenLabs TTS failed.", type: "error" });
        setIsTestingVoice(false);
      }
    } else if (voiceProvider === 'gemini') {
      try {
        const r = await fetch('/api/tts/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voiceName: geminiTtsVoice,
            modelId: geminiTtsModel,
            stylePrompt: geminiTtsStyle || undefined,
            geminiKey: geminiApiKey || undefined,
          }),
        });
        if (!r.ok) {
          let errMsg = `HTTP ${r.status}`;
          try { const e = await r.json(); errMsg = e.error || JSON.stringify(e); } catch { errMsg = await r.text().catch(() => errMsg); }
          throw new Error(errMsg);
        }
        const contentType = r.headers.get('content-type') || '';
        if (!contentType.includes('audio')) {
          const body = await r.text();
          throw new Error(`Expected audio, got: ${body.slice(0, 200)}`);
        }
        const blob = await r.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.onended = () => { setIsTestingVoice(false); URL.revokeObjectURL(audioUrl); };
        audio.onerror = () => {
          setIsTestingVoice(false);
          URL.revokeObjectURL(audioUrl);
          addToast({ title: 'Gemini TTS Error', message: 'Audio could not be played. Check Render logs.', type: 'error' });
        };
        audio.play().catch((e: any) => {
          setIsTestingVoice(false);
          addToast({ title: 'Gemini TTS Error', message: e.message || 'Playback failed.', type: 'error' });
        });
      } catch (error: any) {
        const msg = error.message || 'Gemini TTS failed.';
        console.error('[Gemini TTS test]', msg);
        addToast({ title: 'Gemini TTS Error', message: msg, type: 'error' });
        setIsTestingVoice(false);
      }
    } else {
      speakWithBrowser(text);
    }
  };

  const speakWithBrowser = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const availableVoices = window.speechSynthesis.getVoices();
    
    let selectedVoice: SpeechSynthesisVoice | undefined;
    if (voiceURI) {
        selectedVoice = availableVoices.find(v => v.voiceURI === voiceURI);
    }
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.pitch = voicePitch;
    utterance.rate = voiceSpeed;
    utterance.onend   = () => setIsTestingVoice(false);
    utterance.onerror = () => setIsTestingVoice(false);
    
    window.speechSynthesis.speak(utterance);
    // Safety timeout — if onend never fires (some Android browsers)
    setTimeout(() => setIsTestingVoice(false), 10000);
  };


  // Update local state when active profile changes
  useEffect(() => {
    setName(aiProfile.name);
    setPersonality(aiProfile.personality);
    setBackstory(aiProfile.backstory);
    setAppearance(aiProfile.appearance);
    setVoiceURI(aiProfile.voiceURI || '');
    setVoicePitch(aiProfile.voicePitch || 1.0);
    setVoiceSpeed(aiProfile.voiceSpeed || 1.0);
    setAutoReadMessages(aiProfile.autoReadMessages || false);
    setVoiceDescription(aiProfile.voiceDescription || '');
    setVoiceProvider((aiProfile.voiceProvider === 'elevenlabs') ? 'elevenlabs' : (aiProfile.voiceProvider === 'gemini') ? 'gemini' : 'browser');
    setGeminiTtsVoice(aiProfile.geminiTtsVoice || 'Kore');
    setGeminiTtsModel(aiProfile.geminiTtsModel || 'gemini-3.1-flash-tts-preview');
    setGeminiTtsStyle(aiProfile.geminiTtsStyle || '');
    setResponseLength(aiProfile.responseLength || 'medium');
    setResponseDetail(aiProfile.responseDetail || 'standard');
    setResponseTone(aiProfile.responseTone || 'friendly');
    setCustomParagraphCount(aiProfile.customParagraphCount || null);
    setCustomWordCount(aiProfile.customWordCount || null);
    setBehavioralPatterns(aiProfile.behavioralPatterns || '');
    setGoals(aiProfile.goals || '');
    setCoreValues(aiProfile.coreValues || '');
    setLikes(aiProfile.likes || '');
    setDislikes(aiProfile.dislikes || '');
    setSpeakingStyle(aiProfile.speakingStyle || '');
    setProactiveMessageFrequency(aiProfile.proactiveMessageFrequency || 'off');
    setGoogleToolsEnabled(aiProfile.googleToolsEnabled || false);
    setAiCanUseMotion(aiProfile.aiCanUseMotion || false);
    setAiCanGenerateSpeech(aiProfile.aiCanGenerateSpeech ?? true);
    setTextOnlyMode(aiProfile.textOnlyMode ?? false);
    setElevenLabsModelId(aiProfile.elevenLabsModelId || 'eleven_v3');
    setElStability(aiProfile.elStability     ?? 0.5);
    setElSimilarity(aiProfile.elSimilarity   ?? 0.75);
    setElStyle(aiProfile.elStyle             ?? 0);
    setElSpeakerBoost(aiProfile.elSpeakerBoost ?? true);
    setElSpeakingRate(aiProfile.elSpeakingRate  ?? 1.0);
    setDynamicEmotion(aiProfile.dynamicEmotion  ?? false);
    setMaxTokens(aiProfile.maxTokens ?? 2048);
    setKnowsItsAI(aiProfile.knowsItsAI ?? true);
    setReferenceImage(aiProfile.referenceImage);
    setModel(validateModel(aiProfile.model));
    setLlmProvider(aiProfile.llmProvider === 'gemini' ? 'gemini' : 'claude');
    setTemperature(aiProfile.temperature || 0.7);
    setTimeAwareness(aiProfile.timeAwareness !== undefined ? aiProfile.timeAwareness : true);
    setAmbientModeState(aiProfile.ambientMode ?? false);
    setAmbientFrequencyState(aiProfile.ambientFrequency || 'off');
    setAiInitiatedMessagesEnabled(aiProfile.aiInitiatedMessagesEnabled ?? true);
    setEnvAwarenessEnabled(aiProfile.environmentalAwarenessEnabled || false);
    setEnvStillnessMinutes(aiProfile.envStillnessMinutes ?? 20);
    setEnvStillnessInput(String(aiProfile.envStillnessMinutes ?? 20));
    setEnvMovementResponse(aiProfile.envMovementResponse ?? true);
    setEnvSoundResponse(aiProfile.envSoundResponse ?? false);
    setEnvLightResponse(aiProfile.envLightResponse ?? false);
    setEnvMinGapMinutes(aiProfile.envMinGapMinutes ?? 30);
    setEnvMinGapInput(String(aiProfile.envMinGapMinutes ?? 30));
    setImageStyle(aiProfile.imageStyle || 'none');
    setImageGenerationInstructions(aiProfile.imageGenerationInstructions || []);
  }, [aiProfile]);

  React.useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices.filter(v => v.lang.startsWith('en')));
    };
    
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const handleSave = async () => {
    addToast({ title: "AI Profile", message: "Saving persona settings...", type: "info" });
    await new Promise(resolve => setTimeout(resolve, 500));
    const updatedProfile: AIProfile = {
      id: aiProfile.id,
      name,
      personality,
      behavioralPatterns,
      goals,
      coreValues,
      likes,
      dislikes,
      speakingStyle,
      backstory,
      appearance,
      referenceImage,
      voiceURI,
      voicePitch,
      voiceSpeed,
      autoReadMessages,
      voiceDescription,
      voiceProvider,
      responseLength,
      responseDetail,
      responseTone,
      customParagraphCount,
      customWordCount,
      proactiveMessageFrequency,
      aiInitiatedMessagesEnabled,
      environmentalAwarenessEnabled: envAwarenessEnabled,
      envStillnessMinutes,
      envMovementResponse,
      envSoundResponse,
      envLightResponse,
      envMinGapMinutes,
      knowsItsAI,
      model,
      llmProvider,
      temperature,
      maxTokens,
      timeAwareness,
      ambientMode: ambientModeState,
      ambientFrequency: ambientFrequencyState,
      aiCanGenerateImages: aiProfile.aiCanGenerateImages,
      aiCanUseWebSearch,
      aiCanUseWeather,
      aiCanUseCalendar,
      aiCanUseYouTube: aiProfile.aiCanUseYouTube,
      aiCanUseGoogleMaps,
      googleToolsEnabled,
      aiCanUseMotion,
      imageStyle,
      imageGenerationInstructions,
      aiCanGenerateSpeech,
      textOnlyMode,
      elevenLabsModelId,
      elStability,
      elSimilarity,
      elStyle,
      elSpeakerBoost,
      elSpeakingRate,
      dynamicEmotion,
      asyncVoiceId: elevenLabsVoiceId || aiProfile.asyncVoiceId,
      geminiTtsVoice,
      geminiTtsModel,
      geminiTtsStyle,
      aiCanUseTools: aiProfile.aiCanUseTools,
      aiCanBrowse: aiProfile.aiCanBrowse,
      chatHistory: aiProfile.chatHistory,
      memories: aiProfile.memories,
      journal: aiProfile.journal,
    };
    savePersona(updatedProfile, chatHistory, sessions, activeSessionId);
    addToast({ title: "Persona Saved", message: "AI Persona settings saved successfully!", type: "success" });
  };

  const handleSaveAsNew = async () => {
    const newId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newProfile: AIProfile = {
      id: newId,
      name: `${name} (Copy)`,
      personality,
      behavioralPatterns,
      goals,
      coreValues,
      likes,
      dislikes,
      speakingStyle,
      backstory,
      appearance,
      referenceImage,
      voiceURI,
      voicePitch,
      voiceSpeed,
      autoReadMessages,
      voiceDescription,
      voiceProvider,
      responseLength,
      responseDetail,
      responseTone,
      customParagraphCount,
      customWordCount,
      proactiveMessageFrequency: proactiveMessageFrequency,
      aiInitiatedMessagesEnabled,
      environmentalAwarenessEnabled: envAwarenessEnabled,
      envStillnessMinutes,
      envMovementResponse,
      envSoundResponse,
      envLightResponse,
      envMinGapMinutes,
      knowsItsAI,
      model: aiProfile.model,
      llmProvider,
      temperature: aiProfile.temperature,
      timeAwareness,
      ambientMode: ambientModeState,
      ambientFrequency: ambientFrequencyState,
      aiCanGenerateImages: aiProfile.aiCanGenerateImages,
      aiCanUseWebSearch,
      aiCanUseWeather,
      aiCanUseCalendar,
      aiCanUseYouTube: aiProfile.aiCanUseYouTube,
      aiCanUseGoogleMaps,
      googleToolsEnabled,
      aiCanUseMotion,
      imageStyle,
      imageGenerationInstructions,
      aiCanGenerateSpeech,
      textOnlyMode,
      elevenLabsModelId,
      asyncVoiceId: elevenLabsVoiceId || aiProfile.asyncVoiceId,
      geminiTtsVoice,
      geminiTtsModel,
      geminiTtsStyle,
      elStability,
      elSimilarity,
      elStyle,
      elSpeakerBoost,
      elSpeakingRate,
      dynamicEmotion,
      aiCanUseTools: aiProfile.aiCanUseTools,
      aiCanBrowse: aiProfile.aiCanBrowse,
      chatHistory: [], // New persona starts with fresh history
      memories: [],
      journal: [],
    };
    savePersona(newProfile, [], [], null);
    loadPersona(newId, [], [], null, setChatHistory, setSessions, setActiveSessionId); // Switch to new persona
    alert('New AI Persona created!');
  };

  const handleDelete = () => {
    if (savedPersonas.length <= 1) {
        alert("Cannot delete the last persona.");
        return;
    }
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
        deletePersona(aiProfile.id);
    }
  };

  const handleCreateNew = () => {
    const newId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newProfile: AIProfile = {
        id: newId,
        name: 'New Persona',
        personality: '',
        backstory: '',
        appearance: '',
        referenceImage: null,
        voiceURI: null,
        voicePitch: 1.0,
        voiceSpeed: 1.0,
        autoReadMessages: false,
        voiceDescription: '',
        voiceProvider: 'browser',
        responseLength: 'medium',
        responseDetail: 'medium',
        responseTone: 'friendly',
        customParagraphCount: null,
        customWordCount: null,
        proactiveMessageFrequency: 'off',
        proactiveEmailFrequency: 'off',
        proactiveBlogFrequency: 'off',
        knowsItsAI: true,
        model: 'claude-sonnet-5',
        temperature: 0.7,
        timeAwareness: true,
        ambientMode: false,
        ambientFrequency: 'off',
        aiCanGenerateImages: false,
        aiCanGenerateSpeech: false,
        aiCanUseTools: false,
        aiCanUseWebSearch: false,
        aiCanUseWeather: false,
        aiCanUseCalendar: false,
        aiCanUseYouTube: false,
        aiCanUseGoogleMaps: false,
        googleToolsEnabled: false,
        aiInitiatedMessagesEnabled: true,
        aiCanUseMotion: false,
        aiCanBrowse: false,
        chatHistory: [],
        memories: [],
        journal: [],
    };
    savePersona(newProfile, [], [], null);
    loadPersona(newId, [], [], null, setChatHistory, setSessions, setActiveSessionId);
  };

  const handlePreviewSend = useCallback(async () => {
    if (!previewInput.trim() || isPreviewLoading) return;

    addToast({ title: "Preview Chat", message: "Indigo is thinking...", type: "info" });
    await new Promise(resolve => setTimeout(resolve, 500));

    const userMsg = { role: 'user' as const, content: previewInput };
    setPreviewMessages(prev => [...prev, userMsg]);
    setPreviewInput('');
    setIsPreviewLoading(true);

    try {
        const previewProfile = {
          ...aiProfile,
          name, personality, backstory, appearance, responseLength,
          customParagraphCount, model, llmProvider, temperature,
          knowsItsAI,
        };
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...previewMessages, userMsg].map(m => ({
              role: m.role, content: m.content
            })),
            aiProfile: previewProfile,
            userProfile: { name: 'User', email: '', info: '', preferences: '', appearance: '', referenceImage: null },
            anthropicKey: anthropicApiKey || undefined,
            geminiKey: geminiApiKey || undefined,
            openrouterKey: openrouterApiKey || undefined,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed');
        const data = await res.json();
        const responseText = data.content || '';
        setPreviewMessages(prev => [...prev, { role: 'model', content: responseText }]);
    } catch (error) {
        console.error("Preview chat error", error);
        setPreviewMessages(prev => [...prev, { role: 'model', content: "Error: Failed to generate response. Check your API key in Settings." }]);
    } finally {
        setIsPreviewLoading(false);
    }
  }, [previewInput, isPreviewLoading, anthropicApiKey, geminiApiKey, openrouterApiKey, name, personality, backstory, appearance, responseLength, customParagraphCount, model, llmProvider, temperature, previewMessages, knowsItsAI, aiProfile]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Resize image to avoid localStorage quota limits
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 512;
            const MAX_HEIGHT = 512;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            
            const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setReferenceImage(resizedDataUrl);
        };
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleExportPersona = useCallback((persona: AIProfile) => {
    try {
      const dataStr = JSON.stringify(persona, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.download = `${persona.name.replace(/\s+/g, '_')}_persona.json`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 100);
    } catch (err) {
      console.error('Persona export failed:', err);
      alert('Failed to export persona.');
    }
  }, []);

  const handleExport = useCallback(() => {
    try {
      // Create a complete profile object for export including current form state and chat data
      const exportProfile: AIProfile = {
        ...aiProfile,
        name,
        personality,
        backstory,
        appearance,
        referenceImage,
        voiceURI,
        voicePitch,
        voiceSpeed,
        autoReadMessages,
        voiceDescription,
        voiceProvider,
        asyncVoiceId: elevenLabsVoiceId || aiProfile.asyncVoiceId,
      geminiTtsVoice,
      geminiTtsModel,
      geminiTtsStyle,
        elevenLabsModelId,
        elStability,
        elSimilarity,
        elStyle,
        elSpeakerBoost,
        elSpeakingRate,
        dynamicEmotion,
        responseLength,
        responseDetail,
        responseTone,
        customParagraphCount,
        customWordCount,
        proactiveMessageFrequency,
        knowsItsAI,
        model,
        llmProvider,
        temperature,
            timeAwareness,
        ambientMode: ambientModeState,
        ambientFrequency: ambientFrequencyState,
        aiCanGenerateImages: aiProfile.aiCanGenerateImages,
        imageStyle,
        // Include chat data for this persona
        chatHistory,
        sessions,
        activeSessionId
      };
      
      const dataStr = JSON.stringify(exportProfile, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.download = `${aiProfile.name.replace(/\s+/g, '_')}_persona.json`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error("Persona export failed:", error);
      alert("Failed to export persona.");
    }
  }, [aiProfile]);

  const doImport = useCallback((persona: AIProfile, replace: boolean) => {
    // If replacing, keep the original ID so it overwrites the existing entry.
    // If creating new, generate a fresh ID.
    const finalPersona = replace
      ? persona
      : { ...persona, id: Date.now().toString() + Math.random().toString(36).substr(2, 9) };
    savePersona(finalPersona, finalPersona.chatHistory || [], finalPersona.sessions || [], finalPersona.activeSessionId || null);
    loadPersona(finalPersona.id, finalPersona.chatHistory || [], finalPersona.sessions || [], finalPersona.activeSessionId || null, setChatHistory, setSessions, setActiveSessionId);
    setPendingImport(null);
    addToast({ title: 'Persona imported', message: `${finalPersona.name} is now active.`, type: 'success' });
  }, [savePersona, loadPersona, setChatHistory, setSessions, setActiveSessionId, addToast]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-selected later
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.name || !json.personality) {
          addToast({ title: 'Invalid file', message: 'This file does not look like a valid persona export.', type: 'error' });
          return;
        }
        const parsed = json as AIProfile;
        // Check if the ID already exists in savedPersonas
        const existing = savedPersonas.find(p => p.id === parsed.id);
        if (existing) {
          // Ask the user before overwriting
          setPendingImport({ persona: parsed, existingName: existing.name });
        } else {
          // New persona — import directly
          doImport(parsed, false);
        }
      } catch (err) {
        console.error('Error importing persona', err);
        addToast({ title: 'Import failed', message: 'Could not read the persona file.', type: 'error' });
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  }, [savePersona, loadPersona]);

  const [isLoadingLibraryVoices, setIsLoadingLibraryVoices] = useState(false);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<any[]>([]);
  // Gemini TTS state
  const [geminiTtsVoice, setGeminiTtsVoice] = useState<string>(aiProfile.geminiTtsVoice || 'Kore');
  const [geminiTtsModel, setGeminiTtsModel] = useState<string>(aiProfile.geminiTtsModel || 'gemini-3.1-flash-tts-preview');
  const [geminiTtsStyle, setGeminiTtsStyle] = useState<string>(aiProfile.geminiTtsStyle || '');
  const [isLoadingElevenLabsVoices, setIsLoadingElevenLabsVoices] = useState(false);
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState<string>(aiProfile.asyncVoiceId || '');
  const [elevenLabsModelId, setElevenLabsModelId] = useState<string>('eleven_v3');
  const [elSearchFilter, setElSearchFilter] = useState('');
  const [elCategoryFilter, setElCategoryFilter] = useState('');
  const [elVoiceTypeFilter, setElVoiceTypeFilter] = useState('');
  const [elSort, setElSort] = useState<'name' | 'created_at_unix'>('name');
  const [elSortDir, setElSortDir] = useState<'asc' | 'desc'>('asc');
  const [elLangFilter, setElLangFilter] = useState('');
  const [elAccentFilter, setElAccentFilter] = useState('');
  const [elGenderFilter, setElGenderFilter] = useState('');
  const [elAgeFilter, setElAgeFilter] = useState('');
  const [dynamicEmotion, setDynamicEmotion]     = useState<boolean>(aiProfile.dynamicEmotion  ?? false);

  // ElevenLabs voice quality settings
  const [elStability,      setElStability]      = useState<number>(aiProfile.elStability      ?? 0.5);
  const [elSimilarity,     setElSimilarity]     = useState<number>(aiProfile.elSimilarity     ?? 0.75);
  const [elStyle,          setElStyle]          = useState<number>(aiProfile.elStyle           ?? 0);
  const [elSpeakerBoost,   setElSpeakerBoost]   = useState<boolean>(aiProfile.elSpeakerBoost  ?? true);
  const [elSpeakingRate,   setElSpeakingRate]   = useState<number>(aiProfile.elSpeakingRate   ?? 1.0);

  // LLM max tokens
  const [maxTokens, setMaxTokens] = useState<number>(aiProfile.maxTokens ?? 2048);

  const fetchElevenLabsVoices = useCallback(async () => {
    if (!elevenLabsApiKey) return;
    setIsLoadingElevenLabsVoices(true);
    try {
      let voices = await listElevenLabsVoices(elevenLabsApiKey, {
        search: elSearchFilter || undefined,
        sort: elSort,
        sort_direction: elSortDir,
        voice_type: elVoiceTypeFilter as any || undefined,
        category: elCategoryFilter as any || undefined,
      });
      // Apply label filters client-side — ElevenLabs v1 returns labels as a free-form object
      if (elLangFilter)   voices = voices.filter((v: any) => v.labels?.language?.toLowerCase().includes(elLangFilter.toLowerCase()));
      if (elAccentFilter) voices = voices.filter((v: any) => v.labels?.accent?.toLowerCase().includes(elAccentFilter.toLowerCase()));
      if (elGenderFilter) voices = voices.filter((v: any) => v.labels?.gender?.toLowerCase() === elGenderFilter.toLowerCase());
      if (elAgeFilter)    voices = voices.filter((v: any) => v.labels?.age?.toLowerCase().includes(elAgeFilter.toLowerCase()));
      setElevenLabsVoices(voices);
    } catch (error: any) {
      addToast({ title: "ElevenLabs Error", message: error.message || "Failed to load voices.", type: "error" });
    } finally {
      setIsLoadingElevenLabsVoices(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elevenLabsApiKey, elSearchFilter, elCategoryFilter, elVoiceTypeFilter, elSort, elSortDir, elLangFilter, elAccentFilter, elGenderFilter, elAgeFilter]);

  useEffect(() => {
    if (voiceProvider === 'elevenlabs' && elevenLabsApiKey) {
      fetchElevenLabsVoices();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceProvider, elevenLabsApiKey, elSearchFilter, elCategoryFilter, elVoiceTypeFilter, elSort, elSortDir, elLangFilter, elAccentFilter, elGenderFilter, elAgeFilter]);

  return (
    <div className="flex flex-col lg:flex-row h-full w-full mx-auto bg-transparent transition-colors duration-500 overflow-y-auto lg:overflow-hidden p-4 sm:p-6 gap-4 sm:gap-6">
      {/* Sidebar - Persona List */}
      <div className="w-full lg:w-1/3 h-auto lg:h-full bg-indigo-100 dark:bg-indigo-900 rounded-lg shadow-md flex flex-col mb-4 lg:mb-0 border border-indigo-200 dark:border-indigo-800 flex-shrink-0 overflow-hidden">
        <div className="p-4 border-b border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-800 flex justify-between items-center">
            <h3 className="font-bold text-indigo-700 dark:text-indigo-200 flex items-center">
                <Users className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                Personas
            </h3>
            <div className="flex space-x-1">
                <label className="p-1 bg-indigo-200 dark:bg-indigo-700 text-indigo-700 dark:text-indigo-200 rounded hover:bg-indigo-300 dark:hover:bg-indigo-600 transition-colors cursor-pointer" title="Import Persona">
                    <Upload className="w-4 h-4" />
                    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                </label>
                <button 
                    onClick={() => {
                      const p = savedPersonas.find(p => p.id === selectedPersonaId);
                      if (p) handleExportPersona(p);
                    }}
                    className="p-1 bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-200 dark:hover:bg-indigo-700 transition-colors"
                    title="Export selected persona"
                >
                    <Download className="w-4 h-4" />
                </button>
                <button 
                    onClick={handleCreateNew}
                    className="p-1 bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-200 dark:hover:bg-indigo-700 transition-colors"
                    title="Create New Persona"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
        </div>
        <div className="flex-1 lg:overflow-y-auto p-2 space-y-2 h-auto lg:h-full">
            {savedPersonas.map(persona => (
                <div 
                    key={persona.id}
                    onClick={() => { setSelectedPersonaId(persona.id); loadPersona(persona.id, chatHistory, sessions, activeSessionId, setChatHistory, setSessions, setActiveSessionId); }}
                    className={`p-3 rounded-lg cursor-pointer flex items-center space-x-3 transition-colors ${
                        selectedPersonaId === persona.id 
                        ? 'bg-indigo-50 dark:bg-indigo-800 border border-indigo-200 dark:border-indigo-700' 
                        : 'hover:bg-indigo-50 dark:hover:bg-indigo-800/50 border border-transparent'
                    }`}
                >
                    <button
                        onClick={(e) => { e.stopPropagation(); handleExportPersona(persona); }}
                        className="p-1 text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors flex-shrink-0"
                        title={`Export ${persona.name}`}
                    >
                        <Download className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-10 h-10 rounded-full bg-indigo-200 dark:bg-indigo-700 overflow-hidden flex-shrink-0">
                        {persona.referenceImage ? (
                            <img src={persona.referenceImage} alt={persona.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-indigo-400 dark:text-indigo-500 font-bold text-xs">
                                {persona.name.substring(0, 2).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className={`font-medium truncate ${aiProfile.id === persona.id ? 'text-indigo-700 dark:text-indigo-200' : 'text-indigo-900 dark:text-indigo-100'}`}>
                            {persona.name}
                        </h4>
                        <p className="text-xs text-indigo-500 dark:text-indigo-400 truncate">{persona.personality || 'No personality defined'}</p>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Main Content - Edit Form */}
      <div className="flex-1 h-auto lg:h-full bg-white dark:bg-indigo-950 rounded-lg shadow-md overflow-visible lg:overflow-y-auto border border-indigo-200 dark:border-indigo-800">
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-6 text-indigo-600 dark:text-indigo-400">Edit Persona: {name}</h2>
            <p className="text-sm text-indigo-500 dark:text-indigo-400 mb-6">Persona ID: {aiProfile.id}</p>
            
            <div className="space-y-6">
                {/* Reference Image */}
                <div className="flex flex-col items-center justify-center mb-6">
                <div className="w-32 h-32 rounded-full bg-indigo-50 dark:bg-indigo-900 overflow-hidden mb-2 border-4 border-indigo-100 dark:border-indigo-800 relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    {referenceImage ? (
                    <img src={referenceImage} alt="AI Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                    <div className="w-full h-full flex items-center justify-center text-indigo-400 dark:text-indigo-500">
                        <Upload className="w-8 h-8" />
                    </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs font-medium uppercase tracking-wider">Change</span>
                    </div>
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    accept="image/*" 
                    className="hidden" 
                />
                <p className="text-sm text-indigo-500 dark:text-indigo-400">Upload Reference Image</p>
                </div>

                <div>
                <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Name</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                </div>

                <div>
                <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Personality Traits</label>
                <textarea
                    value={personality}
                    onChange={(e) => setPersonality(e.target.value)}
                    rows={3}
                    className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., Witty, sarcastic, observant, empathetic..."
                />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Behavioral Patterns</label>
                        <textarea
                            value={behavioralPatterns}
                            onChange={(e) => setBehavioralPatterns(e.target.value)}
                            rows={3}
                            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="How does the AI react to specific situations?"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Goals & Aspirations</label>
                        <textarea
                            value={goals}
                            onChange={(e) => setGoals(e.target.value)}
                            rows={3}
                            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="What does the AI want to achieve?"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Core Values</label>
                        <textarea
                            value={coreValues}
                            onChange={(e) => setCoreValues(e.target.value)}
                            rows={2}
                            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="What does the AI stand for?"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Speaking Style</label>
                        <textarea
                            value={speakingStyle}
                            onChange={(e) => setSpeakingStyle(e.target.value)}
                            rows={2}
                            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Tone, vocabulary, sentence structure..."
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Likes</label>
                        <textarea
                            value={likes}
                            onChange={(e) => setLikes(e.target.value)}
                            rows={2}
                            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Things the AI enjoys..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Dislikes</label>
                        <textarea
                            value={dislikes}
                            onChange={(e) => setDislikes(e.target.value)}
                            rows={2}
                            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Things the AI avoids..."
                        />
                    </div>
                </div>

                <div>
                <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Backstory</label>
                <textarea
                    value={backstory}
                    onChange={(e) => setBackstory(e.target.value)}
                    rows={3}
                    className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Where does this AI come from?"
                />
                </div>

                <div>
                <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Physical Appearance</label>
                <textarea
                    value={appearance}
                    onChange={(e) => setAppearance(e.target.value)}
                    rows={2}
                    className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Describe how the AI looks..."
                />
                </div>

                {/* Advanced Model Settings */}

                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Response Detail</label>
                        <select
                            value={responseDetail}
                            onChange={(e) => setResponseDetail(e.target.value as AIProfile['responseDetail'])}
                            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="Concise">Concise</option>
                            <option value="standard">Standard</option>
                            <option value="Detailed">Detailed</option>
                            <option value="Verbose">Verbose</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Response Tone</label>
                        <select
                            value={responseTone}
                            onChange={(e) => setResponseTone(e.target.value as AIProfile['responseTone'])}
                            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="friendly">Friendly</option>
                            <option value="Serious">Serious</option>
                            <option value="Humorous">Humorous</option>
                            <option value="Professional">Professional</option>
                            <option value="Flirty">Flirty</option>
                            <option value="Empathetic">Empathetic</option>
                            <option value="Sarcastic">Sarcastic</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Custom Paragraph Count</label>
                        <input
                            type="number"
                            min="1"
                            max="20"
                            value={customParagraphCount ?? ''}
                            onChange={(e) => setCustomParagraphCount(e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g., 3 (overrides Response Length)"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Custom Word Count</label>
                        <input
                            type="number"
                            min="10"
                            max="500"
                            value={customWordCount ?? ''}
                            onChange={(e) => setCustomWordCount(e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g., 150 (overrides Response Length)"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Response Length</label>
                        <select
                            value={responseLength}
                            onChange={(e) => setResponseLength(e.target.value as AIProfile['responseLength'])}
                            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="short">Short</option>
                            <option value="medium">Medium</option>
                            <option value="long">Long</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>
                    <div>
                    </div>
                </div>

                <div className="border-t border-indigo-100 dark:border-indigo-800 pt-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">AI-Initiated Messages</h3>
                            <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">Master switch — turn off to silence all unprompted messages without changing your settings.</p>
                        </div>
                        <button onClick={() => setAiInitiatedMessagesEnabled(!aiInitiatedMessagesEnabled)} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${aiInitiatedMessagesEnabled ? 'bg-indigo-600' : 'bg-red-400'}`}>
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${aiInitiatedMessagesEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </div>

                <div className="border-t border-indigo-100 dark:border-indigo-800 pt-4">
                    <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-3">Environmental Awareness</h3>
                    <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-4">The AI notices changes in your environment and reaches out naturally — when you've been still a while, when you start moving, or when the light or sound around you shifts.</p>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Enable Environmental Awareness</label>
                                <span className="block text-xs text-indigo-500 dark:text-indigo-400">Requires Motion Context toggle to be on.</span>
                            </div>
                            <button onClick={() => setEnvAwarenessEnabled(!envAwarenessEnabled)} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${envAwarenessEnabled ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${envAwarenessEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        {envAwarenessEnabled && (
                            <div className="space-y-3 pl-1">
                                <div>
                                    <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Check in after stillness of (minutes)</label>
                                    <input type="number" min="5" max="120" value={envStillnessInput}
                                        onChange={(e) => setEnvStillnessInput(e.target.value)}
                                        onBlur={(e) => {
                                          const v = Math.max(5, Math.min(120, parseInt(e.target.value) || 20));
                                          setEnvStillnessMinutes(v);
                                          setEnvStillnessInput(String(v));
                                        }}
                                        className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Minimum gap between messages (minutes)</label>
                                    <input type="number" min="5" max="180" value={envMinGapInput}
                                        onChange={(e) => setEnvMinGapInput(e.target.value)}
                                        onBlur={(e) => {
                                          const v = Math.max(5, Math.min(180, parseInt(e.target.value) || 30));
                                          setEnvMinGapMinutes(v);
                                          setEnvMinGapInput(String(v));
                                        }}
                                        className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-indigo-700 dark:text-indigo-300">React when movement starts</label>
                                    <button onClick={() => setEnvMovementResponse(!envMovementResponse)} className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${envMovementResponse ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${envMovementResponse ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-indigo-700 dark:text-indigo-300">React to sound changes</label>
                                    <button onClick={() => setEnvSoundResponse(!envSoundResponse)} className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${envSoundResponse ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${envSoundResponse ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-indigo-700 dark:text-indigo-300">React to light changes</label>
                                    <button onClick={() => setEnvLightResponse(!envLightResponse)} className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${envLightResponse ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${envLightResponse ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {aiProfile.aiCanGenerateImages && (
                            <div className="mt-3 space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Image Generation Style</label>
                                    <select
                                        value={imageStyle}
                                        onChange={(e) => setImageStyle(e.target.value)}
                                        className="w-full p-2 text-sm border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="none">None</option>
                                        <option value="photograph">Photograph</option>
                                        <option value="anime">Anime</option>
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Image Generation Instructions</label>
                                    <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-2">These instructions will ALWAYS be followed by the AI when generating images.</p>
                                    <div className="space-y-2">
                                        {imageGenerationInstructions.map((instruction, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={instruction}
                                                    onChange={(e) => {
                                                        const newInstructions = [...imageGenerationInstructions];
                                                        newInstructions[index] = e.target.value;
                                                        setImageGenerationInstructions(newInstructions);
                                                    }}
                                                    className="flex-1 p-2 text-sm border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-indigo-400 dark:placeholder-indigo-600"
                                                    placeholder="e.g., Always make the lighting cinematic"
                                                />
                                                <button
                                                    onClick={() => {
                                                        const newInstructions = imageGenerationInstructions.filter((_, i) => i !== index);
                                                        setImageGenerationInstructions(newInstructions);
                                                    }}
                                                    className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                                    title="Remove instruction"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                        <div className="flex items-center gap-4 mt-2">
                                            <button
                                                onClick={() => setImageGenerationInstructions([...imageGenerationInstructions, ''])}
                                                className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                                            >
                                                <Plus size={16} /> Add Instruction
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const defaults = [
                                                        "If a character reference image is provided, you MUST use it as the absolute source of truth.",
                                                        "COPY the face, body type, skin tone, hair color, and all physical features EXACTLY from the reference image.",
                                                        "You are ONLY permitted to modify the pose, clothing, facial expression, and eye position.",
                                                        "DO NOT alter the body type (muscularity, bust size, etc.) or facial structure in any way.",
                                                        "If the prompt or description contradicts the reference image, the reference image ALWAYS takes precedence.",
                                                    ];
                                                    setImageGenerationInstructions([...imageGenerationInstructions, ...defaults.filter(d => !imageGenerationInstructions.includes(d))]);
                                                }}
                                                className="text-sm text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                                            >
                                                Restore Defaults
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Advanced Model Settings */}
                <div className="border-t border-indigo-100 dark:border-indigo-800 pt-4">
                    <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-3">Advanced Model Settings</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Knows it's an AI</label>
                            <button
                                onClick={() => setKnowsItsAI(!knowsItsAI)}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${knowsItsAI ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${knowsItsAI ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Time Awareness</label>
                                <span className="block text-xs text-indigo-500 dark:text-indigo-400">AI knows the current date and time (timezone set in Settings)</span>
                            </div>
                            <button
                                onClick={() => setTimeAwareness(!timeAwareness)}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${timeAwareness ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${timeAwareness ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                            <div>
                                <label className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Image Generation</label>
                                <span className="block text-xs text-indigo-500 dark:text-indigo-400">Enable the image generation screen and allow the AI to generate images.</span>
                            </div>
                            <button onClick={() => setAIProfile({ ...aiProfile, aiCanGenerateImages: !aiProfile.aiCanGenerateImages })} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${aiProfile.aiCanGenerateImages ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${aiProfile.aiCanGenerateImages ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                            <div>
                                <label className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Web Search Data</label>
                                <span className="block text-xs text-indigo-500 dark:text-indigo-400">Allow AI to search the web for real-time information.</span>
                            </div>
                            <button onClick={() => setAiCanUseWebSearch(!aiCanUseWebSearch)} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${aiCanUseWebSearch ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${aiCanUseWebSearch ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Weather Context</label>
                                <span className="block text-xs text-indigo-500 dark:text-indigo-400">Provide AI with your local current weather conditions.</span>
                            </div>
                            <button onClick={() => setAiCanUseWeather(!aiCanUseWeather)} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${aiCanUseWeather ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${aiCanUseWeather ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Google Calendar</label>
                                <span className="block text-xs text-indigo-500 dark:text-indigo-400">Enable Google Calendar integration feature.</span>
                            </div>
                            <button onClick={() => setAiCanUseCalendar(!aiCanUseCalendar)} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${aiCanUseCalendar ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${aiCanUseCalendar ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Google Tools</label>
                                <span className="block text-xs text-indigo-500 dark:text-indigo-400">Enable Gemini web search even when Claude is the chat model.</span>
                            </div>
                            <button onClick={() => setGoogleToolsEnabled(!googleToolsEnabled)} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${googleToolsEnabled ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${googleToolsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Nearby Places</label>
                                <span className="block text-xs text-indigo-500 dark:text-indigo-400">Share what's around your location so the AI is aware of your surroundings.</span>
                            </div>
                            <button onClick={() => setAiCanUseGoogleMaps(!aiCanUseGoogleMaps)} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${aiCanUseGoogleMaps ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${aiCanUseGoogleMaps ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Motion Context</label>
                                <span className="block text-xs text-indigo-500 dark:text-indigo-400">Share device motion and orientation so the AI knows if you're walking, stationary, etc.</span>
                            </div>
                            <button onClick={handleMotionToggle} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${aiCanUseMotion ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${aiCanUseMotion ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* Provider selector */}
                        <div>
                            <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">AI Provider</label>
                            <select
                                value={llmProvider}
                                onChange={(e) => {
                                  const p = e.target.value as 'claude' | 'gemini' | 'openrouter';
                                  setLlmProvider(p);
                                  // Reset model to a sensible default for the new provider
                                  if (p === 'claude') setModel('claude-sonnet-5');
                                  else if (p === 'gemini') setModel('gemini-3.5-flash');
                                  else if (p === 'openrouter') setModel('');
                                }}
                                className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="claude">Anthropic Claude</option>
                                <option value="gemini">Google Gemini</option>
                                <option value="openrouter">OpenRouter</option>
                            </select>
                        </div>

                        {/* Model selector — changes based on provider */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300">AI Model</label>
                                <button
                                    type="button"
                                    onClick={refreshModelLists}
                                    disabled={isRefreshingModels}
                                    className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 disabled:opacity-50 flex items-center gap-1"
                                    title="Fetch the latest models directly from Anthropic/Google/OpenRouter"
                                >
                                    {isRefreshingModels ? 'Refreshing…' : '↻ Refresh list'}
                                </button>
                            </div>

                            {llmProvider === 'claude' && (
                                <select
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    {claudeModelOptions.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            )}

                            {llmProvider === 'gemini' && (
                                <select
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    {geminiModelOptions.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            )}

                            {llmProvider === 'openrouter' && (
                                <div>
                                    {selectedOpenRouterModel ? (
                                        <div className="flex items-center justify-between p-2 mb-2 rounded-md bg-indigo-50 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-700">
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-indigo-900 dark:text-indigo-100 truncate">{selectedOpenRouterModel.name}</div>
                                                <div className="text-[11px] text-indigo-400 dark:text-indigo-500 truncate">{selectedOpenRouterModel.id}</div>
                                            </div>
                                            <button type="button" onClick={() => setModel('')} className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 flex-shrink-0 ml-2">Change</button>
                                        </div>
                                    ) : model ? (
                                        <div className="flex items-center justify-between p-2 mb-2 rounded-md bg-indigo-50 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-700">
                                            <div className="text-sm font-medium text-indigo-900 dark:text-indigo-100 truncate">{model}</div>
                                            <button type="button" onClick={() => setModel('')} className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 flex-shrink-0 ml-2">Change</button>
                                        </div>
                                    ) : null}

                                    {!model && (
                                        <>
                                            <input
                                                type="text"
                                                value={openRouterSearch}
                                                onChange={(e) => setOpenRouterSearch(e.target.value)}
                                                placeholder={openRouterModelOptions.length > 0 ? `Search ${openRouterModelOptions.length}+ models… e.g. gpt, llama, deepseek` : 'Loading catalog…'}
                                                className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-1"
                                            />
                                            <div className="max-h-56 overflow-y-auto border border-indigo-200 dark:border-indigo-700 rounded-md divide-y divide-indigo-100 dark:divide-indigo-800">
                                                {filteredOpenRouterModels.length === 0 && (
                                                    <div className="p-3 text-xs text-indigo-400 dark:text-indigo-500 text-center">
                                                        {openRouterModelOptions.length === 0 ? 'Catalog not loaded yet — tap "Refresh list" above.' : 'No matches.'}
                                                    </div>
                                                )}
                                                {filteredOpenRouterModels.map(m => (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() => { setModel(m.id); setOpenRouterSearch(''); }}
                                                        className="w-full text-left p-2 hover:bg-indigo-50 dark:hover:bg-indigo-800 transition-colors"
                                                    >
                                                        <div className="text-sm text-indigo-900 dark:text-indigo-100 truncate">{m.name}</div>
                                                        <div className="text-[11px] text-indigo-400 dark:text-indigo-500 truncate">{m.id}{m.contextLength ? ` · ${(m.contextLength / 1000).toFixed(0)}K context` : ''}</div>
                                                    </button>
                                                ))}
                                            </div>
                                            {openRouterModelOptions.length > 0 && filteredOpenRouterModels.length === 40 && (
                                                <p className="text-[11px] text-indigo-400 dark:text-indigo-500 mt-1">Showing first 40 matches — keep typing to narrow it down.</p>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                            <p className="text-[11px] text-indigo-400 dark:text-indigo-500 mt-1">
                                {liveClaudeModels || liveGeminiModels || liveOpenRouterModels
                                    ? "Showing the current model list from your provider."
                                    : "Showing a built-in default list — add an API key above to load the current list automatically."}
                            </p>

                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                            <div>
                                <div className="flex items-center mb-1">
                                    <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300">Temperature: {temperature}</label>
                                    <div className="relative group ml-1" tabIndex={0}>
                                        <HelpCircle className="w-3 h-3 text-indigo-400 dark:text-indigo-500 cursor-help" />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-indigo-800 dark:bg-indigo-700 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 focus:opacity-100 group-focus:opacity-100 transition-opacity pointer-events-none z-50">
                                            Controls randomness. Lower values make responses more predictable and focused, while higher values make them more creative and varied.
                                        </div>
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="0.1"
                                    value={temperature}
                                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                    className="w-full h-2 bg-indigo-200 dark:bg-indigo-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <div className="flex justify-between text-[10px] text-indigo-400 dark:text-indigo-500 mt-1">
                                    <span>Precise</span>
                                    <span>Creative</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Max Tokens: {maxTokens}</label>
                                <input
                                    type="range"
                                    min="256"
                                    max="8192"
                                    step="256"
                                    value={maxTokens}
                                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                                    className="w-full h-2 bg-indigo-200 dark:bg-indigo-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    data-testid="max-tokens-slider"
                                />
                                <div className="flex justify-between text-[10px] text-indigo-400 dark:text-indigo-500 mt-1">
                                    <span>Short (256)</span>
                                    <span>Long (8192)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-indigo-100 dark:border-indigo-800 pt-6 mt-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-indigo-900 dark:text-indigo-100">Voice Settings</h3>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center justify-between gap-3">
                                <label className="text-sm text-indigo-900 dark:text-indigo-100">Enable Speech</label>
                                <button
                                    onClick={() => setAiCanGenerateSpeech(!aiCanGenerateSpeech)}
                                    className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${aiCanGenerateSpeech ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${aiCanGenerateSpeech ? 'translate-x-2' : '-translate-x-2'}`} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <label className="text-sm text-indigo-900 dark:text-indigo-100">Auto-read</label>
                                <button
                                    onClick={() => setAutoReadMessages(!autoReadMessages)}
                                    className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${autoReadMessages ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${autoReadMessages ? 'translate-x-2' : '-translate-x-2'}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Text-only mode toggle — always visible, not inside the TTS block */}
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <label className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Text-Only Mode</label>
                            <span className="block text-xs text-indigo-500 dark:text-indigo-400">No asterisk actions — uses [action] format instead, which works better with ElevenLabs v3</span>
                        </div>
                        <button
                            onClick={() => setTextOnlyMode(!textOnlyMode)}
                            className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${textOnlyMode ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-auto ${textOnlyMode ? 'translate-x-2' : '-translate-x-2'}`} />
                        </button>
                    </div>
                    
                    {aiCanGenerateSpeech && (
                        <>
                            <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2">Voice Engine</label>
                                <div className="flex p-1 bg-indigo-50 dark:bg-indigo-900/50 rounded-xl border border-indigo-100 dark:border-indigo-800">
                                    <button 
                                        onClick={() => {
                                            setVoiceProvider('browser');
                                            setAIProfile({ ...aiProfile, voiceProvider: 'browser', aiCanGenerateSpeech: aiCanGenerateSpeech });
                                        }}
                                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center ${voiceProvider === 'browser' ? 'bg-white dark:bg-indigo-800 text-indigo-600 dark:text-indigo-100 shadow-sm' : 'text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300'}`}
                                    >
                                        <Volume2 className="w-3 h-3 mr-1" />
                                        Browser
                                    </button>
                                    <button
                                        onClick={() => {
                                            setVoiceProvider('elevenlabs');
                                            setAIProfile({ ...aiProfile, voiceProvider: 'elevenlabs', aiCanGenerateSpeech: aiCanGenerateSpeech });
                                            if (elevenLabsVoices.length === 0) fetchElevenLabsVoices();
                                        }}
                                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center ${voiceProvider === 'elevenlabs' ? 'bg-white dark:bg-indigo-800 text-indigo-600 dark:text-indigo-100 shadow-sm' : 'text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300'}`}
                                    >
                                        <Headphones className="w-3 h-3 mr-1" />
                                        ElevenLabs
                                    </button>
                                    <button
                                        onClick={() => {
                                            setVoiceProvider('gemini');
                                            setAIProfile({ ...aiProfile, voiceProvider: 'gemini', aiCanGenerateSpeech: aiCanGenerateSpeech });
                                        }}
                                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center ${voiceProvider === 'gemini' ? 'bg-white dark:bg-indigo-800 text-indigo-600 dark:text-indigo-100 shadow-sm' : 'text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300'}`}
                                    >
                                        Gemini
                                    </button>
                                </div>
                                <p className="mt-2 text-[10px] text-indigo-500 dark:text-indigo-400">
                                    {voiceProvider === 'elevenlabs' && "Premium ElevenLabs voices. Requires an ElevenLabs API key in Settings."}
                                    {voiceProvider === 'browser' && "Uses your device's built-in speech engine. No API key required."}
                                    {voiceProvider === 'gemini' && "Natural-sounding Google voices with style control. Requires a Gemini API key in Settings."}
                                </p>
                            </div>

                            {voiceProvider === 'elevenlabs' ? (
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-sm font-bold text-indigo-900 dark:text-indigo-100">ElevenLabs Voices</label>
                                        <button onClick={fetchElevenLabsVoices} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center">
                                            <RotateCcw className="w-3 h-3 mr-1" />
                                            Refresh
                                        </button>
                                    </div>

                                    {/* Model selector */}
                                    <div>
                                        <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Model</label>
                                        <select
                                            value={elevenLabsModelId}
                                            onChange={(e) => setElevenLabsModelId(e.target.value)}
                                            className="w-full text-xs p-1.5 rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100"
                                        >
                                            <option value="eleven_v3">Eleven v3 — Most expressive, 70+ languages (recommended)</option>
                                            <option value="eleven_multilingual_v2">Multilingual v2 — Lifelike, 29 languages</option>
                                            <option value="eleven_flash_v2_5">Flash v2.5 — Ultra-fast ~75ms, 32 languages</option>
                                            <option value="eleven_flash_v2">Flash v2 — Ultra-fast, English only</option>
                                        </select>
                                    </div>

                                    {/* Filters */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            placeholder="Search voices…"
                                            value={elSearchFilter}
                                            onChange={(e) => setElSearchFilter(e.target.value)}
                                            className="col-span-2 text-xs p-1.5 rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100"
                                        />
                                        <select className="text-xs p-1 rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100" value={elCategoryFilter} onChange={(e) => setElCategoryFilter(e.target.value)}>
                                            <option value="">All categories</option>
                                            <option value="premade">Premade</option>
                                            <option value="cloned">Cloned</option>
                                            <option value="generated">Generated</option>
                                            <option value="professional">Professional</option>
                                        </select>
                                        <select className="text-xs p-1 rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100" value={elVoiceTypeFilter} onChange={(e) => setElVoiceTypeFilter(e.target.value)}>
                                            <option value="">All types</option>
                                            <option value="personal">My voices</option>
                                            <option value="community">Community</option>
                                            <option value="default">Default</option>
                                        </select>
                                        {/* Label filters — populated from ElevenLabs voice metadata */}
                                        <select className="text-xs p-1 rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100" value={elGenderFilter} onChange={(e) => setElGenderFilter(e.target.value)}>
                                            <option value="">Any gender</option>
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                        </select>
                                        <select className="text-xs p-1 rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100" value={elAgeFilter} onChange={(e) => setElAgeFilter(e.target.value)}>
                                            <option value="">Any age</option>
                                            <option value="young">Young</option>
                                            <option value="middle">Middle aged</option>
                                            <option value="old">Old</option>
                                        </select>
                                        <select className="text-xs p-1 rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100" value={elAccentFilter} onChange={(e) => setElAccentFilter(e.target.value)}>
                                            <option value="">Any accent</option>
                                            <option value="american">American</option>
                                            <option value="british">British</option>
                                            <option value="australian">Australian</option>
                                            <option value="irish">Irish</option>
                                            <option value="canadian">Canadian</option>
                                            <option value="indian">Indian</option>
                                            <option value="african">African</option>
                                        </select>
                                        <select className="text-xs p-1 rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100" value={elLangFilter} onChange={(e) => setElLangFilter(e.target.value)}>
                                            <option value="">Any language</option>
                                            <option value="english">English</option>
                                            <option value="spanish">Spanish</option>
                                            <option value="french">French</option>
                                            <option value="german">German</option>
                                            <option value="portuguese">Portuguese</option>
                                            <option value="italian">Italian</option>
                                            <option value="japanese">Japanese</option>
                                            <option value="chinese">Chinese</option>
                                            <option value="korean">Korean</option>
                                            <option value="arabic">Arabic</option>
                                            <option value="hindi">Hindi</option>
                                        </select>
                                        <select className="text-xs p-1 rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100" value={elSort} onChange={(e) => setElSort(e.target.value as any)}>
                                            <option value="name">Sort: Name</option>
                                            <option value="created_at_unix">Sort: Date</option>
                                        </select>
                                        <select className="text-xs p-1 rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100" value={elSortDir} onChange={(e) => setElSortDir(e.target.value as any)}>
                                            <option value="asc">A → Z / Oldest</option>
                                            <option value="desc">Z → A / Newest</option>
                                        </select>
                                    </div>

                                    {/* Voice list */}
                                    {isLoadingElevenLabsVoices ? (
                                        <div className="flex justify-center py-4">
                                            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                                        </div>
                                    ) : elevenLabsVoices.length > 0 ? (
                                        <div className="space-y-1 max-h-60 overflow-y-auto">
                                            {elevenLabsVoices.map((v: any) => (
                                                <div
                                                    key={v.voice_id}
                                                    onClick={() => {
                                                        setElevenLabsVoiceId(v.voice_id);
                                                        setAIProfile({ ...aiProfile, asyncVoiceId: v.voice_id, voiceProvider: 'elevenlabs' });
                                                    }}
                                                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${elevenLabsVoiceId === v.voice_id ? 'bg-indigo-200 dark:bg-indigo-700' : 'hover:bg-indigo-100 dark:hover:bg-indigo-800'}`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-sm font-bold text-indigo-900 dark:text-indigo-100 truncate block">{v.name}</span>
                                                        <span className="text-[10px] text-indigo-400 dark:text-indigo-500">
                                                            {[v.labels?.language, v.labels?.gender, v.labels?.age, v.labels?.accent].filter(Boolean).join(' · ')}
                                                        </span>
                                                    </div>
                                                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ml-2 ${elevenLabsVoiceId === v.voice_id ? 'border-indigo-600 bg-indigo-600' : 'border-indigo-300 dark:border-indigo-700'}`}>
                                                        {elevenLabsVoiceId === v.voice_id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-center text-indigo-500 dark:text-indigo-400 py-4">
                                            {elevenLabsApiKey ? 'No voices found. Try different filters.' : 'Add your ElevenLabs API key in Settings first.'}
                                        </p>
                                    )}

                                    <div className="flex justify-center">
                                        <button
                                            onClick={handleTestVoice}
                                            disabled={isTestingVoice || !elevenLabsVoiceId}
                                            className="flex items-center space-x-2 py-2 px-6 bg-indigo-600 text-white rounded-full text-sm font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md"
                                        >
                                            {isTestingVoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                            <span>Test ElevenLabs Voice</span>
                                        </button>
                                    </div>

                                    {/* Custom voice ID */}
                                    <div className="border-t border-indigo-100 dark:border-indigo-800 pt-3">
                                        <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">Custom Voice ID</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={elevenLabsVoiceId}
                                                onChange={(e) => setElevenLabsVoiceId(e.target.value)}
                                                placeholder="Paste a voice ID from elevenlabs.io"
                                                className="flex-1 p-2 border border-indigo-300 dark:border-indigo-700 rounded-lg bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                            <button
                                                onClick={() => {
                                                    if (!elevenLabsVoiceId.trim()) return;
                                                    setAIProfile({ ...aiProfile, asyncVoiceId: elevenLabsVoiceId.trim(), voiceProvider: 'elevenlabs' });
                                                    addToast({ title: 'Voice Set', message: 'Custom ElevenLabs voice ID saved.', type: 'success' });
                                                }}
                                                className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                                            >
                                                Use
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-indigo-400 dark:text-indigo-500 mt-1">
                                            Find voice IDs on your ElevenLabs dashboard. Works for any voice including ones you've created there.
                                        </p>
                                    </div>
                                    {/* ElevenLabs voice quality settings */}
                                    <div className="border-t border-indigo-100 dark:border-indigo-800 pt-3 space-y-3">
                                        <label className="block text-xs font-semibold text-indigo-700 dark:text-indigo-300">Voice Quality Settings</label>
                                        {[
                                          { label: `Stability: ${elStability.toFixed(2)}`, val: elStability, set: setElStability, min: 0, max: 1, step: 0.05, hint: 'Higher = more consistent but less expressive' },
                                          { label: `Similarity Boost: ${elSimilarity.toFixed(2)}`, val: elSimilarity, set: setElSimilarity, min: 0, max: 1, step: 0.05, hint: 'How closely the AI follows the original voice' },
                                          { label: `Style: ${elStyle.toFixed(2)}`, val: elStyle, set: setElStyle, min: 0, max: 1, step: 0.05, hint: 'Style exaggeration — higher values are more dramatic' },
                                          { label: `Speaking Rate: ${elSpeakingRate.toFixed(2)}x`, val: elSpeakingRate, set: setElSpeakingRate, min: 0.7, max: 1.2, step: 0.05, hint: 'Speech speed multiplier' },
                                        ].map(({ label, val, set, min, max, step, hint }) => (
                                          <div key={label}>
                                            <div className="flex items-center gap-1 mb-1">
                                              <label className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300">{label}</label>
                                              <div className="relative group" tabIndex={0}>
                                                <HelpCircle className="w-3 h-3 text-indigo-400 cursor-help" />
                                                <div className="absolute bottom-full left-0 mb-1 w-44 p-2 bg-indigo-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">{hint}</div>
                                              </div>
                                            </div>
                                            <input type="range" min={min} max={max} step={step} value={val}
                                              onChange={(e) => set(parseFloat(e.target.value) as any)}
                                              className="w-full h-1.5 bg-indigo-200 dark:bg-indigo-800 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                                          </div>
                                        ))}
                                        <div className="flex items-center justify-between">
                                          <label className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300">Speaker Boost</label>
                                          <button onClick={() => setElSpeakerBoost(!elSpeakerBoost)}
                                            className={`w-8 h-5 rounded-full transition-colors ${elSpeakerBoost ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                                            <div className={`w-3 h-3 rounded-full bg-white transition-transform mx-auto ${elSpeakerBoost ? 'translate-x-1.5' : '-translate-x-1.5'}`} />
                                          </button>
                                        </div>
                                        <div className="flex items-center justify-between pt-1">
                                            <div>
                                                <label className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">Dynamic Style</label>
                                                <p className="text-[10px] text-indigo-400 leading-tight">Auto-scale style exaggeration based on the AI's emotional tone</p>
                                            </div>
                                            <button
                                                onClick={() => setDynamicEmotion(!dynamicEmotion)}
                                                data-testid="el-dynamic-style-toggle"
                                                className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${dynamicEmotion ? 'bg-indigo-600' : 'bg-indigo-200 dark:bg-indigo-800'}`}>
                                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${dynamicEmotion ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-1">Browser Voice</label>
                                            <div className="flex space-x-2">
                                                <select
                                                value={voiceURI}
                                                onChange={(e) => setVoiceURI(e.target.value)}
                                                className="flex-1 p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                >
                                                <option value="">Default System Voice</option>
                                                {voices.map((voice) => (
                                                    <option key={`browser-${voice.voiceURI}`} value={voice.voiceURI}>
                                                        {voice.name} ({voice.lang})
                                                    </option>
                                                ))}
                                                </select>
                                                <button
                                                    onClick={handleTestVoice}
                                                    disabled={isTestingVoice}
                                                    className="p-2 bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-400 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                                    title="Test Voice"
                                                >
                                                    <Play className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {voiceProvider === 'gemini' && (
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    {/* Model */}
                                    <div>
                                        <label className="block text-sm font-bold text-indigo-900 dark:text-indigo-100 mb-1">Model</label>
                                        <select
                                            value={geminiTtsModel}
                                            onChange={e => setGeminiTtsModel(e.target.value)}
                                            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-lg bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value="gemini-3.1-flash-tts-preview">Gemini 3.1 Flash TTS</option>
                                        </select>
                                    </div>
                                    {/* Voice */}
                                    <div>
                                        <label className="block text-sm font-bold text-indigo-900 dark:text-indigo-100 mb-1">Voice</label>
                                        <select
                                            value={geminiTtsVoice}
                                            onChange={e => setGeminiTtsVoice(e.target.value)}
                                            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-lg bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        >
                                            <optgroup label="Female">
                                                {['Achernar','Aoede','Autonoe','Callirrhoe','Despina','Erinome','Gacrux','Kore','Laomedeia','Leda','Pulcherrima','Sulafat','Vindemiatrix','Zephyr'].map(v => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Male">
                                                {['Achird','Algenib','Algieba','Alnilam','Charon','Enceladus','Fenrir','Iapetus','Orus','Puck','Rasalgethi','Sadachbia','Sadaltager','Schedar','Umbriel'].map(v => (
                                                    <option key={v} value={v}>{v}</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                    {/* Style prompt */}
                                    <div>
                                        <label className="block text-sm font-bold text-indigo-900 dark:text-indigo-100 mb-1">
                                            Style Prompt <span className="text-xs font-normal text-indigo-400">(optional)</span>
                                        </label>
                                        <textarea
                                            value={geminiTtsStyle}
                                            onChange={e => setGeminiTtsStyle(e.target.value)}
                                            rows={2}
                                            placeholder="e.g. Speak warmly and with gentle enthusiasm. Use a calm, friendly tone."
                                            className="w-full p-2 border border-indigo-300 dark:border-indigo-700 rounded-lg bg-white dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 text-xs focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                        />
                                        <p className="text-[10px] text-indigo-400 mt-1">Describe how the voice should sound using natural language.</p>
                                    </div>
                                    {/* Test button */}
                                    <button
                                        onClick={handleTestVoice}
                                        disabled={isTestingVoice}
                                        className="flex items-center space-x-2 py-2 px-6 bg-indigo-600 text-white rounded-full text-sm font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md"
                                    >
                                        {isTestingVoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                        <span>Test Gemini Voice</span>
                                    </button>
                                </div>
                            )}
                            </div>

            </>
        )}
    </div>

                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t border-indigo-100 dark:border-indigo-800">
                    <button
                        onClick={handleSave}
                        className="w-full sm:w-auto bg-indigo-600 dark:bg-indigo-500 text-white py-2 px-4 rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors font-medium shadow-sm flex items-center justify-center"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                    </button>
                    <button
                        onClick={handleSaveAsNew}
                        className="w-full sm:w-auto bg-white dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 py-2 px-4 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors font-medium shadow-sm flex items-center justify-center"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Save as New
                    </button>
                    <button
                        onClick={handleDelete}
                        className="px-4 py-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900"
                        title="Delete Persona"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>

                {/* Preview Chat Section */}
                <PreviewChat 
                  name={name}
                  previewMessages={previewMessages}
                  isPreviewLoading={isPreviewLoading}
                  previewInput={previewInput}
                  setPreviewInput={setPreviewInput}
                  handlePreviewSend={handlePreviewSend}
                  setPreviewMessages={setPreviewMessages}
                />
            </div>
        </div>
      </div>

      {/* ── Replace persona confirmation modal ───────────────────────── */}
      {pendingImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-indigo-950 rounded-xl shadow-xl max-w-sm w-full p-6 border border-indigo-200 dark:border-indigo-700">
            <h3 className="text-base font-semibold text-indigo-900 dark:text-indigo-100 mb-2">Replace existing persona?</h3>
            <p className="text-sm text-indigo-600 dark:text-indigo-400 mb-5">
              The file you imported has the same ID as <span className="font-medium text-indigo-800 dark:text-indigo-200">"{pendingImport.existingName}"</span>. Do you want to replace it, or save as a new persona?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => doImport(pendingImport.persona, true)}
                className="w-full py-2 px-4 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Replace "{pendingImport.existingName}"
              </button>
              <button
                onClick={() => doImport(pendingImport.persona, false)}
                className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Save as new persona
              </button>
              <button
                onClick={() => setPendingImport(null)}
                className="w-full py-2 px-4 bg-indigo-100 dark:bg-indigo-800 hover:bg-indigo-200 dark:hover:bg-indigo-700 text-indigo-700 dark:text-indigo-300 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AIProfileScreen;
