import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  LayoutDashboard, Calendar, FlaskConical, Pill, Receipt,
  BedDouble, Users, Bell, BellOff, LogOut, Menu, X, ChevronRight,
  Activity, Settings, Stethoscope, Home, CalendarDays,
  AlertTriangle, Info, Plus, Sparkles
} from 'lucide-react';
import type { Role } from '../../context/AuthContext';

import { EnquiryChat } from '../chat/EnquiryChat';
import { AIChat } from '../chat/AIChat';

const NAV_ITEMS: Record<Role, { icon: React.ReactNode; label: string; path: string; action?: string }[]> = {
  Patient: [
    { icon: <LayoutDashboard strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Sparkles strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'AI Health Assistant', path: '#ai-chat', action: 'open-ai' },
    { icon: <Plus strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Book Appointment', path: '/dashboard?book=true' },
    { icon: <Calendar strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'My Appointments', path: '/appointments' },
    { icon: <Pill strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'My Prescriptions', path: '/prescriptions' },
    { icon: <Receipt strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Bills & Payments', path: '/bills' },
  ],
  Doctor: [
    { icon: <LayoutDashboard strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Dashboard', path: '/dashboard' },
    { icon: <CalendarDays strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'My Schedule', path: '/schedule' },
    { icon: <Calendar strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Appointments', path: '/appointments' },
    { icon: <BedDouble strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Admissions', path: '/admissions' },
    { icon: <Pill strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Prescriptions', path: '/prescriptions' },
  ],
  Admin: [
    { icon: <LayoutDashboard strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Users strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Staff', path: '/staff' },
    { icon: <BedDouble strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Beds', path: '/beds' },
    { icon: <Activity strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Analytics', path: '/analytics' },
    { icon: <Pill strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Pharmacy', path: '/pharmacy' },
    { icon: <Receipt strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Billing', path: '/billing' },
  ],
  Pharmacist: [
    { icon: <LayoutDashboard strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Pill strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Medicines', path: '/medicines' },
    { icon: <Receipt strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Prescriptions', path: '/prescriptions' },
  ],
  LabTechnician: [
    { icon: <LayoutDashboard strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Dashboard', path: '/dashboard' },
    { icon: <FlaskConical strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Lab Queue', path: '/lab' },
  ],
  Receptionist: [
    { icon: <LayoutDashboard strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Calendar strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Appointments', path: '/appointments' },
    { icon: <BedDouble strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Admissions', path: '/admissions' },
    { icon: <Receipt strokeWidth={1.5} className="w-[18px] h-[18px]" />, label: 'Billing', path: '/billing' },
  ],
};

const Sidebar: React.FC<{ open: boolean; onClose: () => void; logout: () => void; onOpenAI: () => void }> = ({ open, onClose, logout, onOpenAI }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { hasUnreadInSection, markSectionAsRead } = useNotifications();
  const navItems = user ? NAV_ITEMS[user.role] : [];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-zinc-950/20 backdrop-blur-[2px] z-40 transition-opacity animate-in fade-in duration-300" onClick={onClose} />}
      <aside className={`fixed top-0 left-0 h-full w-[280px] z-50 flex flex-col bg-white border-r border-zinc-200 shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 h-16 shrink-0 border-b border-zinc-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center shadow-lg shadow-zinc-200">
              <Activity strokeWidth={2.5} className="w-4 h-4 text-white" />
            </div>
            <p className="text-[#18181B] font-black text-[16px] tracking-tight">GOMEDIC</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-all"><X strokeWidth={2} className="w-5 h-5" /></button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto w-full custom-scrollbar">
          {user?.role === 'Patient' && (
            <Link
              to="/"
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-[13px] font-bold transition-all bg-zinc-900 text-white hover:bg-zinc-800 mb-6 shadow-lg shadow-zinc-200"
            >
              <Home strokeWidth={2} className="w-4 h-4" />
              <span>Return to Home</span>
            </Link>
          )}

          <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] mb-4 px-4 opacity-60">Main Menu</div>

          {navItems.map(item => {
            const isActive = location.pathname.split('?')[0] === item.path.split('?')[0];
            const hasAlert = hasUnreadInSection(item.label);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={(e) => {
                  if (item.action === 'open-ai') {
                    e.preventDefault();
                    onOpenAI();
                  }
                  markSectionAsRead(item.label);
                  onClose();
                }}
                className={`group flex items-center justify-between px-4 py-3 rounded-2xl text-[14px] transition-all w-full
                  ${isActive
                    ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm ring-1 ring-emerald-100'
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'}`}
              >
                <div className="flex items-center gap-3.5 relative flex-1">
                  <span className={`transition-transform duration-300 ${isActive ? 'text-emerald-600 scale-110' : 'text-zinc-400 group-hover:text-zinc-900 group-hover:scale-110'}`}>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </div>
                {hasAlert && (
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 space-y-2 border-t border-zinc-100 bg-zinc-50/50">
          <Link
            to="/profile"
            onClick={onClose}
            className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all ${location.pathname === '/profile' ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200' : 'text-zinc-500 hover:bg-white hover:text-zinc-900 hover:shadow-sm'}`}
          >
            <Settings strokeWidth={2} className="w-4 h-4" /> Account Settings
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-all text-[13px] font-bold"
          >
            <LogOut strokeWidth={2} className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [aiChatOpen, setAIChatOpen] = useState(false);
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, notificationsEnabled, setNotificationsEnabled } = useNotifications();
  const navigate = useNavigate();

  return (
    <div className="flex h-[100dvh] bg-[#FAFAFA] font-sans text-zinc-900 overflow-hidden selection:bg-zinc-200">
      {/* Sidebar Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-zinc-950/20 backdrop-blur-[2px] z-40 transition-opacity animate-in fade-in duration-300" onClick={() => setSidebarOpen(false)} />}
      
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} logout={logout} onOpenAI={() => setAIChatOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md border-b border-zinc-100 shrink-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-600 hover:bg-white hover:text-zinc-900 hover:shadow-sm transition-all relative">
              <Menu strokeWidth={2} className="w-5 h-5" />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full shadow-sm animate-pulse" />}
            </button>
            <div className="hidden sm:block">
              <h1 className="text-[14px] font-black text-zinc-900 uppercase tracking-widest">Hospital Management</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)} className={`relative w-8 h-8 flex items-center justify-center rounded-md transition-all ${notifOpen ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-500'}`}>
                {notificationsEnabled ? <Bell strokeWidth={1.5} className="w-[18px] h-[18px]" /> : <BellOff strokeWidth={1.5} className="w-[18px] h-[18px] text-zinc-400" />}
                {unreadCount > 0 && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 border border-white rounded-full" />}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white border border-zinc-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                    <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                       <div className="flex items-center gap-3">
                          <h3 className="font-bold text-zinc-900 text-[14px]">Notifications</h3>
                          <button onClick={() => setNotificationsEnabled(!notificationsEnabled)} className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors ${notificationsEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-400'}`}>
                             {notificationsEnabled ? 'Alerts On' : 'Silent'}
                          </button>
                       </div>
                       <button onClick={() => markAllAsRead()} className="text-[11px] font-bold text-zinc-400 hover:text-zinc-900">Clear All</button>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                       {notifications.length === 0 ? <div className="py-12 text-center text-zinc-400 text-[13px]">No notifications</div> :
                         notifications.map(n => (
                           <div key={n.id} className="p-4 border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer">
                              <p className="text-[13px] font-bold text-zinc-900">{n.title}</p>
                              <p className="text-[12px] text-zinc-500 mt-0.5">{n.message}</p>
                           </div>
                         ))
                       }
                    </div>
                  </div>
                </>
              )}
            </div>
            <div onClick={() => navigate('/profile')} className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[12px] font-bold cursor-pointer overflow-hidden">
               {user?.profileImageUrl ? <img src={user.profileImageUrl} className="w-full h-full object-cover" /> : user?.fullName[0]}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {user?.role === 'Patient' && <EnquiryChat />}
      <AIChat isOpen={aiChatOpen} onClose={() => setAIChatOpen(false)} />
    </div>
  );
};

export default MainLayout;