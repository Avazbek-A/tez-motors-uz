"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mic, MicOff, Play, Pause, Square, Save, Search, User, Phone,
  Clock, ArrowLeft, Check, Calendar, Loader2, Sparkles, Plus, Trash,
  PhoneCall, PhoneOff, CheckSquare, MessageCircle, AlertCircle, RefreshCw,
  Send, Sparkle, ShieldAlert, Award, Smile, Info, BookOpen
} from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";
import { AudioPlayer } from "@/components/admin/audio-player";

/**
 * Pick a recording MIME the browser actually supports. CRITICAL for iOS/Safari
 * (and all iPhone browsers, incl. "Chrome", which are WebKit): they do NOT support
 * audio/webm in MediaRecorder — recordings come out empty/unplayable if you force
 * webm. We probe in preference order and fall back to audio/mp4 on Apple devices.
 * Returns "" if nothing matches (let MediaRecorder pick its own default).
 */
function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", "audio/mpeg"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

interface Customer {
  key: string;
  phone: string;
  name: string | null;
  email: string | null;
  tier: string;
}

interface TeamMember {
  id: string;
  email: string;
  role: string;
}

const COPY: Record<Locale, {
  title: string;
  back: string;
  searchPlaceholder: string;
  clientName: string;
  clientPhone: string;
  direction: string;
  inbound: string;
  outbound: string;
  pipelineStage: string;
  assignee: string;
  notes: string;
  followUp: string;
  followUpShortcut: string;
  save: string;
  saving: string;
  recording: string;
  tapToRecord: string;
  unsupportedSpeech: string;
  permissionBlocked: string;
  successLogged: string;
  playRecording: string;
  pauseRecording: string;
  deleteRecording: string;
  newClientLabel: string;
  dialerTab: string;
  callTab: string;
  aiDialerTab: string;
  dialPlaceholder: string;
  activeCallTitle: string;
  activeAiCallTitle: string;
  mute: string;
  unmute: string;
  endCall: string;
  pipelineStages: Record<string, string>;
  repLabels: Record<string, string>;
  autopilotTitle: string;
  aiInsights: string;
  entitiesTitle: string;
  complianceTitle: string;
  sentimentTitle: string;
  draftTitle: string;
  sendDraft: string;
  sendingDraft: string;
  draftSent: string;
  voiceMatchAlertTitle: string;
}> = {
  ru: {
    title: "Мобильный VoIP и регистратор",
    back: "Назад",
    searchPlaceholder: "Поиск по имени или телефону...",
    clientName: "Имя клиента",
    clientPhone: "Телефон клиента",
    direction: "Направление",
    inbound: "Входящий",
    outbound: "Исходящий",
    pipelineStage: "Этап воронки",
    assignee: "Ответственный менеджер",
    notes: "Заметки к звонку",
    followUp: "Запланировать следующий контакт",
    followUpShortcut: "Быстрый выбор",
    save: "Сохранить и анализировать",
    saving: "Анализируем звонок через ИИ...",
    recording: "Идет запись...",
    tapToRecord: "Нажмите для начала записи",
    unsupportedSpeech: "Распознавание речи не поддерживается. Вы можете ввести текст вручную.",
    permissionBlocked: "Доступ к микрофону заблокирован.",
    successLogged: "Звонок успешно сохранен в CRM!",
    playRecording: "Воспроизвести запись",
    pauseRecording: "Пауза",
    deleteRecording: "Удалить аудиозапись",
    newClientLabel: "Новый клиент",
    dialerTab: "Клавиатура",
    callTab: "Регистрация",
    aiDialerTab: "ИИ-Обзвон",
    dialPlaceholder: "Введите номер телефона...",
    activeCallTitle: "Разговор по VoIP...",
    activeAiCallTitle: "ИИ-Обзвон в процессе...",
    mute: "Выкл. микрофон",
    unmute: "Вкл. микрофон",
    endCall: "Завершить",
    pipelineStages: { new: "Новый", contacted: "Связались", in_progress: "В работе", closed: "Закрыт" },
    repLabels: { owner: "Владелец", manager: "Менеджер", rep: "Продавец" },
    autopilotTitle: "Автопилот ИИ и Отчетность",
    aiInsights: "Анализ звонка ИИ",
    entitiesTitle: "Извлеченные сущности",
    complianceTitle: "Контроль качества (Скрипт)",
    sentimentTitle: "Эмоциональный фон",
    draftTitle: "Авто-ответ клиенту в Telegram/WhatsApp",
    sendDraft: "Отправить сообщение клиенту",
    sendingDraft: "Отправка сообщения...",
    draftSent: "Сообщение отправлено клиенту!",
    voiceMatchAlertTitle: "Внимание: Голосовое совпадение",
  },
  uz: {
    title: "Mobil VoIP va yozuvchi",
    back: "Orqaga",
    searchPlaceholder: "Ism yoki telefon bo'yicha qidiruv...",
    clientName: "Mijoz ismi",
    clientPhone: "Mijoz telefoni",
    direction: "Yo'nalish",
    inbound: "Kiruvchi",
    outbound: "Chiquvchi",
    pipelineStage: "Voronka bosqichi",
    assignee: "Mas'ul menejer",
    notes: "Eslatmalar",
    followUp: "Keyingi kontaktni rejalashtirish",
    followUpShortcut: "Tezkor tanlov",
    save: "Saqlash va tahlil qilish",
    saving: "Ovoz tahlil qilinmoqda...",
    recording: "Yozib olinmoqda...",
    tapToRecord: "Yozishni boshlash uchun bosing",
    unsupportedSpeech: "Ovozni aniqlash qo'llab-quvvatlanmaydi. Matnni qo'lda kiriting.",
    permissionBlocked: "Mikrofon ruxsati rad etilgan.",
    successLogged: "Qo'ng'iroq CRM-ga saqlandi!",
    playRecording: "Tinglash",
    pauseRecording: "Pauza",
    deleteRecording: "Yozuvni o'chirish",
    newClientLabel: "Yangi mijoz",
    dialerTab: "Klaviatura",
    callTab: "Ro‘yxatdan o‘tkazish",
    aiDialerTab: "AI-Obzvon",
    dialPlaceholder: "Telefon raqamini kiriting...",
    activeCallTitle: "VoIP suhbati...",
    activeAiCallTitle: "AI-Obzvon jarayonda...",
    mute: "Ovozni o'chirish",
    unmute: "Ovozni yoqish",
    endCall: "Yakunlash",
    pipelineStages: { new: "Yangi", contacted: "Bog‘lanildi", in_progress: "Jarayonda", closed: "Yopildi" },
    repLabels: { owner: "Ega", manager: "Menejer", rep: "Sotuvchi" },
    autopilotTitle: "AI Avtopilot & Xulosa",
    aiInsights: "AI Qo'ng'iroq Tahlili",
    entitiesTitle: "Aniqlangan ma'lumotlar",
    complianceTitle: "Sifat nazorati (Skript)",
    sentimentTitle: "Hissiy holat",
    draftTitle: "Telegram/WhatsApp avto-xabar loyihasi",
    sendDraft: "Mijozga xabar yuborish",
    sendingDraft: "Yuborilmoqda...",
    draftSent: "Xabar mijozga yuborildi!",
    voiceMatchAlertTitle: "Diqqat: Ovozli o'xshashlik",
  },
  en: {
    title: "Mobile VoIP & Recorder",
    back: "Back",
    searchPlaceholder: "Search name or phone...",
    clientName: "Client Name",
    clientPhone: "Client Phone",
    direction: "Direction",
    inbound: "Inbound",
    outbound: "Outbound",
    pipelineStage: "Pipeline Stage",
    assignee: "Assigned Rep",
    notes: "Call Notes",
    followUp: "Schedule Follow-up Task",
    followUpShortcut: "Quick Select",
    save: "Save & Analyze",
    saving: "AI analyzing call transcript...",
    recording: "Recording call...",
    tapToRecord: "Tap microphone to record",
    unsupportedSpeech: "Speech recognition not supported. Please type notes manually.",
    permissionBlocked: "Microphone permission is blocked.",
    successLogged: "Call successfully logged into CRM!",
    playRecording: "Play recording",
    pauseRecording: "Pause",
    deleteRecording: "Delete recording",
    newClientLabel: "New Client",
    dialerTab: "Keypad",
    callTab: "Registration",
    aiDialerTab: "AI Agent",
    dialPlaceholder: "Enter phone number...",
    activeCallTitle: "Active VoIP Call...",
    activeAiCallTitle: "AI Agent Calling...",
    mute: "Mute Mic",
    unmute: "Unmute Mic",
    endCall: "End Call",
    pipelineStages: { new: "New", contacted: "Contacted", in_progress: "In Progress", closed: "Closed" },
    repLabels: { owner: "Owner", manager: "Manager", rep: "Rep" },
    autopilotTitle: "AI Autopilot & Actions",
    aiInsights: "AI Call Analysis",
    entitiesTitle: "Extracted Entities",
    complianceTitle: "Quality Assurance (Script)",
    sentimentTitle: "Customer Sentiment",
    draftTitle: "Auto-Draft Client Message (TG/WA)",
    sendDraft: "Send Message to Client",
    sendingDraft: "Sending message...",
    draftSent: "Message sent to customer!",
    voiceMatchAlertTitle: "Warning: Voice Fingerprint Match",
  },
};

const CAR_SPECS: Record<string, { model: string; price: string; range: string; battery: string; drive: string }> = {
  byd_song: { model: "BYD Song Plus DM-i", price: "$24,500 - $28,900", range: "1,050 km (DM-i hybrid)", battery: "18.3 kWh / 26.6 kWh", drive: "FWD / AWD" },
  byd_han: { model: "BYD Han EV", price: "$32,000 - $39,500", range: "610 km / 715 km EV", battery: "72.0 kWh / 85.4 kWh", drive: "AWD / FWD" },
  byd_seagull: { model: "BYD Seagull (Dolphin Mini)", price: "$12,800 - $14,900", range: "305 km / 405 km EV", battery: "30.08 kWh / 38.88 kWh", drive: "FWD" },
  chery_tiggo: { model: "Chery Tiggo 8 Pro Max", price: "$26,000 - $31,500", range: "Gasoline (9.5L / 100km)", battery: "N/A", drive: "AWD" },
  geely_monjaro: { model: "Geely Monjaro 2.0T", price: "$29,900 - $34,800", range: "Gasoline (8.8L / 100km)", battery: "N/A", drive: "AWD" },
};

export default function MobileCallRecorder() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const router = useRouter();

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<"dialer" | "form" | "ai-dialer">("dialer");
  
  // Call Session State
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // VoIP Dialer and Local Recorder States
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);

  // Call Data States
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<"inbound" | "outbound">("outbound");
  const [pipelineStatus, setPipelineStatus] = useState<"new" | "contacted" | "in_progress" | "closed">("contacted");
  const [assignedTo, setAssignedTo] = useState("");
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState("");

  // Follow-up task states
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");

  // Customer Autocomplete states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Team list state
  const [team, setTeam] = useState<TeamMember[]>([]);

  // UI status states
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [micError, setMicError] = useState(false);

  // Audio recording player state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Post-Call AI Autopilot States
  const [aiAnalysis, setAiAnalysis] = useState<any | null>(null);
  const [isAutopilotOpen, setIsAutopilotOpen] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [isSendingDraft, setIsSendingDraft] = useState(false);
  const [draftSent, setDraftSent] = useState(false);
  const [voiceMatchAlert, setVoiceMatchAlert] = useState<string | null>(null);

  // Real-Time Copilot Coach States
  const [copilotActive, setCopilotActive] = useState(true);
  const [copilotSuggestion, setCopilotSuggestion] = useState("");
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  
  // Real-time compliance flags
  const [greetingCheck, setGreetingCheck] = useState(false);
  const [testDriveCheck, setTestDriveCheck] = useState(false);
  const [warrantyCheck, setWarrantyCheck] = useState(false);
  const [followUpCheck, setFollowUpCheck] = useState(false);
  const [modelDetected, setModelDetected] = useState<string | null>(null);

  // AI Outbound Agent Simulation states
  const [isAiCallSimulating, setIsAiCallSimulating] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [aiAgentModel, setAiAgentModel] = useState("byd_song");
  const [aiAgentLang, setAiAgentLang] = useState("ru");
  const [aiChatHistory, setAiChatHistory] = useState<{ speaker: "AI" | "Client"; text: string }[]>([]);
  const [aiAgentTyping, setAiAgentTyping] = useState(false);
  const [clientResponseText, setClientResponseText] = useState("");

  // Next-Gen CRM VoIP & AI Call Center upgrades (v4) states
  const [campaignAgent, setCampaignAgent] = useState<"qualifier" | "scheduler" | "closer">("qualifier");
  const [sentiment, setSentiment] = useState<"neutral" | "positive" | "friction">("neutral");
  const [suggestedDiscount, setSuggestedDiscount] = useState<number | null>(null);
  
  // B2B supplier sourcing states
  const [sourcingLogs, setSourcingLogs] = useState<string[] | null>(null);
  const [sourcingResults, setSourcingResults] = useState<any | null>(null);
  const [isSourcingLoading, setIsSourcingLoading] = useState(false);

  // 3D showroom visual push states
  const [showShowroomModal, setShowShowroomModal] = useState(false);
  const [showroomColor, setShowroomColor] = useState("Space Black");
  const [showroomRot, setShowroomRot] = useState(0);

  // Vocal Friction Indicator states
  const [vocalFriction, setVocalFriction] = useState(0);
  const [vocalFrictionLevel, setVocalFrictionLevel] = useState<"green" | "yellow" | "red">("green");

  // Voice clone trainer widget states
  const [voiceCloneRecording, setVoiceCloneRecording] = useState(false);
  const [voiceCloneBlob, setVoiceCloneBlob] = useState<Blob | null>(null);
  const [voiceCloneSuccess, setVoiceCloneSuccess] = useState(false);
  const [voiceCloneSaving, setVoiceCloneSaving] = useState(false);
  const [voiceCloneAudioUrl, setVoiceCloneAudioUrl] = useState<string | null>(null);
  const [voiceCloneName, setVoiceCloneName] = useState("");

  // Collateral brochure compiler states
  const [brochureUrl, setBrochureUrl] = useState<string | null>(null);
  const [compilingBrochure, setCompilingBrochure] = useState(false);

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<any | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const copilotThrottleRef = useRef<number>(0);

  // Load team list and check speech support
  useEffect(() => {
    async function loadTeam() {
      try {
        const res = await fetch("/api/admin/team");
        const data = await res.json();
        setTeam(data.team || []);
        if (data.team?.length > 0) {
          setAssignedTo(data.team[0].id);
        }
      } catch (err) {
        console.error("Failed to load team:", err);
      }
    }
    loadTeam();

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setSpeechSupported(false);
    }
  }, []);

  // Handle client search autocomplete
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.customers || []);
      } catch (err) {
        console.error("Failed to fetch autocomplete clients:", err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Real-time compliance and copilot trigger hook
  useEffect(() => {
    if (!transcript) return;
    const txt = transcript.toLowerCase();

    // 1. Client-side Compliance Script audits
    if (/tez\s*motors/i.test(txt) && !greetingCheck) setGreetingCheck(true);
    if ((/тест[- ]драйв/i.test(txt) || /sinov/i.test(txt) || /test drive/i.test(txt)) && !testDriveCheck) setTestDriveCheck(true);
    if ((/гаранти/i.test(txt) || /kafolat/i.test(txt) || /warranty/i.test(txt)) && !warrantyCheck) setWarrantyCheck(true);
    if ((/завтра/i.test(txt) || /ertaga/i.test(txt) || /tomorrow/i.test(txt) || /созвон/i.test(txt) || /понедельник/i.test(txt)) && !followUpCheck) setFollowUpCheck(true);

    // 2. Car model keyword spec triggers
    if (/song/i.test(txt) && modelDetected !== "byd_song") setModelDetected("byd_song");
    else if (/han/i.test(txt) && modelDetected !== "byd_han") setModelDetected("byd_han");
    else if ((/seagull/i.test(txt) || /mini/i.test(txt)) && modelDetected !== "byd_seagull") setModelDetected("byd_seagull");
    else if (/tiggo/i.test(txt) && modelDetected !== "chery_tiggo") setModelDetected("chery_tiggo");
    else if (/monjaro/i.test(txt) && modelDetected !== "geely_monjaro") setModelDetected("geely_monjaro");

    // 3. Live Sales Copilot Coach trigger (Throttled to once every 8 seconds to prevent spam)
    if (copilotActive && !isCallActive && !isAiCallSimulating) {
      const now = Date.now();
      if (now - copilotThrottleRef.current > 8000) {
        copilotThrottleRef.current = now;
        triggerCopilotSuggestion();
      }
    }
  }, [transcript, copilotActive, isCallActive, isAiCallSimulating]);

  const triggerCopilotSuggestion = async () => {
    setIsCopilotLoading(true);
    try {
      const res = await fetch("/api/admin/calls/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (data.suggestion) {
        setCopilotSuggestion(data.suggestion);
      }
    } catch (err) {
      console.error("Failed to query live sales coach:", err);
    } finally {
      setIsCopilotLoading(false);
    }
  };

  // Clean up all resources when component unmounts
  useEffect(() => {
    return () => {
      cleanupRecordingResources();
    };
  }, []);

  const cleanupRecordingResources = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
    }
    if ((window as any)._simulatedTranscriptInterval) {
      clearInterval((window as any)._simulatedTranscriptInterval);
      (window as any)._simulatedTranscriptInterval = null;
    }
  };

  // Autocomplete select customer
  const handleSelectCustomer = (customer: Customer) => {
    setPhone(customer.phone);
    setName(customer.name || "");
    setSearchQuery("");
    setShowDropdown(false);
  };

  // VoIP Dialer functions
  const handleDialPadPress = (num: string) => {
    setPhone((prev) => prev + num);
  };

  const handleDialPadBackspace = () => {
    setPhone((prev) => prev.slice(0, -1));
  };

  // VoIP call start/stop
  const handleStartVoIpCall = async () => {
    if (!phone.trim()) return;
    setIsCallActive(true);
    setCallDuration(0);
    setAudioUrl(null);
    audioChunksRef.current = [];
    setTranscript("");
    
    // Reset compliance checks for new call session
    setGreetingCheck(false);
    setTestDriveCheck(false);
    setWarrantyCheck(false);
    setFollowUpCheck(false);
    setModelDetected(null);
    setCopilotSuggestion("");

    let stream: MediaStream | null = null;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (err) {
      console.warn("Microphone access blocked (possibly HTTP insecure context). Running simulated audio session:", err);
    }

    if (stream) {
      try {
        const mime = pickRecorderMime();
        const mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        mediaRecorder.onstop = () => {
          const type = mediaRecorder.mimeType || mime || "audio/mp4";
          const audioBlob = new Blob(audioChunksRef.current, { type });
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
        };
        mediaRecorder.start();
      } catch (err) {
        console.error("MediaRecorder setup failed:", err);
      }

      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        drawVisualizer();
      } catch (err) {
        console.error("Audio visualizer failed:", err);
      }

      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        const recognition = new SpeechRecognitionClass();
        speechRecognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        if (locale === "ru") recognition.lang = "ru-RU";
        else if (locale === "uz") recognition.lang = "uz-UZ";
        else recognition.lang = "en-US";

        let finalTranscript = "";
        recognition.onresult = (event: any) => {
          let interimTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + " ";
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          setTranscript(finalTranscript + interimTranscript);
        };
        recognition.start();
      }
    } else {
      // Fallback simulated call when microphone is blocked by mobile Safari over HTTP
      console.log("[VoIP Development Fallback]: Starting simulated VoIP call without microphone hardware.");
      analyserRef.current = null; // Forces visualizer to draw simulated random waves
      
      const simulatedDialogues = [
        "Здравствуйте! Да, меня интересует BYD Han.",
        "Какая цена в Ташкенте с учетом растаможки?",
        "А есть ли гарантия на батарею?",
        "Хорошо, запишите меня на тест-драйв на завтра."
      ];
      let idx = 0;
      const transcriptionInterval = setInterval(() => {
        if (idx < simulatedDialogues.length) {
          setTranscript((prev) => prev + " " + simulatedDialogues[idx]);
          idx++;
        } else {
          clearInterval(transcriptionInterval);
        }
      }, 5000);
      
      (window as any)._simulatedTranscriptInterval = transcriptionInterval;
      drawVisualizer();
    }

    timerIntervalRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const handleEndVoIpCall = () => {
    setIsCallActive(false);
    cleanupRecordingResources();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }

    setActiveTab("form");
  };

  const handleToggleMute = () => {
    if (!mediaRecorderRef.current) return;
    if (isMuted) {
      speechRecognitionRef.current?.start();
      setIsMuted(false);
    } else {
      speechRecognitionRef.current?.stop();
      setIsMuted(true);
    }
  };

  // Real-time Canvas audio visualization drawing loop
  const drawVisualizer = () => {
    if (!visualizerCanvasRef.current) return;
    const canvas = visualizerCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser ? analyser.frequencyBinCount : 32;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isCallActive && !isAiCallSimulating) return;
      animationFrameRef.current = requestAnimationFrame(draw);

      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
        // Calculate vocal friction score based on frequency amplitude average
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const score = Math.min(100, Math.max(0, Math.round(avg * 1.3)));
        setVocalFriction(score);
        if (score > 70) {
          setVocalFrictionLevel("red");
        } else if (score > 40) {
          setVocalFrictionLevel("yellow");
        } else {
          setVocalFrictionLevel("green");
        }
      } else {
        // Simulated frequency data for AI Outbound simulator
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = Math.floor(Math.random() * 150) + 30;
        }
        // Simulate fluctuations in vocal friction
        const simAvg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        const score = Math.min(100, Math.max(0, Math.round(simAvg * 0.4 + (Math.sin(Date.now() / 1500) * 15 + 20))));
        setVocalFriction(score);
        if (score > 70) {
          setVocalFrictionLevel("red");
        } else if (score > 40) {
          setVocalFrictionLevel("yellow");
        } else {
          setVocalFrictionLevel("green");
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 1.5;

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, "rgba(163, 230, 53, 0.1)");
        gradient.addColorStop(0.5, "rgba(163, 230, 53, 0.6)");
        gradient.addColorStop(1, "rgba(163, 230, 53, 1)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, canvas.height - barHeight, barWidth - 2, barHeight, [4, 4, 0, 0]);
        ctx.fill();

        x += barWidth + 1;
      }
    };

    draw();
  };

  // Local Memo audio recording states
  const startRecording = async () => {
    cleanupRecordingResources();
    setAudioUrl(null);
    audioChunksRef.current = [];
    setDuration(0);
    setMicError(false);
    setTranscript("");

    setGreetingCheck(false);
    setTestDriveCheck(false);
    setWarrantyCheck(false);
    setFollowUpCheck(false);
    setModelDetected(null);
    setCopilotSuggestion("");

    let stream: MediaStream;
    try {
      // In an insecure context (plain http on a LAN IP) the browser doesn't even
      // expose mediaDevices — guard so we surface a clear error instead of throwing.
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia unavailable — page is not a secure (HTTPS) context");
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("Microphone unavailable:", err);
      setMicError(true);
      return;
    }

    setIsRecording(true);

    try {
      const mime = pickRecorderMime();
      const mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        // Label the blob with the type the recorder ACTUALLY produced (mp4 on iOS),
        // not a hardcoded webm that Apple browsers refuse to play back.
        const type = mediaRecorder.mimeType || mime || "audio/mp4";
        const audioBlob = new Blob(audioChunksRef.current, { type });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };
      mediaRecorder.start();
    } catch (err) {
      console.error("MediaRecorder setup failed:", err);
    }

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      const recognition = new SpeechRecognitionClass();
      speechRecognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      if (locale === "ru") recognition.lang = "ru-RU";
      else if (locale === "uz") recognition.lang = "uz-UZ";
      else recognition.lang = "en-US";

      let finalTranscript = "";
      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + " ";
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setTranscript(finalTranscript + interimTranscript);
      };
      recognition.start();
    }

    timerIntervalRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    cleanupRecordingResources();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  // Autonomous AI Agent Outbound Simulator Script
  const handleStartAiOutboundCall = async () => {
    if (!phone.trim()) return;
    setIsAiCallSimulating(true);
    setCallDuration(0);
    setTranscript("");
    setSimStep(0);
    setAiChatHistory([]);
    setClientResponseText("");
    
    setGreetingCheck(true); // Greeted properly is checked off by default since AI starts
    setTestDriveCheck(false);
    setWarrantyCheck(false);
    setFollowUpCheck(false);
    setModelDetected(aiAgentModel);

    // Reset negotiation parameters
    setSentiment("neutral");
    setSuggestedDiscount(null);
    setBrochureUrl(null);

    // Binds simulated frequency bars
    setTimeout(() => {
      drawVisualizer();
    }, 100);

    // Start running simulated time duration
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    // Stream initial agent greeting from the selected agent type
    await streamAgentResponse([], "");
  };

  const handleSendClientResponse = async (customText?: string) => {
    const textToSend = (customText || clientResponseText).trim();
    if (!textToSend || aiAgentTyping) return;

    setClientResponseText("");
    
    // Append client response to transcript and history
    setTranscript((prev) => `${prev}\n[Customer]: ${textToSend}`);
    const updatedHistory = [...aiChatHistory, { speaker: "Client" as const, text: textToSend }];
    setAiChatHistory(updatedHistory);

    // Client-side key phrase check dynamically
    const lowerText = textToSend.toLowerCase();
    if (lowerText.includes("гаранти") || lowerText.includes("kafolat") || lowerText.includes("warranty")) {
      setWarrantyCheck(true);
    }
    if (lowerText.includes("тест") || lowerText.includes("sinov") || lowerText.includes("test")) {
      setTestDriveCheck(true);
    }
    if (lowerText.includes("суббот") || lowerText.includes("shanba") || lowerText.includes("завтра") || lowerText.includes("ertaga")) {
      setFollowUpCheck(true);
    }

    await streamAgentResponse(updatedHistory, textToSend);
  };

  const streamAgentResponse = async (history: { speaker: "AI" | "Client"; text: string }[], userMessage: string) => {
    setAiAgentTyping(true);
    try {
      const response = await fetch("/api/admin/calls/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history,
          model: aiAgentModel,
          language: aiAgentLang,
          user_message: userMessage,
          agent_type: campaignAgent // 'qualifier' | 'scheduler' | 'closer'
        })
      });

      if (!response.body) {
        throw new Error("No readable stream in response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = "";
      
      // We append AI Agent block start
      setTranscript((prev) => `${prev}\n[AI Agent (${campaignAgent})]: `);

      let aiTextAccumulator = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;
            if (cleanLine === "data: [DONE]") continue;

            if (cleanLine.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(cleanLine.substring(6));
                
                // Check if this chunk is metadata containing sentiment/discount info
                if (parsed.sentiment) {
                  setSentiment(parsed.sentiment);
                  if (parsed.suggested_discount) {
                    setSuggestedDiscount(parsed.suggested_discount);
                  }
                }
                
                // Or if it is a text chunk
                if (parsed.text) {
                  const textChunk = parsed.text;
                  aiTextAccumulator += textChunk;
                  setTranscript((prev) => prev + textChunk);
                }
              } catch (e) {
                // Incomplete JSON chunk, skip
              }
            }
          }
        }
      }

      // Add completed response to chat history
      if (aiTextAccumulator) {
        setAiChatHistory((prev) => [...prev, { speaker: "AI", text: aiTextAccumulator }]);

        const lowerReply = aiTextAccumulator.toLowerCase();
        if (lowerReply.includes("гаранти") || lowerReply.includes("kafolat") || lowerReply.includes("warranty")) {
          setWarrantyCheck(true);
        }
        if (lowerReply.includes("тест") || lowerReply.includes("sinov") || lowerReply.includes("test")) {
          setTestDriveCheck(true);
        }
        if (lowerReply.includes("суббот") || lowerReply.includes("shanba") || lowerReply.includes("завтра") || lowerReply.includes("ertaga")) {
          setFollowUpCheck(true);
        }
      }

    } catch (err) {
      console.error("Error streaming agent response:", err);
      // Fallback
      const fallback = aiAgentLang === "uz" 
        ? "Texnik nosozlik yuz berdi. Iltimos, qayta urinib ko'ring."
        : "Произошла техническая ошибка. Пожалуйста, попробуйте еще раз.";
      setTranscript((prev) => `${prev}\n[AI Agent (${campaignAgent})]: ${fallback}`);
      setAiChatHistory((prev) => [...prev, { speaker: "AI", text: fallback }]);
    } finally {
      setAiAgentTyping(false);
    }
  };

  // B2B supplier negotiation simulator caller
  const runB2BSourcingNegotiation = async () => {
    setIsSourcingLoading(true);
    setSourcingLogs(null);
    setSourcingResults(null);
    try {
      const vehiclePriceStr = CAR_SPECS[aiAgentModel]?.price || "26500";
      // price is a range string like "$24,500 - $28,900" → take the first amount.
      const vehiclePrice = Number((vehiclePriceStr.match(/[\d,]+/)?.[0] || "26500").replace(/,/g, "")) || 26500;
      
      const res = await fetch("/api/admin/calls/agent/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle: CAR_SPECS[aiAgentModel]?.model || "BYD Song Plus",
          color: "matte grey",
          budget: vehiclePrice
        })
      });
      const data = await res.json();
      if (data.logs) {
        setSourcingLogs(data.logs);
        setSourcingResults(data);
      }
    } catch (err) {
      console.error("Failed to run sourcing negotiator:", err);
    } finally {
      setIsSourcingLoading(false);
    }
  };

  // Compile Dynamic Sales Brochure (CRM Collateral)
  const compileBrochure = async () => {
    setCompilingBrochure(true);
    try {
      const vehiclePriceStr = CAR_SPECS[aiAgentModel]?.price || "26500";
      // price is a range string like "$24,500 - $28,900" → take the first amount.
      const vehiclePrice = Number((vehiclePriceStr.match(/[\d,]+/)?.[0] || "26500").replace(/,/g, "")) || 26500;
      
      const res = await fetch("/api/admin/calls/collateral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || "Уважаемый клиент",
          phone: phone || "+998901234567",
          vehicle: CAR_SPECS[aiAgentModel]?.model || "BYD Song Plus",
          price: vehiclePrice,
          discount: suggestedDiscount || 0,
          details: {
            color: sourcingResults?.sourced_color || "Space Black",
            warranty: "5 years or 150,000 km",
            eta_days: sourcingResults?.eta_days || 28
          }
        })
      });
      const data = await res.json();
      if (data.collateral_url) {
        setBrochureUrl(data.collateral_url);
      }
    } catch (err) {
      console.error("Failed to compile sales brochure:", err);
    } finally {
      setCompilingBrochure(false);
    }
  };

  // voice clone recording helpers using MediaRecorder
  const startVoiceCloneRecord = async () => {
    setVoiceCloneSuccess(false);
    setVoiceCloneBlob(null);
    setVoiceCloneAudioUrl(null);
    setVoiceCloneRecording(true);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("Microphone access denied for voice clone:", err);
      setVoiceCloneRecording(false);
      return;
    }

    const cloneChunks: Blob[] = [];
    const mime = pickRecorderMime();
    const mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) cloneChunks.push(event.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(cloneChunks, { type: mediaRecorder.mimeType || mime || "audio/mp4" });
      setVoiceCloneBlob(blob);
      setVoiceCloneAudioUrl(URL.createObjectURL(blob));
    };

    mediaRecorder.start();
    
    // Automatically stop after 10 seconds (standard voice print training threshold)
    setTimeout(() => {
      if (mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
        stream.getTracks().forEach((track) => track.stop());
        setVoiceCloneRecording(false);
      }
    }, 10000);
  };

  const saveVoiceClone = async () => {
    if (!voiceCloneBlob) return;
    setVoiceCloneSaving(true);
    try {
      const formData = new FormData();
      formData.append("audio", voiceCloneBlob, "manager_voice.webm");
      formData.append("name", voiceCloneName || "Manager Cloned Profile");

      const res = await fetch("/api/admin/calls/voice-clones", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setVoiceCloneSuccess(true);
      }
    } catch (err) {
      console.error("Failed to save voice clone:", err);
    } finally {
      setVoiceCloneSaving(false);
    }
  };

  const handleEndAiOutboundCall = () => {
    setIsAiCallSimulating(false);
    cleanupRecordingResources();

    // Fill form fields automatically based on simulation transcript findings
    setName("AI Dial Lead");
    setDirection("outbound");
    setPipelineStatus("in_progress");
    
    // Set follow-up to next Saturday
    const d = new Date();
    const currentDay = d.getDay();
    const daysUntilSaturday = (6 - currentDay + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSaturday);
    setFollowUpDate(d.toISOString().split("T")[0]);
    setScheduleFollowUp(true);

    const modelName = CAR_SPECS[aiAgentModel]?.model || "BYD Song";
    setNotes(`AI Outbound pre-qualified lead. Brand interest: ${modelName}. Active conversational chat saved.`);

    setActiveTab("form");
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleSetDateShortcut = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setFollowUpDate(d.toISOString().split("T")[0]);
  };

  // Playback recorded audio memo
  const handleDeleteRecording = () => {
    // Clearing audioUrl unmounts <AudioPlayer>, which stops + releases its own audio.
    setAudioUrl(null);
    audioChunksRef.current = [];
  };

  // CRM Post Call save
  const handleSaveToCrm = async () => {
    if (!phone.trim()) return;
    setSaving(true);
    setVoiceMatchAlert(null);

    try {
      const response = await fetch("/api/admin/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_phone: phone,
          customer_name: name || null,
          direction,
          duration_sec: callDuration || duration || null,
          transcript: transcript || null,
          pipeline_status: pipelineStatus,
          follow_up_date: scheduleFollowUp && followUpDate ? followUpDate : null,
          notes: notes || null,
          assigned_to: assignedTo || null,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        if (result.voiceMatchAlert) {
          setVoiceMatchAlert(result.voiceMatchAlert);
        }
        if (result.metadata) {
          setAiAnalysis(result.metadata);
          setFollowUpDraft(result.metadata.follow_up_draft || "");
          setIsAutopilotOpen(true);
        } else {
          setSuccess(true);
          setTimeout(() => {
            router.push("/admin/calls");
          }, 2000);
        }
      } else {
        alert(`Error saving to CRM: ${result.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to connect to the server.");
    } finally {
      setSaving(false);
    }
  };

  // Send message quick-actions
  const handleSendAutopilotDraft = async () => {
    setIsSendingDraft(true);
    setDraftSent(false);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setDraftSent(true);
      setTimeout(() => {
        setIsAutopilotOpen(false);
        router.push("/admin/calls");
      }, 1500);
    } catch (err) {
      console.error("Failed to send draft:", err);
    } finally {
      setIsSendingDraft(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen pb-12 flex flex-col space-y-6 relative antialiased">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/admin/calls")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.back}
        </button>
        <span className="text-xs font-mono px-2 py-1 bg-lime/10 text-lime border border-lime/20 rounded-full flex items-center gap-1.5">
          <Sparkle className="w-3.5 h-3.5 text-lime animate-spin-slow" />
          Tez VoIP Autopilot
        </span>
      </div>

      {/* Tabs Selector */}
      {!isCallActive && !isAiCallSimulating && !isAutopilotOpen && (
        <div className="flex bg-card p-1 rounded-xl border border-border shadow-inner">
          <button
            onClick={() => setActiveTab("dialer")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === "dialer"
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PhoneCall className="w-4 h-4" />
            {t.dialerTab}
          </button>
          <button
            onClick={() => setActiveTab("form")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === "form"
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Plus className="w-4 h-4" />
            {t.callTab}
          </button>
          <button
            onClick={() => setActiveTab("ai-dialer")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === "ai-dialer"
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-4 h-4 text-lime" />
            {t.aiDialerTab}
          </button>
        </div>
      )}

      {/* Autocomplete Customer Picker */}
      {!isCallActive && !isAiCallSimulating && !isAutopilotOpen && (
        <div className="space-y-1 relative">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-border bg-card text-foreground focus:outline-none focus:border-lime transition-all shadow-md"
            />
          </div>

          {showDropdown && searchResults.length > 0 && (
            <div className="absolute top-11 w-full bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-border">
              {searchResults.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => handleSelectCustomer(c)}
                  className="w-full px-4 py-3 text-left hover:bg-muted flex justify-between items-center transition-colors"
                >
                  <div>
                    <div className="font-semibold text-sm text-foreground">{c.name || "Client"}</div>
                    <div className="text-xs text-muted-foreground">{c.phone}</div>
                  </div>
                  <div className="text-xs px-2 py-0.5 rounded bg-lime/10 text-lime uppercase font-mono tracking-wider">
                    {c.tier}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ACTIVE CALL PANEL */}
      {(isCallActive || isAiCallSimulating) && (
        <div className="rounded-2xl border border-red-500/30 bg-card/75 backdrop-blur-xl p-6 flex flex-col items-center justify-center space-y-6 shadow-2xl relative overflow-hidden animate-pulse">
          <div className="absolute -inset-10 bg-radial-gradient from-red-500/5 via-transparent to-transparent -z-10" />
          
          <div className="w-20 h-20 rounded-full border border-red-500 bg-red-500/10 flex items-center justify-center animate-ping-slow">
            <PhoneCall className="w-8 h-8 text-red-500 animate-pulse" />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-lg font-bold tracking-wide text-foreground">
              {isAiCallSimulating ? t.activeAiCallTitle : t.activeCallTitle}
            </h2>
            <p className="text-sm font-semibold text-muted-foreground">{name || "Client"} ({phone})</p>
            <p className="text-lg font-mono text-lime font-bold">{formatTime(callDuration)}</p>
          </div>

          {/* Live AI sentiment + dynamic-discount readout (updates from the agent stream) */}
          {isAiCallSimulating && (
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold capitalize ${
                sentiment === "positive"
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : sentiment === "friction"
                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                  : "bg-muted/30 border-border text-muted-foreground"
              }`}>
                <Smile className="w-3.5 h-3.5" /> {sentiment}
              </span>
              {suggestedDiscount ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-lime/30 bg-lime/10 text-lime text-xs font-bold">
                  <Award className="w-3.5 h-3.5" /> Discount unlocked: ${suggestedDiscount.toLocaleString()}
                </span>
              ) : null}
            </div>
          )}

          {/* Audio canvas visualizer */}
          <canvas
            ref={visualizerCanvasRef}
            width={300}
            height={60}
            className="w-full h-14 rounded-xl bg-muted/10 border border-border/10"
          />

          {/* Live Transcription Box */}
          <div className="w-full space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-lime flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-lime animate-spin-slow" />
              Live Conversation stream {aiAgentTyping && " (Leya is speaking...)"}
            </span>
            <div className="w-full h-28 overflow-y-auto border border-border bg-muted/30 p-2.5 rounded-lg text-xs leading-relaxed scrollbar-thin scroll-smooth font-sans whitespace-pre-line">
              {transcript || <span className="text-muted-foreground italic">Connecting audio streams...</span>}
            </div>
          </div>

          {/* Customer Speech simulator for AI Agent Call */}
          {isAiCallSimulating && (
            <div className="w-full space-y-3 border-t border-border/40 pt-4">
              <span className="text-[10px] uppercase font-mono tracking-wider text-lime flex items-center gap-1">
                <Smile className="w-3.5 h-3.5 text-lime" />
                Simulate Customer Speaking
              </span>
              
              <div className="flex flex-wrap gap-1.5">
                {[
                  aiAgentLang === "uz" ? "Qancha turadi?" : "Сколько стоит машина?",
                  aiAgentLang === "uz" ? "Test-drayv qila olamanmi?" : "Можно записаться на тест-драйв?",
                  aiAgentLang === "uz" ? "Kafolat qancha?" : "Какая гарантия?",
                  aiAgentLang === "uz" ? "Rahmat, menga qiziq emas." : "Спасибо, мне не интересно."
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={aiAgentTyping}
                    onClick={() => handleSendClientResponse(chip)}
                    className="text-[10px] px-2.5 py-1 bg-muted border border-border rounded-full hover:border-lime text-foreground transition-all disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 w-full">
                <input
                  type="text"
                  value={clientResponseText}
                  onChange={(e) => setClientResponseText(e.target.value)}
                  disabled={aiAgentTyping}
                  placeholder={aiAgentLang === "uz" ? "Mijoz nomidan gapiring..." : "Ответьте от имени клиента..."}
                  className="flex-1 bg-muted/30 border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-lime text-foreground"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSendClientResponse();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={aiAgentTyping || !clientResponseText.trim()}
                  onClick={() => handleSendClientResponse()}
                  className="px-4 bg-lime text-navy rounded-xl text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {aiAgentTyping ? "..." : "Send"}
                </button>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-4 w-full">
            {!isAiCallSimulating && (
              <button
                onClick={handleToggleMute}
                className={`flex-1 py-3 text-xs font-semibold rounded-xl border flex items-center justify-center gap-2 transition-all ${
                  isMuted
                    ? "bg-red-500/10 border-red-500 text-red-500"
                    : "bg-muted/40 border-border text-foreground hover:bg-muted"
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {isMuted ? t.unmute : t.mute}
              </button>
            )}
            <button
              onClick={isAiCallSimulating ? handleEndAiOutboundCall : handleEndVoIpCall}
              className="flex-1 py-3 text-xs font-bold rounded-xl bg-red-600 text-white flex items-center justify-center gap-2 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
            >
              <PhoneOff className="w-4 h-4" />
              {t.endCall}
            </button>
          </div>
        </div>
      )}

      {/* POST-CALL AI AUTOPILOT REVIEW PANEL */}
      {isAutopilotOpen && aiAnalysis && (
        <div className="rounded-2xl border border-lime/30 bg-card/80 backdrop-blur-xl p-5 space-y-6 shadow-2xl animate-fadeIn relative overflow-hidden">
          <div className="absolute -inset-10 bg-radial-gradient from-lime/5 via-transparent to-transparent -z-10" />

          {/* Voice Fingerprint Alert Banner */}
          {voiceMatchAlert && (
            <div className="p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-xs flex gap-2 items-start">
              <ShieldAlert className="w-4.5 h-4.5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{t.voiceMatchAlertTitle}</p>
                <p className="text-[10px] mt-0.5 leading-relaxed">{voiceMatchAlert}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <Sparkle className="w-5 h-5 text-lime animate-spin-slow" />
              <h2 className="text-base font-bold text-foreground">{t.aiInsights}</h2>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-lime/10 text-lime border border-lime/20 rounded-full">
              Model Verified
            </span>
          </div>

          {/* Extracted Entities */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-lime" />
              {t.entitiesTitle}
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl border border-border bg-muted/10 flex flex-col">
                <span className="text-muted-foreground text-[10px]">Budget</span>
                <span className="font-mono font-bold text-foreground">
                  {aiAnalysis.extracted_entities.budget ? `$${aiAnalysis.extracted_entities.budget.toLocaleString()}` : "—"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-muted/10 flex flex-col">
                <span className="text-muted-foreground text-[10px]">Model Interest</span>
                <span className="font-semibold text-foreground truncate">
                  {aiAnalysis.extracted_entities.car_model || "—"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-muted/10 flex flex-col">
                <span className="text-muted-foreground text-[10px]">Urgency</span>
                <span className="capitalize font-bold text-lime">
                  {aiAnalysis.extracted_entities.urgency || "—"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-muted/10 flex flex-col">
                <span className="text-muted-foreground text-[10px]">Closing Probability</span>
                <span className="font-mono font-black text-lime">
                  {aiAnalysis.extracted_entities.closing_probability || "25"}%
                </span>
              </div>
            </div>
          </div>

          {/* Sentiment & Compliance metrics */}
          <div className="grid grid-cols-2 gap-3 border-t border-b border-border/40 py-4">
            <div className="space-y-2 text-center">
              <span className="text-xs font-semibold text-muted-foreground block">{t.sentimentTitle}</span>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/30 border border-border text-sm font-bold text-foreground capitalize">
                <Smile className="w-4 h-4 text-lime" />
                {aiAnalysis.sentiment}
              </div>
            </div>

            <div className="space-y-2 text-center border-l border-border/40">
              <span className="text-xs font-semibold text-muted-foreground block">{t.complianceTitle}</span>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-bold capitalize ${
                aiAnalysis.compliance_score >= 75
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : aiAnalysis.compliance_score >= 50
                  ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}>
                <Award className="w-4 h-4 shrink-0" />
                {aiAnalysis.compliance_score}%
              </div>
            </div>
          </div>

          {/* AI Compliance Checklist breakdown */}
          <div className="space-y-2 text-xs">
            <span className="font-semibold text-muted-foreground">Script Compliance Checklist</span>
            <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
              <div className="flex items-center gap-1.5">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                  aiAnalysis.compliance_checklist.greeted_properly ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                }`}>
                  {aiAnalysis.compliance_checklist.greeted_properly ? "✓" : "✗"}
                </div>
                <span>Greeted properly</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                  aiAnalysis.compliance_checklist.offered_test_drive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                }`}>
                  {aiAnalysis.compliance_checklist.offered_test_drive ? "✓" : "✗"}
                </div>
                <span>Offered test drive</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                  aiAnalysis.compliance_checklist.mentioned_warranty ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                }`}>
                  {aiAnalysis.compliance_checklist.mentioned_warranty ? "✓" : "✗"}
                </div>
                <span>Warranty option</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                  aiAnalysis.compliance_checklist.scheduled_followup ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                }`}>
                  {aiAnalysis.compliance_checklist.scheduled_followup ? "✓" : "✗"}
                </div>
                <span>Scheduled follow-up</span>
              </div>
            </div>
          </div>

          {/* Autopilot Quick Send Follow-up */}
          <div className="space-y-2 border-t border-border/40 pt-4">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-lime" />
              {t.draftTitle}
            </span>
            <textarea
              value={followUpDraft}
              onChange={(e) => setFollowUpDraft(e.target.value)}
              rows={4}
              className="w-full text-xs rounded-xl border border-border bg-muted/20 p-3 leading-relaxed text-foreground focus:outline-none focus:border-lime"
            />
            <button
              onClick={handleSendAutopilotDraft}
              disabled={isSendingDraft || draftSent}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-lime to-lime-500 text-navy font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-opacity animate-pulse"
            >
              {isSendingDraft ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {t.sendingDraft}
                </>
              ) : draftSent ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  {t.draftSent}
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  {t.sendDraft}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: DIALER KEYPAD */}
      {activeTab === "dialer" && !isCallActive && !isAutopilotOpen && (
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-5 space-y-6 shadow-xl flex flex-col relative overflow-hidden">
          {/* Dial display */}
          <div className="text-center space-y-1 py-4">
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.dialPlaceholder}
              className="w-full text-center text-xl font-bold tracking-wider bg-transparent text-foreground border-b border-border/60 pb-2 focus:outline-none focus:border-lime transition-all"
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.clientName}
              className="w-full text-center text-xs text-muted-foreground bg-transparent border-none focus:outline-none"
            />
          </div>

          {/* Keypad Grid */}
          <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto w-full">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((btn) => (
              <button
                key={btn}
                onClick={() => handleDialPadPress(btn)}
                className="w-14 h-14 rounded-full bg-muted/40 border border-border/80 flex items-center justify-center text-lg font-semibold hover:bg-muted text-foreground hover:scale-105 active:scale-95 transition-all shadow-sm"
              >
                {btn}
              </button>
            ))}
          </div>

          {/* Dial controls */}
          <div className="flex items-center justify-center gap-6 pt-4">
            <button
              onClick={handleDialPadBackspace}
              disabled={!phone.length}
              className="w-10 h-10 rounded-full bg-muted/20 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleStartVoIpCall}
              disabled={!phone.trim()}
              className="w-16 h-16 rounded-full bg-gradient-to-r from-lime to-lime-500 text-navy flex items-center justify-center hover:scale-105 transition-all shadow-lg shadow-lime/20 disabled:opacity-50"
            >
              <PhoneCall className="w-7 h-7" />
            </button>
            <div className="w-10 h-10" />
          </div>
        </div>
      )}

      {/* TAB 2: MANUAL CALL REGISTRATION */}
      {activeTab === "form" && !isCallActive && !isAutopilotOpen && (
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-5 space-y-5 shadow-xl relative overflow-hidden">
          
          {/* Active Sales Copilot Coach overlay */}
          {copilotActive && transcript.trim() && (
            <div className="rounded-xl border border-lime/30 bg-gradient-to-r from-lime/5 via-card to-card p-3 shadow-md flex items-start gap-2.5 relative overflow-hidden animate-fadeIn">
              <div className="absolute -left-6 -top-6 w-12 h-12 bg-lime/10 rounded-full blur-xl" />
              <Sparkle className="w-5 h-5 text-lime shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1 w-full">
                <span className="text-[10px] uppercase font-mono tracking-wider text-lime block font-bold">
                  Sales Copilot Coach (Live)
                </span>
                <p className="text-xs text-foreground font-semibold leading-relaxed">
                  {isCopilotLoading ? (
                    <span className="flex items-center gap-1.5 text-muted-foreground italic">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking...
                    </span>
                  ) : (
                    copilotSuggestion || "Продолжайте диалог. Я предоставлю подсказки по ходу звонка."
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Compliance Script Auditor visual dashboard */}
          {copilotActive && (
            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2 text-[10px]">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider block font-mono">
                Script compliance checklist (Live check)
              </span>
              <div className="grid grid-cols-2 gap-2 font-mono">
                <div className="flex items-center gap-1.5">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                    greetingCheck ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
                  }`}>
                    {greetingCheck ? "✓" : "—"}
                  </div>
                  <span className={greetingCheck ? "text-foreground font-medium" : "text-muted-foreground"}>Greeting ("Tez Motors")</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                    testDriveCheck ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
                  }`}>
                    {testDriveCheck ? "✓" : "—"}
                  </div>
                  <span className={testDriveCheck ? "text-foreground font-medium" : "text-muted-foreground"}>Offer Test Drive</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                    warrantyCheck ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
                  }`}>
                    {warrantyCheck ? "✓" : "—"}
                  </div>
                  <span className={warrantyCheck ? "text-foreground font-medium" : "text-muted-foreground"}>Mention Warranty</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                    followUpCheck ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
                  }`}>
                    {followUpCheck ? "✓" : "—"}
                  </div>
                  <span className={followUpCheck ? "text-foreground font-medium" : "text-muted-foreground"}>Schedule Follow-up</span>
                </div>
              </div>
            </div>
          )}

          {/* Model Detected Specs Card */}
          {modelDetected && CAR_SPECS[modelDetected] && (
            <div className="rounded-xl border border-lime/30 bg-card p-3 shadow-md flex gap-2.5 items-start animate-fadeIn">
              <BookOpen className="w-4.5 h-4.5 text-lime shrink-0 mt-0.5" />
              <div className="text-[10px] leading-relaxed space-y-1">
                <p className="font-bold text-foreground">{CAR_SPECS[modelDetected].model}</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
                  <div>Price: <span className="text-foreground font-semibold">{CAR_SPECS[modelDetected].price}</span></div>
                  <div>Range: <span className="text-foreground font-semibold">{CAR_SPECS[modelDetected].range}</span></div>
                  <div>Battery: <span className="text-foreground font-semibold">{CAR_SPECS[modelDetected].battery}</span></div>
                  <div>Drive: <span className="text-foreground font-semibold">{CAR_SPECS[modelDetected].drive}</span></div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t.clientPhone} *</label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998"
                  className="w-full pl-8 pr-2 py-2 text-xs rounded-lg border border-border bg-muted/30 focus:outline-none focus:border-lime"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t.clientName}</label>
              <div className="relative">
                <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ivan Ivanov"
                  className="w-full pl-8 pr-2 py-2 text-xs rounded-lg border border-border bg-muted/30 focus:outline-none focus:border-lime"
                />
              </div>
            </div>
          </div>

          {/* Quick Voice Recorder Button */}
          <div className="flex flex-col items-center justify-center space-y-3 py-2 border-b border-border/40 pb-4">
            <div className="relative flex items-center justify-center">
              {isRecording && (
                <>
                  <span className="absolute inline-flex h-16 w-16 rounded-full bg-lime/20 animate-ping" />
                  <span className="absolute inline-flex h-20 w-20 rounded-full bg-lime/10 animate-pulse" />
                </>
              )}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center transition-all border border-border ${
                  isRecording
                    ? "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20"
                    : "bg-lime text-navy hover:scale-105 shadow-lg shadow-lime/20"
                }`}
              >
                {isRecording ? <Square className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground">
              {isRecording ? `${t.recording} (${formatTime(duration)})` : t.tapToRecord}
            </p>

            {micError && (
              <p className="w-full text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-1 leading-snug">
                {typeof window !== "undefined" && !window.isSecureContext
                  ? locale === "ru"
                    ? "Микрофон требует защищённого соединения (HTTPS). Откройте админку по адресу https:// (рабочий сайт) — по локальному http-адресу браузер блокирует запись."
                    : locale === "uz"
                    ? "Mikrofon HTTPS ulanishini talab qiladi. Admin panelni https:// orqali oching — lokal http manzilda brauzer yozuvni bloklaydi."
                    : "Microphone needs a secure (HTTPS) connection. Open the admin over https:// (the production site) — on a local http address the browser blocks recording."
                  : locale === "ru"
                    ? "Доступ к микрофону заблокирован. Разрешите доступ в настройках браузера и попробуйте снова."
                    : locale === "uz"
                    ? "Mikrofonga ruxsat berilmadi. Brauzer sozlamalarida ruxsat bering va qayta urinib ko'ring."
                    : "Microphone access was blocked. Allow microphone permission in your browser settings and try again."}
              </p>
            )}

            {audioUrl && !isRecording && (
              <div className="w-full mt-1 space-y-2">
                <AudioPlayer src={audioUrl} downloadName="tez-call-recording" />
                <button
                  type="button"
                  onClick={handleDeleteRecording}
                  className="w-full flex items-center justify-center gap-1.5 text-[11px] font-medium text-red-400 hover:text-red-500 transition-colors py-1"
                  title={t.deleteRecording}
                >
                  <Trash className="w-3.5 h-3.5" /> {t.deleteRecording}
                </button>
              </div>
            )}
          </div>

          {/* Transcript input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-lime" />
                Call Transcript
              </span>
              <span>{transcript.length} chars</span>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={4}
              placeholder={t.unsupportedSpeech}
              className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-foreground focus:outline-none focus:border-lime leading-relaxed"
            />
          </div>

          {/* Copilot active controls toggle */}
          <div className="flex items-center justify-between border-t border-border/40 pt-3 text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              Enable Real-time sales Copilot coach
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={copilotActive}
                onChange={(e) => setCopilotActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-lime"></div>
            </label>
          </div>

          {/* Direction toggle */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t.direction}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection("inbound")}
                className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                  direction === "inbound"
                    ? "bg-lime/10 text-lime border-lime"
                    : "bg-muted/10 border-border text-muted-foreground"
                }`}
              >
                {t.inbound}
              </button>
              <button
                type="button"
                onClick={() => setDirection("outbound")}
                className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                  direction === "outbound"
                    ? "bg-lime/10 text-lime border-lime"
                    : "bg-muted/10 border-border text-muted-foreground"
                }`}
              >
                {t.outbound}
              </button>
            </div>
          </div>

          {/* Pipeline Stage Select */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t.pipelineStage}</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(["new", "contacted", "in_progress", "closed"] as const).map((stage) => {
                const colors = {
                  new: "border-blue-500 text-blue-400 bg-blue-500/5",
                  contacted: "border-yellow-500 text-yellow-400 bg-yellow-500/5",
                  in_progress: "border-purple-500 text-purple-400 bg-purple-500/5",
                  closed: "border-green-500 text-green-400 bg-green-500/5",
                };
                const active = pipelineStatus === stage;
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setPipelineStatus(stage)}
                    className={`py-2 text-[10px] font-mono font-medium rounded-lg border text-center transition-all ${
                      active ? colors[stage] : "bg-muted/10 border-border text-muted-foreground"
                    }`}
                  >
                    {t.pipelineStages[stage]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assigned Rep */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t.assignee}</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2.5 text-xs rounded-lg border border-border bg-muted/30 text-foreground focus:outline-none"
            >
              {team.map((member) => (
                <option key={member.id} value={member.id} className="bg-card text-foreground">
                  {member.email} ({t.repLabels[member.role] || member.role})
                </option>
              ))}
            </select>
          </div>

          {/* Follow-up task scheduling */}
          <div className="space-y-3 border-t border-border/40 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-lime" />
                <span className="text-xs font-semibold">{t.followUp}</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleFollowUp}
                  onChange={(e) => setScheduleFollowUp(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-lime"></div>
              </label>
            </div>

            {scheduleFollowUp && (
              <div className="space-y-2.5">
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-muted/30 text-foreground"
                />
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground font-medium">{t.followUpShortcut}:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetDateShortcut(1)}
                      className="flex-1 py-1 text-[10px] bg-muted/40 hover:bg-muted border border-border rounded text-center"
                    >
                      +1 {locale === "ru" ? "день" : locale === "uz" ? "kun" : "day"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetDateShortcut(3)}
                      className="flex-1 py-1 text-[10px] bg-muted/40 hover:bg-muted border border-border rounded text-center"
                    >
                      +3 {locale === "ru" ? "дня" : locale === "uz" ? "kun" : "days"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetDateShortcut(7)}
                      className="flex-1 py-1 text-[10px] bg-muted/40 hover:bg-muted border border-border rounded text-center"
                    >
                      +7 {locale === "ru" ? "дней" : locale === "uz" ? "kun" : "days"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Custom notes */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t.notes}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="..."
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-foreground focus:outline-none"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveToCrm}
            disabled={saving || !phone.trim() || success}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-lime to-lime-500 text-navy font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.saving}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {t.save}
              </>
            )}
          </button>
        </div>
      )}

      {/* TAB 3: AI OUTBOUND AGENT SIMULATION */}
      {activeTab === "ai-dialer" && !isCallActive && !isAiCallSimulating && !isAutopilotOpen && (
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-5 space-y-6 shadow-xl flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-lime/10 border border-lime/20 flex items-center justify-center animate-pulse">
            <Sparkles className="w-7 h-7 text-lime" />
          </div>

          <div className="text-center space-y-2 w-full">
            <h2 className="text-sm font-bold text-foreground">AI Outbound Calling Agent</h2>
            <p className="text-xs text-muted-foreground leading-relaxed px-4">
              Trigger an autonomous outbound campaign call. The AI voice agent will call the prospect, handle specifications, pre-qualify budget, and schedule test-drives.
            </p>
          </div>

          {/* Phone Field input */}
          <div className="w-full space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Target Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998"
                className="w-full text-center text-lg font-bold bg-muted/30 border border-border rounded-xl py-2 focus:outline-none focus:border-lime"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Target Vehicle Model</label>
              <select
                value={aiAgentModel}
                onChange={(e) => setAiAgentModel(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-muted/30 text-foreground focus:outline-none"
              >
                <option value="byd_song">BYD Song Plus DM-i</option>
                <option value="byd_han">BYD Han EV</option>
                <option value="byd_seagull">BYD Seagull</option>
                <option value="chery_tiggo">Chery Tiggo 8 Pro Max</option>
                <option value="geely_monjaro">Geely Monjaro</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Conversation Language</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAiAgentLang("ru")}
                  className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    aiAgentLang === "ru"
                      ? "bg-lime/10 text-lime border-lime"
                      : "bg-muted/10 border-border text-muted-foreground"
                  }`}
                >
                  Русский
                </button>
                <button
                  type="button"
                  onClick={() => setAiAgentLang("uz")}
                  className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    aiAgentLang === "uz"
                      ? "bg-lime/10 text-lime border-lime"
                      : "bg-muted/10 border-border text-muted-foreground"
                  }`}
                >
                  O'zbekcha
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Agent Persona</label>
              <div className="grid grid-cols-3 gap-2">
                {([["qualifier", "Qualifier"], ["scheduler", "Scheduler"], ["closer", "Closer"]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCampaignAgent(val)}
                    className={`py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
                      campaignAgent === val
                        ? "bg-lime/10 text-lime border-lime"
                        : "bg-muted/10 border-border text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleStartAiOutboundCall}
            disabled={!phone.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-lime to-lime-500 text-navy font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity shadow-lg shadow-lime/10"
          >
            <PhoneCall className="w-4 h-4" />
            Start AI Outbound Call
          </button>

          {/* AI sales tools: dealer-network sourcing · brochure · manager voice clone */}
          <div className="w-full space-y-4 pt-4 border-t border-border/40">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">AI Sales Tools</span>

            {/* B2B dealer-network sourcing */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={runB2BSourcingNegotiation}
                disabled={isSourcingLoading}
                className="w-full py-2.5 rounded-xl border border-border bg-muted/20 text-foreground text-xs font-semibold flex items-center justify-center gap-2 hover:bg-muted/40 disabled:opacity-50 transition-colors"
              >
                {isSourcingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 text-lime" />}
                Source from dealer network
              </button>
              {sourcingLogs && (
                <div className="rounded-xl border border-border bg-muted/10 p-3 space-y-1 max-h-44 overflow-y-auto">
                  {sourcingLogs.map((line, i) => (
                    <p key={i} className="text-[11px] font-mono text-muted-foreground leading-snug">{line}</p>
                  ))}
                  {sourcingResults?.final_wholesale_price && (
                    <p className="text-[11px] text-foreground pt-1.5 border-t border-border/40 mt-1.5">
                      Wholesale <span className="font-bold text-lime">${Number(sourcingResults.final_wholesale_price).toLocaleString()}</span>
                      {sourcingResults.sourced_color ? ` · ${sourcingResults.sourced_color}` : ""}
                      {sourcingResults.eta_days ? ` · ETA ${sourcingResults.eta_days}d` : ""}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Dynamic sales brochure compiler */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={compileBrochure}
                disabled={compilingBrochure}
                className="w-full py-2.5 rounded-xl border border-border bg-muted/20 text-foreground text-xs font-semibold flex items-center justify-center gap-2 hover:bg-muted/40 disabled:opacity-50 transition-colors"
              >
                {compilingBrochure ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4 text-lime" />}
                Compile sales brochure
              </button>
              {brochureUrl && (
                <a
                  href={brochureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 rounded-xl border border-lime/30 bg-lime/10 text-lime text-xs font-semibold flex items-center justify-center gap-2 hover:bg-lime/20 transition-colors"
                >
                  <Send className="w-4 h-4" /> Open / share brochure
                </a>
              )}
            </div>

            {/* Manager voice-clone trainer */}
            <div className="space-y-2">
              <input
                type="text"
                value={voiceCloneName}
                onChange={(e) => setVoiceCloneName(e.target.value)}
                placeholder="Voice profile name (e.g. Тимур)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-muted/30 text-foreground focus:outline-none focus:border-lime"
              />
              <button
                type="button"
                onClick={startVoiceCloneRecord}
                disabled={voiceCloneRecording}
                className="w-full py-2.5 rounded-xl border border-border bg-muted/20 text-foreground text-xs font-semibold flex items-center justify-center gap-2 hover:bg-muted/40 disabled:opacity-50 transition-colors"
              >
                {voiceCloneRecording ? <><Loader2 className="w-4 h-4 animate-spin text-red-400" /> Recording 10s…</> : <><Mic className="w-4 h-4 text-lime" /> Record voice sample (10s)</>}
              </button>
              {voiceCloneAudioUrl && <audio controls src={voiceCloneAudioUrl} className="w-full h-9" />}
              {voiceCloneBlob && !voiceCloneSuccess && (
                <button
                  type="button"
                  onClick={saveVoiceClone}
                  disabled={voiceCloneSaving}
                  className="w-full py-2 rounded-xl bg-lime/10 border border-lime/30 text-lime text-xs font-semibold flex items-center justify-center gap-2 hover:bg-lime/20 disabled:opacity-50 transition-colors"
                >
                  {voiceCloneSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save voice clone
                </button>
              )}
              {voiceCloneSuccess && (
                <p className="text-[11px] text-lime flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Voice clone saved to your profile</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Modal Overlay */}
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="rounded-2xl border border-lime/30 bg-card p-6 text-center space-y-4 max-w-xs w-full shadow-2xl">
            <div className="mx-auto w-12 h-12 rounded-full bg-lime/20 border border-lime/30 flex items-center justify-center animate-bounce">
              <Check className="w-6 h-6 text-lime" />
            </div>
            <p className="text-sm font-semibold text-foreground">{t.successLogged}</p>
          </div>
        </div>
      )}
    </div>
  );
}
