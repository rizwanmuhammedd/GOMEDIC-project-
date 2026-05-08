import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, Sparkles, Brain, Shield, Info, Loader2, User } from 'lucide-react';
import { Button } from '../ui';
import { useAuth } from '../../context/AuthContext';
import Groq from "groq-sdk";

interface Message {
    id: string;
    role: 'user' | 'ai';
    text: string;
    timestamp: Date;
}

// Initialize Groq API
const apiKey = (import.meta.env.VITE_GROQ_API_KEY || '').trim();
const groq = apiKey ? new Groq({ apiKey: apiKey, dangerouslyAllowBrowser: true }) : null;

export const AIChat = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    const { user } = useAuth();
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'ai',
            text: `Hello ${user?.fullName?.split(' ')[0] || 'there'}! I'm GOMEDIC's AI Health Assistant. How can I help you with your medical questions today?\n\n*Note: This is an AI assistant for information only. In case of emergency, please call 911 or visit the nearest ER.*`,
            timestamp: new Date()
        }
    ]);
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const content = message.trim();
        if (!content || loading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            text: content,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setMessage('');
        setLoading(true);

        // 1. Check browser online status
        if (!window.navigator.onLine) {
            setMessages(prev => [...prev, {
                id: Date.now().toString() + 'off',
                role: 'ai',
                text: "You appear to be offline. Please check your internet connection and try again.",
                timestamp: new Date()
            }]);
            setLoading(false);
            return;
        }

        try {
            if (!groq) {
                throw new Error("Missing API Key");
            }

            const apiMessages = [
                { 
                    role: "system", 
                    content: "You are GOMEDIC's Advanced AI Medical Assistant. You provide helpful, accurate, and professional medical information. Always maintain a clinical but empathetic tone. Remind patients that you are an AI and they should consult doctors for serious concerns. Keep responses concise and formatted nicely." 
                },
                ...messages.map(m => ({
                    role: m.role === 'ai' ? 'assistant' : 'user',
                    content: m.text
                })),
                { role: "user", content: content }
            ];

            const chatCompletion = await groq.chat.completions.create({
                messages: apiMessages as any,
                model: "llama-3.3-70b-versatile",
                temperature: 0.7,
                max_tokens: 1024,
            });

            const responseText = chatCompletion.choices[0]?.message?.content;

            if (!responseText) throw new Error("Empty response");

            const aiMsg: Message = {
                id: Date.now().toString() + 'ai',
                role: 'ai',
                text: responseText,
                timestamp: new Date()
            };
            
            setMessages(prev => [...prev, aiMsg]);
        } catch (error: any) {
            console.error("AI Error Details:", error);
            let errorText = "I'm sorry, I'm having trouble connecting to my medical database right now. Please try again in a few moments.";
            
            if (error.message?.includes("Missing API Key") || error.message?.includes("401") || error.message?.includes("authentication")) {
                errorText = "AI CONFIGURATION ERROR: Please add your free VITE_GROQ_API_KEY to the .env file. You can get one instantly at console.groq.com.";
            }

            setMessages(prev => [...prev, {
                id: Date.now().toString() + 'err',
                role: 'ai',
                text: errorText,
                timestamp: new Date()
            }]);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-[600px] h-[80vh] bg-white rounded-[32px] shadow-[0_32px_120px_rgba(0,0,0,0.2)] border border-zinc-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                
                {/* AI Header */}
                <div className="px-8 py-6 border-b border-zinc-100 bg-gradient-to-r from-emerald-600 to-teal-700 text-white relative">
                    <div className="absolute top-0 right-0 p-12 opacity-10">
                        <Sparkles className="w-32 h-32" />
                    </div>
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                                <Bot className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black tracking-tight leading-none">Smart Assistant</h2>
                                <div className="flex items-center gap-1.5 mt-1.5">
                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                    <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest">Medical Logic Engine Active</p>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 bg-zinc-50/50 custom-scrollbar">
                    {messages.map((m) => (
                        <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                            <div className={`max-w-[85%] p-4 shadow-sm rounded-2xl ${
                                m.role === 'user' 
                                    ? 'bg-zinc-900 text-white rounded-tr-none' 
                                    : 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-none'
                            }`}>
                                {m.role === 'ai' && (
                                    <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                                        <Sparkles className="w-3 h-3" /> AI Consultation
                                    </div>
                                )}
                                <p className="text-[14px] font-medium leading-relaxed whitespace-pre-wrap">{m.text}</p>
                            </div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter mt-1.5 px-1">
                                {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex items-start gap-3 animate-pulse">
                            <div className="p-3 bg-white border border-zinc-200 rounded-2xl rounded-tl-none">
                                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Info Alert */}
                <div className="px-8 py-3 bg-emerald-50/50 border-t border-zinc-100 flex items-center gap-3">
                    <Info className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <p className="text-[10px] text-emerald-800 font-medium">This assistant provides general health guidance and does not replace professional medical advice.</p>
                </div>

                {/* Input Area */}
                <div className="p-6 bg-white border-t border-zinc-100">
                    <form onSubmit={handleSend} className="relative flex items-center gap-3">
                        <div className="flex-1 relative group">
                            <input
                                type="text"
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="Ask about symptoms, diet, or general health..."
                                className="w-full pl-6 pr-14 py-4 bg-zinc-50 border border-zinc-200 rounded-[20px] text-[14px] font-medium focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all shadow-inner"
                            />
                            <button 
                                type="submit" 
                                disabled={!message.trim() || loading}
                                className={`absolute right-2 bottom-2 w-10 h-10 flex items-center justify-center rounded-2xl transition-all ${
                                    message.trim() && !loading
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:scale-105 active:scale-95' 
                                        : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                                }`}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
