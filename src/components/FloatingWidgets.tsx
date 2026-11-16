import { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, UserCheck, X } from 'lucide-react';
import { buildGeneralWhatsappUrl } from '../lib/laundryRules';
import type { SiteSettings } from '../lib/laundryRules';

interface FloatingWidgetsProps {
  settings: SiteSettings;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const QUICK_PROMPTS = [
  'Berapa harga Cuci Setrika?',
  'Minimal order berapa kg?',
  'Apakah gratis antar jemput?',
  'Di mana lokasi Huzavin?',
];

export function FloatingWidgets({ settings }: FloatingWidgetsProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      text: 'Halo! Saya Huzavin AI Assistant. Ada yang bisa saya bantu seputar harga laundry, layanan antar jemput gratis, cara order, atau cek status cucian?',
    },
  ]);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const whatsappUrl = buildGeneralWhatsappUrl(settings.whatsappRaw);

  useEffect(() => {
    if (chatOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sending, chatOpen]);

  async function sendMessage(textToSend: string) {
    const clean = textToSend.trim();
    if (!clean || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: clean,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInputText('');
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: clean,
          history: nextHistory.map((m) => ({ role: m.role, message: m.text })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: `Maaf, asisten sedang sibuk. Silakan klik tombol "CHAT ADMIN" untuk langsung terhubung ke WhatsApp ${settings.whatsappDisplay}.`,
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: String(data.reply),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: `Koneksi sedang bermasalah. Anda tetap dapat menghubungi admin kami langsung via tombol "CHAT ADMIN" (${settings.whatsappDisplay}).`,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Chatbot Drawer */}
      {chatOpen && (
        <section
          aria-label="Huzavin AI Assistant"
          className="fixed bottom-20 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-3xl bg-white border border-sky-200 shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        >
          {/* Chat Header */}
          <div className="bg-sky-600 text-white px-4 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-bold text-sm leading-tight truncate">
                  Huzavin AI Assistant
                </h3>
                <p className="text-[11px] text-sky-100 truncate">Tanya harga, pickup &amp; tracking</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold transition-colors whitespace-nowrap"
              >
                <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                CHAT ADMIN
              </a>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                aria-label="Tutup Huzavin AI Assistant"
                className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8FBFF]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === 'user'
                      ? 'bg-sky-600 text-white rounded-br-sm'
                      : 'bg-white border border-sky-100 text-slate-800 rounded-bl-sm shadow-2xs'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-white border border-sky-100 px-3.5 py-2.5 text-xs text-slate-500">
                  Huzavin AI sedang mengetik...
                </div>
              </div>
            )}

            <div ref={scrollEndRef} />
          </div>

          {/* Quick FAQ Prompts */}
          <div className="px-3 py-2 bg-white border-t border-sky-100 flex items-center gap-1.5 overflow-x-auto">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(inputText);
            }}
            className="p-3 bg-white border-t border-sky-100 flex items-center gap-2"
          >
            <label htmlFor="chatbot-input" className="sr-only">
              Tulis pertanyaan untuk Huzavin AI Assistant
            </label>
            <input
              id="chatbot-input"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ketik pertanyaan Anda..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-sky-500 outline-none text-sm"
            />
            <button
              type="submit"
              disabled={sending || !inputText.trim()}
              aria-label="Kirim pesan"
              className="w-10 h-10 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white flex items-center justify-center shrink-0 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      )}

      {/* Compact Bottom-Right Floating Action Dock */}
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setChatOpen((prev) => !prev)}
          aria-expanded={chatOpen}
          className="inline-flex items-center gap-2 h-11 px-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-sky-600/25 transition-all hover:-translate-y-0.5 whitespace-nowrap"
        >
          <Bot className="w-4 h-4" aria-hidden="true" />
          <span>Tanya Huzavin AI</span>
        </button>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat WhatsApp Laundry Huzavin"
          className="inline-flex items-center gap-2 h-11 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/25 transition-all hover:-translate-y-0.5 whitespace-nowrap"
        >
          <MessageCircle className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">WhatsApp</span>
        </a>
      </div>
    </>
  );
}
