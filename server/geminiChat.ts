import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import crypto from 'crypto';
import { db, getServices, getSiteSettings } from './db';
import { formatRupiah, matchFaqFallbackAnswer } from '../src/lib/laundryRules';

export interface ChatTurn {
  role: 'user' | 'assistant';
  message: string;
}

export async function generateAssistantReply(params: {
  sessionId: string;
  message: string;
  history: ChatTurn[];
}): Promise<{ reply: string; source: 'gemini' | 'faq-fallback' }> {
  const cleanMessage = params.message.trim();
  const services = getServices(false);
  const settings = getSiteSettings();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO chatbot_conversations (id, session_id, role, message, source, created_at)
     VALUES (?, ?, 'user', ?, 'client', ?)`
  ).run(crypto.randomUUID(), params.sessionId, cleanMessage, now);

  const apiKey = process.env.GEMINI_API_KEY;
  let replyText = '';
  let source: 'gemini' | 'faq-fallback' = 'faq-fallback';

  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 10) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const priceLines = services
        .map((s) => `- ${s.name}: ${formatRupiah(s.pricePerKg)}/kg (${s.description}, estimasi ${s.estimatedDuration})`)
        .join('\n');

      const systemInstruction = `Kamu adalah "Huzavin AI Assistant", asisten pelanggan resmi untuk ${settings.businessName}.
Sifatmu: ramah, sopan, membantu, berbicara Bahasa Indonesia yang santun dan ringkas (2–4 kalimat).

Informasi Resmi ${settings.businessName} (JANGAN mengarang di luar data ini):
- Slogan: "${settings.sloganMain}" dan "${settings.sloganSecondary}"
- Daftar Layanan & Harga Saat Ini:
${priceLines}
- Minimal order: 1 kg (mendukung berat desimal setelah penimbangan akhir, misalnya 1,5 kg atau 2,5 kg).
- Estimasi pengerjaan: 1–2 hari.
- Antar jemput: GRATIS antar jemput laundry untuk area layanan Sawangan, Pasir Putih, dan sekitarnya.
- Alamat lengkap: ${settings.address}
- WhatsApp Admin: ${settings.whatsappDisplay}
- Cara pesan: Pelanggan bisa mengisi formulir "Buat Pesanan Sekarang" di website untuk mendapatkan Kode Order otomatis (format HZV-YYYYMM-XXXX) dan mengirim konfirmasi ke WhatsApp admin, atau langsung chat WhatsApp admin.
- Cara cek status cucian: Masukkan Kode Order di menu "Lacak Cucian Kamu" / "Cek Status" pada website untuk melihat progres 10 tahap secara real-time.

Aturan ketat:
1. Jika pertanyaan di luar informasi resmi di atas atau menanyakan promo/diskon khusus/keluhan order pribadi, JANGAN mengarang jawaban. Arahkan pelanggan dengan ramah untuk menekan tombol "CHAT ADMIN" agar terhubung ke WhatsApp admin ${settings.whatsappDisplay}.
2. Gunakan format Rupiah yang jelas (contoh: Rp7.000/kg, Rp10.000/kg).`;

      const recentHistory = params.history
        .slice(-6)
        .map((turn) => `${turn.role === 'user' ? 'Pelanggan' : 'Huzavin AI'}: ${turn.message}`)
        .join('\n');

      const prompt = recentHistory
        ? `Riwayat percakapan:\n${recentHistory}\n\nPertanyaan terbaru pelanggan: ${cleanMessage}`
        : cleanMessage;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      if (response.text && response.text.trim().length > 0) {
        replyText = response.text.trim();
        source = 'gemini';
      }
    } catch (error) {
      console.warn('[Huzavin AI] Falling back to deterministic FAQ matcher:', error instanceof Error ? error.message : error);
    }
  }

  if (!replyText) {
    replyText = matchFaqFallbackAnswer(cleanMessage, services, settings);
    source = 'faq-fallback';
  }

  db.prepare(
    `INSERT INTO chatbot_conversations (id, session_id, role, message, source, created_at)
     VALUES (?, ?, 'assistant', ?, ?, ?)`
  ).run(crypto.randomUUID(), params.sessionId, replyText, source, new Date().toISOString());

  return { reply: replyText, source };
}
