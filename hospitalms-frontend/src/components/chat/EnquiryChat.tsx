import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSignalR } from '../../hooks/useSignalR';
import { MessageSquare, Send, X, User, Headset, Clock, Search, CheckCircle2, Ban, Unlock, AlertTriangle } from 'lucide-react';
import { Button, Input, Badge, Modal } from '../ui';
import { chatApi } from '../../api/axiosInstance';
import { useNotifications } from '../../context/NotificationContext';

interface ChatMessage {
    patientId: string;
    patientName?: string;
    receptionistName?: string;
    message: string;
    timestamp: string;
    isFromPatient: boolean;
}

export const EnquiryChat = () => {
    const { user, isAuthenticated } = useAuth();
    const { addToast } = useNotifications();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [chats, setChats] = useState<ChatMessage[]>([]);
    const [activePatientId, setActivePatientId] = useState<string | null>(null);
    const [patientList, setPatientList] = useState<{id: string, name: string, unreadCount?: number, latestMessage?: string, isBlocked?: boolean}[]>([]);
    const [isBlockedByAdmin, setIsBlockedByAdmin] = useState(false);
    const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
    const [blockReason, setBlockReason] = useState('Unnecessary/Spam messages');
    const [isUnblocking, setIsUnblocking] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const lastNotifiedRef = useRef<string>('');

    // Fetch initial history and patient list
    useEffect(() => {
        if (!isAuthenticated || !user) return;

        const loadInitial = async () => {
            try {
                if (user.role === 'Receptionist') {
                    const res = await chatApi.getHistory();
                    setPatientList(res.data.map((p: any) => ({ 
                        id: p.patientId, 
                        name: p.patientName || `Patient #${p.patientId}`,
                        unreadCount: p.unreadCount,
                        latestMessage: p.latestMessage,
                        isBlocked: p.isBlocked
                    })));
                } else {
                    const res = await chatApi.getHistory();
                    setChats(res.data.map((m: any) => ({
                        patientId: m.patientId,
                        patientName: m.patientName,
                        receptionistName: m.receptionistName,
                        message: m.message,
                        timestamp: m.timestamp,
                        isFromPatient: m.isFromPatient
                    })));
                }
            } catch (err) {
                console.error("Failed to load chat history", err);
            }
        };

        loadInitial();
    }, [user, isAuthenticated]);

    // Fetch specific patient history for receptionist and mark as read
    useEffect(() => {
        if (user?.role === 'Receptionist' && activePatientId) {
            const loadPatientHistory = async () => {
                try {
                    const res = await chatApi.getHistory(activePatientId);
                    setChats(res.data.map((m: any) => ({
                        patientId: m.patientId,
                        patientName: m.patientName,
                        receptionistName: m.receptionistName,
                        message: m.message,
                        timestamp: m.timestamp,
                        isFromPatient: m.isFromPatient
                    })));

                    // Mark as read in backend
                    await chatApi.markAsRead(activePatientId);
                    
                    // Clear unread count locally
                    setPatientList(prev => prev.map(p => 
                        p.id === activePatientId ? { ...p, unreadCount: 0 } : p
                    ));
                } catch (err) {
                    console.error("Failed to load patient history", err);
                }
            };
            loadPatientHistory();
        }
    }, [activePatientId, user]);

    // Filter and SORT chats for the current view
    const currentChats = user?.role === 'Receptionist' 
        ? chats.filter(c => c.patientId === activePatientId)
        : chats;

    const signalR = useSignalR([
        {
            event: 'ReceiveEnquiry',
            handler: (enquiry: any) => {
                const isMyMessage = user?.role === 'Receptionist' 
                    ? !enquiry.isFromPatient 
                    : enquiry.isFromPatient;

                setChats(prev => {
                    const isDuplicate = prev.some(c => 
                        (enquiry.id && (c as any).id === enquiry.id) ||
                        (c.patientId === enquiry.patientId && 
                         c.message === enquiry.message && 
                         Math.abs(new Date(c.timestamp).getTime() - new Date(enquiry.timestamp).getTime()) < 5000)
                    );
                    if (isDuplicate) return prev;
                    return [...prev, enquiry];
                });

                const msgKey = enquiry.id || `${enquiry.patientId}-${enquiry.message}-${enquiry.timestamp}`;
                
                if (!isMyMessage && lastNotifiedRef.current !== msgKey.toString()) {
                    lastNotifiedRef.current = msgKey.toString();
                    const sender = enquiry.isFromPatient ? (enquiry.patientName || 'Patient') : (enquiry.receptionistName || 'Receptionist');
                    
                    addToast({
                        type: 'info',
                        title: `Message from ${sender}`,
                        message: enquiry.message.length > 50 ? enquiry.message.substring(0, 50) + '...' : enquiry.message,
                        onClick: () => {
                            if (user?.role === 'Receptionist') {
                                setActivePatientId(enquiry.patientId);
                                if (!window.location.pathname.toLowerCase().includes('/appointments')) {
                                    navigate('/appointments');
                                }
                            } else {
                                setIsOpen(true);
                            }
                        }
                    });
                }

                if (user?.role === 'Receptionist') {
                    setPatientList(prev => {
                        const existing = prev.find(p => p.id === enquiry.patientId);
                        const others = prev.filter(p => p.id !== enquiry.patientId);
                        
                        const updatedPatient = {
                            id: enquiry.patientId,
                            name: enquiry.patientName || existing?.name || `Patient #${enquiry.patientId}`,
                            unreadCount: (existing?.unreadCount || 0) + (activePatientId === enquiry.patientId ? 0 : 1),
                            latestMessage: enquiry.timestamp,
                            isBlocked: existing?.isBlocked
                        };

                        return [updatedPatient, ...others];
                    });
                    
                        if (!activePatientId && enquiry.isFromPatient) {
                            setActivePatientId(enquiry.patientId);
                        }
                    }
                }
            },
            {
                event: 'ReceiveError',
                handler: (error: string) => {
                    addToast({
                        type: 'error',
                        title: 'Messaging Limit',
                        message: error
                    });
                }
            },
            {
                event: 'UserBlocked',
            handler: (reason: string) => {
                setIsBlockedByAdmin(true);
                addToast({ type: 'error', title: 'Chat Blocked', message: reason || 'You have been blocked from sending enquiries.' });
            }
        },
        {
            event: 'UserUnblocked',
            handler: () => {
                setIsBlockedByAdmin(false);
                addToast({ type: 'success', title: 'Chat Unblocked', message: 'You can now send enquiries again.' });
            }
        },
        {
            event: 'PatientBlockedStatusChanged',
            handler: (data: { patientId: string, isBlocked: boolean }) => {
                setPatientList(prev => prev.map(p => 
                    p.id === data.patientId ? { ...p, isBlocked: data.isBlocked } : p
                ));

                if (user?.role === 'Receptionist') {
                    const patient = patientList.find(p => p.id === data.patientId);
                    addToast({
                        type: data.isBlocked ? 'error' : 'success',
                        title: data.isBlocked ? 'User Restricted' : 'Access Restored',
                        message: data.isBlocked 
                            ? `Patient ${patient?.name || data.patientId} has been restricted.` 
                            : `Patient ${patient?.name || data.patientId} can now send messages.`
                    });
                }
            }
        }
    ], isAuthenticated);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chats, isOpen, activePatientId]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const msgContent = message.trim();
        if (!msgContent || !signalR.current) return;

        if (isBlockedByAdmin) {
            addToast({ type: 'error', title: 'Action Denied', message: 'You are blocked from sending messages.' });
            return;
        }

        const now = new Date().toISOString();
        const tempMsg: ChatMessage = {
            patientId: user?.role === 'Receptionist' ? activePatientId! : (user?.id.toString() || ''),
            message: msgContent,
            timestamp: now,
            isFromPatient: user?.role !== 'Receptionist',
            patientName: user?.role !== 'Receptionist' ? user?.fullName : undefined,
            receptionistName: user?.role === 'Receptionist' ? user?.fullName : undefined
        };

        try {
            setChats(prev => [...prev, tempMsg]);
            setMessage('');

            if (user?.role === 'Receptionist') {
                if (!activePatientId) return;
                await signalR.current.invoke('ReplyEnquiry', activePatientId, msgContent);
            } else {
                await signalR.current.invoke('SendEnquiry', user?.fullName || 'Patient', msgContent);
            }
        } catch (err) {
            console.error('Failed to send message:', err);
        }
    };

    const handleBlockUser = async () => {
        if (!activePatientId || !signalR.current) return;
        const patient = patientList.find(p => p.id === activePatientId);
        
        if (patient?.isBlocked) {
            addToast({
                type: 'warning',
                title: 'Confirm Unblock',
                message: `Are you sure you want to unblock ${patient.name}?`,
                onConfirm: async () => {
                    await signalR.current?.invoke('UnblockUser', activePatientId);
                    // Toast will come from SignalR event handler
                }
            });
        } else {
            setBlockReason('Unnecessary/Spam messages');
            setIsBlockModalOpen(true);
        }
    };

    const submitBlock = async () => {
        if (!activePatientId || !signalR.current) return;
        const patient = patientList.find(p => p.id === activePatientId);
        try {
            await signalR.current.invoke('BlockUser', activePatientId, patient?.name, blockReason);
            setIsBlockModalOpen(false);
            // Toast will come from SignalR event handler
        } catch (err) {
            console.error("Block action failed", err);
        }
    };

    if (!isAuthenticated) return null;

    const activePatients = user?.role === 'Receptionist' ? patientList : [];
    const currentPatient = patientList.find(p => p.id === activePatientId);

    if (user?.role === 'Receptionist') {
        return (
            <div className="flex flex-col h-[700px] bg-white border border-zinc-200 rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                {/* Block Confirmation Modal */}
                <Modal isOpen={isBlockModalOpen} onClose={() => setIsBlockModalOpen(false)} title="Restrict User Access" size="sm">
                    <div className="space-y-6">
                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[13px] font-bold text-red-900">Blocking {currentPatient?.name}</p>
                                <p className="text-[11px] text-red-700 opacity-80 leading-relaxed">This patient will be restricted from sending new enquiries for 7 days.</p>
                            </div>
                        </div>
                        <Input 
                            label="Reason for Restriction" 
                            placeholder="e.g. Offensive language, Spamming" 
                            value={blockReason}
                            onChange={(e: any) => setBlockReason(e.target.value)}
                        />
                        <div className="flex gap-2">
                            <Button variant="secondary" className="flex-1" onClick={() => setIsBlockModalOpen(false)}>Cancel</Button>
                            <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={submitBlock}>Block Patient</Button>
                        </div>
                    </div>
                </Modal>

                <div className="flex border-b border-zinc-100 h-full">
                    {/* Patient List (Sidebar) */}
                    <div className="w-80 border-r border-zinc-100 flex flex-col bg-zinc-50/30">
                        <div className="p-6 border-b border-zinc-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-black text-zinc-900 tracking-tight">Messages</h3>
                                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search chats..." 
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm"
                                />
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {activePatients.length === 0 ? (
                                <div className="p-12 text-center">
                                    <div className="w-16 h-16 bg-zinc-100 rounded-3xl flex items-center justify-center mx-auto mb-4 opacity-40">
                                        <Clock className="w-8 h-8 text-zinc-400" />
                                    </div>
                                    <p className="text-[13px] font-bold text-zinc-400 uppercase tracking-widest">Inbox is empty</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-zinc-50">
                                    {activePatients.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setActivePatientId(p.id)}
                                            className={`w-full p-5 text-left transition-all flex items-center gap-4 relative group ${activePatientId === p.id ? 'bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] z-10' : 'hover:bg-white/60'}`}
                                        >
                                            {activePatientId === p.id && (
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-full" />
                                            )}
                                            <div className="relative">
                                                <div className={`w-12 h-12 rounded-2xl ${p.isBlocked ? 'bg-zinc-400' : 'bg-gradient-to-br from-emerald-500 to-teal-600'} flex items-center justify-center text-white text-[16px] font-black shadow-lg ${p.isBlocked ? '' : 'shadow-emerald-500/20'}`}>
                                                    {p.isBlocked ? <Ban className="w-6 h-6" /> : p.name.charAt(0).toUpperCase()}
                                                </div>
                                                {!p.isBlocked && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-0.5">
                                                    <p className={`text-[14px] font-bold truncate transition-colors ${p.isBlocked ? 'text-zinc-400' : activePatientId === p.id ? 'text-emerald-600' : 'text-zinc-900'}`}>{p.name}</p>
                                                    {p.unreadCount && p.unreadCount > 0 ? (
                                                        <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-emerald-500/30 animate-bounce">
                                                            {p.unreadCount}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-zinc-400 font-medium">Just now</span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-zinc-500 font-medium truncate opacity-70 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                    {p.isBlocked && <span className="text-red-500 font-bold uppercase text-[9px]">Blocked</span>}
                                                    Patient ID: {p.id}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chat Area (Main) */}
                    <div className="flex-1 flex flex-col bg-white">
                        {activePatientId ? (
                            <>
                                {/* Chat Header */}
                                <div className="px-8 py-5 border-b border-zinc-100 bg-white/80 backdrop-blur-md flex justify-between items-center z-10">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl ${currentPatient?.isBlocked ? 'bg-red-50 text-red-500' : 'bg-zinc-100 text-zinc-500'} flex items-center justify-center text-[14px] font-black`}>
                                            {currentPatient?.isBlocked ? <Ban className="w-5 h-5" /> : currentPatient?.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[16px] font-black text-zinc-900 leading-tight">
                                                    {currentPatient?.name}
                                                </p>
                                                {currentPatient?.isBlocked && <Badge variant="danger" className="text-[9px]">Blocked</Badge>}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-1.5 h-1.5 ${currentPatient?.isBlocked ? 'bg-zinc-300' : 'bg-emerald-500 animate-pulse'} rounded-full`} />
                                                <p className={`text-[10px] ${currentPatient?.isBlocked ? 'text-zinc-400' : 'text-emerald-600'} font-black uppercase tracking-widest`}>
                                                    {currentPatient?.isBlocked ? 'Conversation Suspended' : 'Live Connection'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={handleBlockUser}
                                            title={currentPatient?.isBlocked ? "Unblock Patient" : "Block Patient"}
                                            className={`p-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider ${
                                                currentPatient?.isBlocked 
                                                ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                                            }`}
                                        >
                                            {currentPatient?.isBlocked ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                            {currentPatient?.isBlocked ? "Unblock" : "Block User"}
                                        </button>
                                        <button className="p-2.5 bg-zinc-50 text-zinc-500 rounded-xl hover:bg-zinc-100 transition-colors">
                                            <User className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Messages Area */}
                                <div 
                                    ref={scrollRef} 
                                    className="flex-1 overflow-y-auto p-8 space-y-6 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] custom-scrollbar"
                                >
                                    {currentChats.map((c, i) => (
                                        <div key={i} className={`flex flex-col ${c.isFromPatient ? 'items-start' : 'items-end'} animate-in slide-in-from-bottom-2 duration-300`}>
                                            <div className={`max-w-[70%] p-4 shadow-sm ${
                                                c.isFromPatient 
                                                    ? 'bg-white border border-zinc-100 text-zinc-800 rounded-2xl rounded-tl-none' 
                                                    : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl rounded-tr-none shadow-emerald-500/10'
                                            }`}>
                                                <p className="text-[14px] font-medium leading-relaxed whitespace-pre-wrap">{c.message}</p>
                                            </div>
                                            <div className={`flex items-center gap-2 mt-1.5 px-1 ${c.isFromPatient ? 'flex-row' : 'flex-row-reverse'}`}>
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">
                                                    {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                {!c.isFromPatient && <div className="w-3 h-3 text-emerald-500 bg-emerald-50 rounded-full p-0.5"><CheckCircle2 className="w-full h-full" /></div>}
                                            </div>
                                        </div>
                                    ))}
                                    {currentPatient?.isBlocked && (
                                        <div className="flex justify-center">
                                            <div className="bg-red-50 border border-red-100 text-red-600 px-6 py-3 rounded-2xl text-[12px] font-bold flex items-center gap-2 shadow-sm">
                                                <Ban className="w-4 h-4" /> THIS USER IS BLOCKED FOR UNNECESSARY MESSAGES
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Input Area */}
                                <div className="p-6 bg-white/50 backdrop-blur-md border-t border-zinc-100">
                                    <form onSubmit={handleSendMessage} className="relative flex items-end gap-3 max-w-4xl mx-auto">
                                        <div className="flex-1 relative group">
                                            <textarea
                                                value={message}
                                                onChange={e => setMessage(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSendMessage(e as any);
                                                    }
                                                }}
                                                placeholder={currentPatient?.isBlocked ? "Patient is blocked. Unblock to reply." : "Write your response here..."}
                                                disabled={currentPatient?.isBlocked}
                                                rows={1}
                                                className={`w-full pl-6 pr-14 py-4 bg-zinc-50 border border-zinc-200 rounded-3xl text-[14px] focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-400 transition-all resize-none shadow-inner ${currentPatient?.isBlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            />
                                            <button 
                                                type="submit" 
                                                disabled={!message.trim() || currentPatient?.isBlocked}
                                                className={`absolute right-2.5 bottom-2.5 w-9 h-9 flex items-center justify-center rounded-2xl transition-all ${
                                                    message.trim() && !currentPatient?.isBlocked
                                                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95' 
                                                        : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                                                }`}
                                            >
                                                <Send className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </form>
                                    <p className="text-center text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-4 opacity-50">
                                        End-to-end encrypted hospital communication
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 p-12 text-center">
                                <div className="w-32 h-32 bg-zinc-50 rounded-[48px] flex items-center justify-center mb-6 relative">
                                    <div className="absolute inset-0 bg-emerald-500/5 rounded-[48px] animate-pulse" />
                                    <MessageSquare className="w-16 h-16 text-zinc-200" />
                                </div>
                                <h4 className="text-xl font-black text-zinc-900 mb-2 tracking-tight">Your Inbox</h4>
                                <p className="text-[14px] font-medium text-zinc-500 max-w-xs leading-relaxed">
                                    Select a patient from the left to start a professional conversation and assist them with their enquiries.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (user?.role === 'Receptionist') return null;

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-500 text-white rounded-full shadow-xl shadow-emerald-500/20 flex items-center justify-center hover:bg-emerald-600 transition-all active:scale-95 z-[999]"
            >
                {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
            </button>

            {isOpen && (
                <div className="fixed bottom-24 right-6 w-80 sm:w-96 h-[500px] bg-white border border-zinc-200 rounded-[24px] shadow-2xl overflow-hidden flex flex-col z-[999] animate-in slide-in-from-bottom-4 duration-300">
                    <div className={`p-4 ${isBlockedByAdmin ? 'bg-red-500' : 'bg-emerald-500'} text-white flex items-center gap-3`}>
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            {isBlockedByAdmin ? <Ban className="w-5 h-5" /> : <Headset className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="text-[15px] font-bold leading-tight">{isBlockedByAdmin ? 'Chat Suspended' : 'Enquiry Desk'}</h3>
                            <p className="text-[11px] opacity-80 font-medium">{isBlockedByAdmin ? 'Action required' : 'Receptionist is online'}</p>
                        </div>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FDFDFD]">
                        {isBlockedByAdmin ? (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                                    <AlertTriangle className="w-8 h-8" />
                                </div>
                                <h4 className="text-red-600 font-bold mb-2">You have been blocked</h4>
                                <p className="text-[12px] text-zinc-500 font-medium">Your access to the enquiry desk has been suspended due to unnecessary or repetitive messages.</p>
                                <Button variant="secondary" size="sm" className="mt-6" onClick={() => setIsOpen(false)}>Close Chat</Button>
                            </div>
                        ) : (
                            <>
                                {chats.length === 0 && (
                                    <div className="py-10 text-center px-6">
                                        <p className="text-[12px] text-zinc-500 leading-relaxed font-medium">Hello {user?.fullName?.split(' ')[0]}! 👋 <br/> How can we help you today?</p>
                                    </div>
                                )}
                                {chats.map((c, i) => (
                                    <div key={i} className={`flex ${c.isFromPatient ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-3 rounded-2xl text-[13px] ${c.isFromPatient ? 'bg-emerald-500 text-white rounded-tr-none' : 'bg-zinc-100 text-zinc-800 rounded-tl-none'}`}>
                                            {!c.isFromPatient && <p className="text-[10px] font-bold text-emerald-600 mb-1">{c.receptionistName}</p>}
                                            <p className="font-medium leading-relaxed">{c.message}</p>
                                            <p className={`text-[9px] mt-1 opacity-60 ${c.isFromPatient ? 'text-emerald-50' : 'text-zinc-500'}`}>
                                                {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>

                    {!isBlockedByAdmin && (
                        <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-100 flex gap-2 bg-white">
                            <input
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="Ask something..."
                                className="flex-1 px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-[13px] focus:outline-none focus:border-emerald-400 transition-colors"
                            />
                            <button type="submit" className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-colors">
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    )}
                </div>
            )}
        </>
    );
};

