import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSignalR } from '../hooks/useSignalR';
import { useAuth } from './AuthContext';
import { notificationApi } from '../api/axiosInstance';
import { AlertTriangle, FlaskConical, BedDouble, Bell, X, CheckCircle, Info, MailOpen, Trash2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export interface Toast { 
  id: string; 
  type: ToastType; 
  title: string; 
  message: string; 
  duration?: number;
  onClick?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  sentAt: string;
  relatedEntityId?: number;
  relatedEntityType?: string;
}

interface NotificationContextType {
  toasts: Toast[];
  notifications: Notification[];
  unreadCount: number;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markSectionAsRead: (section: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  hasUnreadInSection: (section: string) => boolean;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const ToastIcon: React.FC<{ type: ToastType }> = ({ type }) => {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
    error:   <AlertTriangle className="w-5 h-5 text-red-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
    info:    <Info className="w-5 h-5 text-blue-400" />,
  };
  return icons[type];
};

const toastStyles: Record<ToastType, string> = {
  success: 'border-l-4 border-emerald-500 bg-slate-900/95',
  error:   'border-l-4 border-red-500 bg-slate-900/95',
  warning: 'border-l-4 border-amber-500 bg-slate-900/95',
  info:    'border-l-4 border-blue-500 bg-slate-900/95',
};

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    if (toast.onConfirm) return; // Confirmation toasts stay until action
    const timer = setTimeout(() => onRemove(toast.id), toast.duration ?? 5000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove, toast.onConfirm]);

  const handleClick = () => {
    if (toast.onClick) {
      toast.onClick();
      onRemove(toast.id);
    }
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toast.onConfirm) toast.onConfirm();
    onRemove(toast.id);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toast.onCancel) toast.onCancel();
    onRemove(toast.id);
  };

  return (
    <div 
      onClick={handleClick}
      className={`flex flex-col gap-3 p-4 rounded-2xl shadow-2xl min-w-[320px] max-w-[400px] backdrop-blur-xl text-white animate-slide-in border border-white/10 ${toastStyles[toast.type]} ${toast.onClick ? 'cursor-pointer hover:brightness-110 active:scale-95 transition-all' : ''}`}
    >
      <div className="flex items-start gap-3">
        <ToastIcon type={toast.type} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[14px] text-white tracking-tight">{toast.title}</p>
          <p className="text-[12px] text-slate-300 mt-0.5 leading-relaxed font-medium">{toast.message}</p>
        </div>
        {!toast.onConfirm && (
            <button 
                onClick={(e) => { e.stopPropagation(); onRemove(toast.id); }} 
                className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
            >
                <X className="w-4 h-4" />
            </button>
        )}
      </div>

      {toast.onConfirm && (
          <div className="flex gap-2 mt-1">
              <button 
                onClick={handleConfirm}
                className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/20"
              >
                {toast.confirmLabel || 'Confirm'}
              </button>
              <button 
                onClick={handleCancel}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all"
              >
                {toast.cancelLabel || 'Cancel'}
              </button>
          </div>
      )}
    </div>
  );
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsEnabled, setEnabled] = useState(() => {
    const saved = localStorage.getItem('hms_notif_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const { isAuthenticated } = useAuth();

  useEffect(() => {
    localStorage.setItem('hms_notif_enabled', JSON.stringify(notificationsEnabled));
  }, [notificationsEnabled]);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [notifRes, countRes] = await Promise.all([
        notificationApi.getMy(),
        notificationApi.getUnreadCount()
      ]);
      setNotifications(notifRes.data);
      setUnreadCount(countRes.data.count);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s as fallback
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    if (!notificationsEnabled) {
      fetchNotifications(); // Still refresh list in bg
      return;
    }
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev.slice(-4), { ...toast, id }]);
    fetchNotifications(); // Refresh list when new toast arrives
  }, [fetchNotifications, notificationsEnabled]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const markAsRead = async (id: number) => {
    try {
      await notificationApi.markAsRead(id);
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      await fetchNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const markSectionAsRead = async (section: string) => {
    const s = section.toLowerCase();
    const toMark = notifications.filter(n => {
        if (n.isRead) return false;
        const type = (n.type || '').toLowerCase();
        const entity = (n.relatedEntityType || '').toLowerCase();
        const title = (n.title || '').toLowerCase();
        const msg = (n.message || '').toLowerCase();
        const combined = `${type} ${entity} ${title} ${msg}`;

        if (s.includes('appointment') || s.includes('schedule') || s.includes('visit')) {
            if (s.includes('book')) return false;
            return combined.includes('appointment') || combined.includes('schedule') || combined.includes('visit');
        }
        if (s.includes('admission') || s.includes('bed') || s.includes('ward')) {
            return combined.includes('admission') || combined.includes('bed') || combined.includes('ward');
        }
        if (s.includes('bill') || s.includes('payment') || s.includes('receipt') || s.includes('invoice') || s.includes('billing')) {
            return combined.includes('bill') || combined.includes('payment') || combined.includes('receipt') || combined.includes('invoice') || combined.includes('charge') || combined.includes('fee');
        }
        if (s.includes('lab') || s.includes('test') || s.includes('result') || s.includes('queue')) {
            return combined.includes('lab') || combined.includes('test') || combined.includes('result');
        }
        if (s.includes('prescription') || s.includes('pharmacy') || s.includes('medicine') || s.includes('stock')) {
            return combined.includes('prescription') || combined.includes('medicine') || combined.includes('pharmacy') || combined.includes('stock') || combined.includes('pill');
        }
        if (s.includes('staff') || s.includes('user') || s.includes('profile')) {
            return combined.includes('staff') || combined.includes('user') || combined.includes('account') || combined.includes('profile');
        }
        if (s.includes('message') || s.includes('enquiry') || s.includes('chat') || s.includes('ai') || s.includes('assistant')) {
            return combined.includes('message') || combined.includes('enquiry') || combined.includes('chat') || combined.includes('reply') || combined.includes('ai');
        }
        if (s === 'dashboard') return true;
        return false;
    });

    if (toMark.length > 0) {
        try {
            await Promise.all(toMark.map(n => notificationApi.markAsRead(n.id)));
            await fetchNotifications();
        } catch (error) {
            console.error('Failed to mark section as read:', error);
        }
    }
  };

  const hasUnreadInSection = useCallback((section: string) => {
    if (unreadCount === 0) return false;
    const s = section.toLowerCase();
    
    // Check if any unread notification matches this section
    return notifications.some(n => {
        if (n.isRead) return false;
        const type = (n.type || '').toLowerCase();
        const entity = (n.relatedEntityType || '').toLowerCase();
        const title = (n.title || '').toLowerCase();
        const msg = (n.message || '').toLowerCase();
        const combined = `${type} ${entity} ${title} ${msg}`;

        if (s.includes('appointment') || s.includes('schedule') || s.includes('visit')) {
            // Never show red dots on "Book Appointment" action button
            if (s.includes('book')) return false;
            return combined.includes('appointment') || combined.includes('schedule') || combined.includes('visit');
        }
        if (s.includes('admission') || s.includes('bed') || s.includes('ward')) {
            return combined.includes('admission') || combined.includes('bed') || combined.includes('ward');
        }
        if (s.includes('bill') || s.includes('payment') || s.includes('receipt') || s.includes('invoice') || s.includes('billing')) {
            return combined.includes('bill') || combined.includes('payment') || combined.includes('receipt') || combined.includes('invoice') || combined.includes('charge') || combined.includes('fee');
        }
        if (s.includes('lab') || s.includes('test') || s.includes('result') || s.includes('queue')) {
            return combined.includes('lab') || combined.includes('test') || combined.includes('result');
        }
        if (s.includes('prescription') || s.includes('pharmacy') || s.includes('medicine') || s.includes('stock')) {
            return combined.includes('prescription') || combined.includes('medicine') || combined.includes('pharmacy') || combined.includes('stock') || combined.includes('pill');
        }
        if (s.includes('staff') || s.includes('user') || s.includes('profile')) {
            return combined.includes('staff') || combined.includes('user') || combined.includes('account') || combined.includes('profile');
        }
        if (s.includes('message') || s.includes('enquiry') || s.includes('chat') || s.includes('ai') || s.includes('assistant')) {
            return combined.includes('message') || combined.includes('enquiry') || combined.includes('chat') || combined.includes('reply') || combined.includes('ai');
        }

        // Catch-all for Dashboard to ensure unread notifications are always visible somewhere
        if (s === 'dashboard') return true;
        
        return false;
    });
  }, [notifications, unreadCount]);

  const signalrEvents = React.useMemo(() => [
    {
      event: 'LowStockAlert',
      handler: (data: any) => {
        addToast({
          type: 'warning', 
          title: '⚠ Low Stock Alert',
          message: `${data.name || data.Name} — Only ${data.currentStock || data.CurrentStock} units left`,
          duration: 8000,
        });
      },
    },
    {
      event: 'LabResultReady',
      handler: (data: any) => {
        addToast({
          type: (data.isAbnormal || data.IsAbnormal) ? 'error' : 'success',
          title: (data.isAbnormal || data.IsAbnormal) ? '🔴 Abnormal Lab Result' : '✅ Lab Result Ready',
          message: data.message || data.Message, duration: 7000,
        });
      },
    },
    {
      event: 'NewNotification',
      handler: () => fetchNotifications(),
    },
    {
      event: 'ReceiveNotification',
      handler: (data: any) => {
        addToast({
          type: data.type || data.Type || 'info',
          title: data.title || data.Title || 'New Notification',
          message: data.message || data.Message,
        });
        fetchNotifications();
      },
    }
  ], [addToast, fetchNotifications]);

  useSignalR(signalrEvents, isAuthenticated);

  return (
    <NotificationContext.Provider value={{ 
      toasts, 
      notifications, 
      unreadCount, 
      notificationsEnabled,
      setNotificationsEnabled: setEnabled,
      addToast, 
      removeToast, 
      markAsRead, 
      markAllAsRead,
      markSectionAsRead,
      refreshNotifications: fetchNotifications,
      hasUnreadInSection 
    }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => <div key={toast.id} className="pointer-events-auto"><ToastItem toast={toast} onRemove={removeToast} /></div>)}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be inside NotificationProvider');
  return ctx;
};
