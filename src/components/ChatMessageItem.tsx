import React, { memo } from 'react';
import { FileText, ExternalLink, Star, Volume2, Edit2, RotateCcw, Trash2, CheckCheck, MoreHorizontal, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage } from '../types';

interface ChatMessageItemProps {
  msg: ChatMessage;
  editingMessageId: string | null;
  setEditingMessageId: (id: string | null) => void;
  handleEdit: (id: string, content: string) => void;
  rateChatMessage: (id: string, rating: number) => void;
  addFeedbackComment: (id: string, comment: string) => void;
  speakMessage: (content: string, id: string) => void;
  handleRegenerate: (id: string) => void;
  handleDeleteMessage: (id: string) => void;
  showTimestamps: boolean;
  timeZone: string;
  readMessages: Set<string>;
  onImageClick?: (url: string, prompt?: string) => void;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  msg,
  editingMessageId,
  setEditingMessageId,
  handleEdit,
  rateChatMessage,
  addFeedbackComment,
  speakMessage,
  handleRegenerate,
  handleDeleteMessage,
  showTimestamps,
  timeZone,
  readMessages,
  onImageClick
}) => {
  const isUser = msg.role === 'user';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4 px-2`}
    >
      <div className={`flex flex-col max-w-[90%] md:max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`relative group px-4 py-3 rounded-2xl shadow-sm transition-all duration-200 ${
            isUser
              ? 'bg-primary text-text rounded-tr-sm'
              : 'bg-bg text-text rounded-tl-sm border border-text/10'
          }`}
        >
          {/* Attachments */}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="mb-2 space-y-2">
              {msg.attachments.map((att, idx) => (
                <motion.div 
                  key={idx} 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl overflow-hidden shadow-sm border border-indigo-900/5 dark:border-indigo-100/5"
                >
                  {att.type === 'image' ? (
                    <div 
                      className="relative group/img cursor-pointer"
                      onClick={() => onImageClick?.(att.content, msg.content)}
                    >
                      <img
                        src={att.content}
                        alt="Attachment"
                        className="max-w-full h-auto object-contain max-h-64 rounded-lg"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                        <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
                      </div>
                    </div>
                  ) : (
                    <div className={`${isUser ? 'bg-indigo-900/10 dark:bg-indigo-100/10' : 'bg-indigo-50 dark:bg-indigo-950'} p-3 rounded-lg text-xs flex items-center`}>
                      <FileText className={`w-4 h-4 mr-2 ${isUser ? 'text-indigo-900 dark:text-indigo-50' : 'text-indigo-600 dark:text-indigo-400'}`} />
                      <span className="truncate flex-1">{att.name}</span>
                      <span className="ml-2 opacity-50 uppercase text-[10px]">{att.type}</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Content */}
          {editingMessageId === msg.id ? (
            <div className="w-full min-w-[240px] py-1">
              <textarea
                id={`edit-message-${msg.id}`}
                className="w-full p-3 text-sm text-indigo-900 dark:text-indigo-50 rounded-xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-900/10 dark:border-indigo-100/10 focus:ring-2 focus:ring-indigo-600 dark:focus:ring-indigo-400 outline-none transition-all"
                defaultValue={msg.content}
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleEdit(msg.id, e.currentTarget.value);
                  } else if (e.key === 'Escape') {
                    setEditingMessageId(null);
                  }
                }}
                autoFocus
              />
              <div className="flex justify-end space-x-2 mt-3">
                <button
                  onClick={() => setEditingMessageId(null)}
                  className="px-4 py-2 text-xs font-semibold text-indigo-900 dark:text-indigo-50 bg-indigo-50 dark:bg-indigo-950 rounded-lg hover:bg-indigo-900/10 dark:hover:bg-indigo-100/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById(`edit-message-${msg.id}`) as HTMLTextAreaElement;
                    if (el) handleEdit(msg.id, el.value);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 dark:bg-indigo-500 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 shadow-md transition-all active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm md:text-base whitespace-pre-wrap leading-relaxed break-words">
              {msg.content.split(/(\*.*?\*|\(.*?\))/g).map((part, i) => {
                if (part.startsWith('*') && part.endsWith('*')) {
                  return <span key={i} className={`italic ${isUser ? 'text-indigo-900/70 dark:text-indigo-50/70' : 'text-indigo-900 dark:text-indigo-50'}`}>{part}</span>;
                } else if (part.startsWith('(') && part.endsWith(')')) {
                  return <span key={i} className={`text-xs opacity-60 font-medium`}>{part}</span>;
                }
                return <span key={i}>{part}</span>;
              })}
            </div>
          )}

          {/* Grounding URLs */}
          {msg.groundingUrls && msg.groundingUrls.length > 0 && (
            <div className={`mt-3 pt-3 border-t flex flex-wrap gap-2 ${isUser ? 'border-indigo-900/10 dark:border-indigo-100/10' : 'border-indigo-900/10 dark:border-indigo-100/10'}`}>
              {msg.groundingUrls.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-[10px] px-2.5 py-1.5 rounded-full transition-all flex items-center ${
                    isUser 
                      ? 'bg-indigo-900/10 dark:bg-indigo-100/10 text-indigo-900 dark:text-indigo-50 hover:bg-indigo-900/20 dark:hover:bg-indigo-100/20' 
                      : 'bg-indigo-600/10 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600/20 dark:hover:bg-indigo-500/20'
                  }`}
                >
                  <ExternalLink className="w-3 h-3 mr-1.5" />
                  <span className="truncate max-w-[120px]">{link.title || "Source"}</span>
                </a>
              ))}
            </div>
          )}

          {/* Rating UI for AI Messages */}
          {msg.role === 'model' && !editingMessageId && (
            <div className="mt-3 pt-2 border-t border-indigo-900/10 dark:border-indigo-100/10">
              <div className="flex flex-col items-center space-y-2">
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => rateChatMessage(msg.id, star)}
                      className={`p-1.5 transition-all active:scale-125 ${
                        typeof msg.rating === 'number' && msg.rating >= star
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-indigo-900/50 dark:text-indigo-50/50 hover:text-yellow-200'
                      }`}
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  ))}
                </div>
                
                {typeof msg.rating === 'number' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="w-full"
                  >
                    <textarea
                      placeholder="Optional feedback..."
                      className="w-full p-2 text-xs bg-indigo-50/50 dark:bg-indigo-950/50 border border-indigo-900/10 dark:border-indigo-100/10 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                      defaultValue={msg.feedbackComment || ''}
                      rows={2}
                      onBlur={(e) => addFeedbackComment(msg.id, e.target.value)}
                    />
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {/* Message Actions - Hidden on mobile by default, shown on tap or hover */}
          <div className={`
            flex items-center justify-end mt-2 pt-2 border-t space-x-1 transition-opacity
            ${isUser ? 'border-indigo-900/10 dark:border-indigo-100/10 text-indigo-900 dark:text-indigo-50' : 'border-indigo-900/10 dark:border-indigo-100/10 text-indigo-900/60 dark:text-indigo-50/60'}
            lg:opacity-0 lg:group-hover:opacity-100
          `}>
            <button 
              onClick={() => speakMessage(msg.content, msg.id)} 
              className="p-2 rounded-lg hover:bg-indigo-900/5 dark:hover:bg-indigo-100/5 transition-colors active:bg-indigo-900/10 dark:active:bg-indigo-100/10" 
              title="Read Aloud"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setEditingMessageId(msg.id)} 
              className="p-2 rounded-lg hover:bg-indigo-900/5 dark:hover:bg-indigo-100/5 transition-colors active:bg-indigo-900/10 dark:active:bg-indigo-100/10" 
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            {msg.role === 'model' && (
              <button 
                onClick={() => handleRegenerate(msg.id)} 
                className="p-2 rounded-lg hover:bg-indigo-900/5 dark:hover:bg-indigo-100/5 transition-colors active:bg-indigo-900/10 dark:active:bg-indigo-100/10" 
                title="Regenerate"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={() => handleDeleteMessage(msg.id)} 
              className="p-2 rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-colors active:bg-red-500/20" 
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Timestamp & Status */}
        {showTimestamps && (
          <div className={`mt-1.5 px-1 flex items-center space-x-2 ${isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
            <span className="text-[10px] font-medium text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone })}
            </span>
            {isUser && readMessages.has(msg.id) && (
              <span title="Read" className="flex items-center">
                <CheckCheck className="w-3.5 h-3.5 text-indigo-500" />
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default memo(ChatMessageItem);
