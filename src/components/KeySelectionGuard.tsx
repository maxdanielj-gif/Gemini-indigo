import React, { useState, useEffect } from 'react';
import { Key } from 'lucide-react';

interface KeySelectionGuardProps {
  children: React.ReactNode;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const KeySelectionGuard: React.FC<KeySelectionGuardProps> = ({ children }) => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      try {
        if (window.aistudio) {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasKey(selected);
        } else {
          // Fallback if not in AI Studio environment
          setHasKey(true);
        }
      } catch (e) {
        console.error("Error checking API key selection:", e);
        setHasKey(true);
      }
    };
    checkKey();

    const handleResetKey = () => {
      setHasKey(false);
    };

    window.addEventListener('aistudio:reset-key', handleResetKey);
    return () => {
      window.removeEventListener('aistudio:reset-key', handleResetKey);
    };
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume success and proceed to app (mitigate race condition)
      setHasKey(true);
    }
  };

  if (hasKey === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (hasKey === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">API Key Required</h1>
          <p className="text-gray-600 mb-8 leading-relaxed">
            To use high-quality image generation and advanced AI models, you must select a paid API key from your Google Cloud project.
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full bg-indigo-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            Select API Key
          </button>
          <p className="mt-6 text-xs text-gray-400">
            Learn more about <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">Gemini API billing</a>.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default KeySelectionGuard;
