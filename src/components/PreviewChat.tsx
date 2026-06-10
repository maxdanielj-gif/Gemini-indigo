import React from 'react';
import { Play, Trash2 } from 'lucide-react';

interface PreviewChatProps {
  name: string;
  previewMessages: {role: 'user' | 'model', content: string, attachments?: {type: string, content: string, name: string}[]}[];
  isPreviewLoading: boolean;
  previewInput: string;
  setPreviewInput: (input: string) => void;
  handlePreviewSend: () => void;
  setPreviewMessages: (messages: {role: 'user' | 'model', content: string, attachments?: {type: string, content: string, name: string}[]}[]) => void;
}

const PreviewChat: React.FC<PreviewChatProps> = ({
  name, previewMessages, isPreviewLoading, previewInput,
  setPreviewInput, handlePreviewSend, setPreviewMessages
}) => {
  return (
    <div className="mt-8 border-t-2 border-indigo-50 dark:border-indigo-800 pt-6">
      <h3 className="text-lg font-bold text-indigo-800 dark:text-indigo-200 mb-4 flex items-center">
        <Play className="w-5 h-5 mr-2 text-indigo-500" />
        Test Persona Behavior
      </h3>
      <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-800 h-80 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {previewMessages.length === 0 && (
            <p className="text-center text-indigo-400 dark:text-indigo-500 text-sm mt-10">
              Start typing to test how {name} responds...
            </p>
          )}
          {previewMessages.map((msg, idx) => (
            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] p-2 rounded-lg text-sm ${
                msg.role === 'user' 
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white rounded-br-none' 
                : 'bg-white dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-100 rounded-bl-none'
              }`}>
                {msg.content}
                
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {msg.attachments.map((att, attIdx) => (
                      <div key={attIdx} className="rounded overflow-hidden border border-indigo-100 dark:border-indigo-800">
                        {att.type === 'image' && (
                          <img src={att.content} alt={att.name} className="max-w-full h-auto" referrerPolicy="no-referrer" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isPreviewLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 p-2 rounded-lg rounded-bl-none">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-indigo-400 dark:bg-indigo-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-indigo-400 dark:bg-indigo-500 rounded-full animate-bounce delay-75"></div>
                  <div className="w-2 h-2 bg-indigo-400 dark:bg-indigo-500 rounded-full animate-bounce delay-150"></div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="p-3 border-t border-indigo-200 dark:border-indigo-800 bg-white dark:bg-indigo-950 rounded-b-lg">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handlePreviewSend();
            }}
            className="flex space-x-2"
          >
            <input
              type="text"
              value={previewInput}
              onChange={(e) => setPreviewInput(e.target.value)}
              placeholder={`Message ${name}...`}
              className="flex-1 p-2 border border-indigo-300 dark:border-indigo-700 rounded-md bg-white dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm placeholder-indigo-400 dark:placeholder-indigo-600"
            />
            <button
              type="submit"
              disabled={isPreviewLoading || !previewInput.trim()}
              className="bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 text-sm font-medium"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => setPreviewMessages([])}
              className="text-indigo-400 dark:text-indigo-500 hover:text-red-500 dark:hover:text-red-400 px-2"
              title="Clear Preview"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PreviewChat;
