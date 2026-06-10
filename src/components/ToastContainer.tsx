import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { X, Info, CheckCircle, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-rose-500" />;
      case 'loading': return <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />;
      default: return <Info className="w-5 h-5 text-indigo-500" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-emerald-100 dark:bg-emerald-900 border-emerald-200 dark:border-emerald-800';
      case 'warning': return 'bg-amber-100 dark:bg-amber-900 border-amber-200 dark:border-amber-800';
      case 'error': return 'bg-rose-100 dark:bg-rose-900 border-rose-200 dark:border-rose-800';
      case 'loading': return 'bg-indigo-100 dark:bg-indigo-900 border-indigo-200 dark:border-indigo-800';
      default: return 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800';
    }
  };

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-4 w-full max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start p-5 rounded-2xl shadow-2xl border-2 ${getBgColor(toast.type)}`}
        >
          <div className="flex-shrink-0 mr-3 mt-0.5">
            {getIcon(toast.type)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 truncate">
              {toast.title}
            </h3>
            <p className="mt-1 text-sm text-indigo-600 dark:text-indigo-400 line-clamp-3">
              {toast.message}
            </p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
