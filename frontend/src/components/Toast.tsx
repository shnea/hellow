'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning';
  title: string;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    info: <Info className="w-4 h-4 text-indigo-400" />,
    warning: <AlertCircle className="w-4 h-4 text-amber-400" />,
  };

  const borders = {
    success: 'border-emerald-500/40 bg-slate-900/95 text-slate-100 shadow-emerald-950/50',
    info: 'border-indigo-500/40 bg-slate-900/95 text-slate-100 shadow-indigo-950/50',
    warning: 'border-amber-500/40 bg-slate-900/95 text-slate-100 shadow-amber-950/50',
  };

  return (
    <div
      className={`pointer-events-auto flex items-start space-x-2.5 p-3 rounded-xl border shadow-xl backdrop-blur-md min-w-[280px] max-w-sm transition-all animate-in slide-in-from-bottom-3 duration-300 ${
        borders[toast.type]
      }`}
    >
      <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 text-xs">
        <p className="font-semibold text-slate-100">{toast.title}</p>
        <p className="text-slate-300 mt-0.5 leading-snug">{toast.message}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
