'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { drawSkeleton, type Pt } from '@/lib/game/pose';
import {
  PushupMachine,
  SquatMachine,
  MIN_REP_MS,
  type FrameDebug,
  type Mode,
} from '@/lib/game/training-machines';
import {
  MAX_POINTS_PER_DAY,
  PUSHUP_CAP,
  SQUAT_CAP,
} from '@/lib/game/training-rules';
import { GAMEPLAN_TEMPO_LABELS, STAT_KEYS, STAT_LABELS, type StatKey } from '@/lib/game/stat-effects';
import { clientApi } from '@/components/api';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm';

type CamState = 'idle' | 'requesting' | 'on' | 'denied' | 'error' | 'unsupported';
type ModelState = 'idle' | 'loading' | 'ready' | 'error';

interface TrainingStatus {
  fighter: { id: string; displayName: string; style: string };
  stats: Record<StatKey, number>;
  pointsAvailable: number;
  lifetime: { pushups: number; squats: number };
  today: { date: string; pushups: number; squats: number; pointsEarned: number };
  deck: { cards: string[]; signature: string | null };
}

interface DeckData {
  cards: string[];
  signature: string | null;
  style: string;
  availableKinds: { kind: string; label: string; style: string; styleLabel: string }[];
  signatureOptions: { kind: string; label: string }[];
}

function fmtAngle(v: number | null): string {
  return v === null || Number.isNaN(v) ? '—' : `${v.toFixed(0)}°`;
}

export default function TrainingClient() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const lastVideoTimeRef = useRef(-1);
  const machineRef = useRef<PushupMachine | SquatMachine>(new PushupMachine());
  const fpsRef = useRef({ frames: 0, at: 0, fps: 0 });
  const lastDebugAtRef = useRef(0);

  const [mode, setMode] = useState<Mode>('pushup');
  const [camState, setCamState] = useState<CamState>('idle');
  const [camError, setCamError] = useState('');
  const [modelState, setModelState] = useState<ModelState>('idle');
  const [modelError, setModelError] = useState('');
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState('Tekan mulai kamera untuk latihan');
  const [phase, setPhase] = useState('—');
  const [fps, setFps] = useState(0);
  const [debug, setDebug] = useState<FrameDebug | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [invalidFlash, setInvalidFlash] = useState(0);

  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [sessionPushups, setSessionPushups] = useState(0);
  const [sessionSquats, setSessionSquats] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  const [allocMsg, setAllocMsg] = useState('');

  const [deck, setDeck] = useState<DeckData | null>(null);
  const [deckCards, setDeckCards] = useState<string[]>([]);
  const [deckSignature, setDeckSignature] = useState<string | null>(null);
  const [deckMsg, setDeckMsg] = useState('');
  const [savingDeck, setSavingDeck] = useState(false);

  const loadStatus = useCallback(async () => {
    const res = await clientApi<TrainingStatus>('/api/training/status');
    if (res.ok) {
      setStatus(res.data);
      setStatusError('');
    } else {
      setStatusError(res.error.message);
    }
  }, []);

  const loadDeck = useCallback(async () => {
    const res = await clientApi<DeckData>('/api/deck');
    if (res.ok) {
      setDeck(res.data);
      setDeckCards(res.data.cards);
      setDeckSignature(res.data.signature);
    }
  }, []);

  // Muat status + deck saat mount. Fetch didefinisikan DI DALAM effect
  // dan setState hanya terjadi setelah await — pola yang diakui aturan
  // react-hooks/set-state-in-effect (loadStatus/loadDeck di bawah dipakai
  // ulang oleh tombol, bukan oleh effect ini).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await clientApi<TrainingStatus>('/api/training/status');
      if (cancelled) return;
      if (s.ok) {
        setStatus(s.data);
        setStatusError('');
      } else {
        setStatusError(s.error.message);
      }
      const d = await clientApi<DeckData>('/api/deck');
      if (cancelled) return;
      if (d.ok) {
        setDeck(d.data);
        setDeckCards(d.data.cards);
        setDeckSignature(d.data.signature);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Muat model MediaPipe sekali (client-side only, dynamic import).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setModelState('loading');
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
        let landmarker: PoseLandmarker;
        try {
          landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        } catch {
          landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        }
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setModelState('ready');
      } catch (err) {
        if (cancelled) return;
        setModelState('error');
        setModelError(err instanceof Error ? err.message : 'Gagal memuat model pose');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const changeMode = useCallback((next: Mode) => {
    setMode(next);
    machineRef.current = next === 'pushup' ? new PushupMachine() : new SquatMachine();
    setPhase('—');
    setFeedback(
      next === 'pushup'
        ? 'Mode push-up — kamera dari samping'
        : 'Mode squat — badan penuh masuk frame',
    );
  }, []);

  const stopCamera = useCallback(() => {
    setRunning(false);
    cancelAnimationFrame(rafRef.current);
    const video = videoRef.current;
    if (video && video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
    setCamState('idle');
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
    };
  }, []);

  // Loop deteksi.
  useEffect(() => {
    if (!running || camState !== 'on' || modelState !== 'ready') return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const now = performance.now();
      const f = fpsRef.current;
      if (f.at === 0) f.at = now;
      f.frames++;
      if (now - f.at >= 1000) {
        f.fps = Math.round((f.frames * 1000) / (now - f.at));
        f.frames = 0;
        f.at = now;
        setFps(f.fps);
      }
      if (video.readyState < 2 || video.videoWidth === 0) return;
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      if (video.currentTime === lastVideoTimeRef.current) return;
      lastVideoTimeRef.current = video.currentTime;

      let lms: Pt[] | null = null;
      try {
        const result = landmarker.detectForVideo(video, video.currentTime * 1000);
        const pose = result.landmarks?.[0];
        if (pose && pose.length >= 33) {
          lms = pose.map((p) => ({ x: p.x, y: p.y, visibility: p.visibility ?? 0.5 }));
        }
      } catch {
        lms = null;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (lms) {
        drawSkeleton(ctx, lms, canvas.width, canvas.height, {
          mirror: true,
          lineColor: 'rgba(250, 245, 236, 0.9)',
          jointColor: '#f5a623',
        });
      }

      const res = machineRef.current.step(lms);
      if (res.counted) {
        if (mode === 'pushup') {
          setSessionPushups((n) => {
            const total = (status?.today.pushups ?? 0) + n;
            return total >= PUSHUP_CAP ? n : n + 1;
          });
        } else {
          setSessionSquats((n) => {
            const total = (status?.today.squats ?? 0) + n;
            return total >= SQUAT_CAP ? n : n + 1;
          });
        }
      }
      if (res.invalid) setInvalidFlash((n) => n + 1);
      setFeedback(res.feedback);
      setPhase(res.debug.phase);
      if (now - lastDebugAtRef.current > 120) {
        lastDebugAtRef.current = now;
        setDebug(res.debug);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, camState, modelState, mode, status?.today.pushups, status?.today.squats]);

  async function startCamera() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCamState('unsupported');
      setCamError('Browser ini tidak mendukung kamera. Buka lewat Chrome di HP.');
      return;
    }
    setCamState('requesting');
    setCamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setCamState('on');
      setRunning(true);
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setCamState('denied');
        setCamError('Izin kamera ditolak. Izinkan kamera di pengaturan browser, lalu tekan mulai lagi.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setCamState('error');
        setCamError('Kamera tidak ditemukan di perangkat ini.');
      } else {
        setCamState('error');
        setCamError(`Kamera gagal dibuka (${name || 'error tidak dikenal'}). Coba tutup aplikasi lain yang memakai kamera.`);
      }
    }
  }

  async function submitSession() {
    if (sessionPushups === 0 && sessionSquats === 0) {
      setSubmitMsg('Belum ada rep di sesi ini.');
      return;
    }
    setSubmitting(true);
    setSubmitMsg('');
    const res = await clientApi<{
      today: { pushups: number; squats: number; pointsEarned: number };
      pointsEarnedThisSession: number;
      pointsAvailable: number;
    }>('/api/training/session', {
      method: 'POST',
      body: JSON.stringify({ pushups: sessionPushups, squats: sessionSquats }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setSubmitMsg(`Gagal kirim sesi: ${res.error.message}`);
      return;
    }
    setSessionPushups(0);
    setSessionSquats(0);
    setSubmitMsg(
      res.data.pointsEarnedThisSession > 0
        ? `Sesi tersimpan — dapat ${res.data.pointsEarnedThisSession} poin!`
        : 'Sesi tersimpan.',
    );
    await loadStatus();
  }

  async function allocate(stat: StatKey) {
    setAllocMsg('');
    const res = await clientApi<{ stats: Record<StatKey, number>; pointsAvailable: number }>(
      '/api/training/allocate',
      { method: 'POST', body: JSON.stringify({ stat, points: 1 }) },
    );
    if (!res.ok) {
      setAllocMsg(res.error.message);
      return;
    }
    setAllocMsg(`${STAT_LABELS[stat]} naik 1 poin.`);
    await loadStatus();
  }

  function toggleDeckCard(kind: string) {
    setDeckCards((prev) => {
      if (prev.includes(kind)) return prev.filter((k) => k !== kind);
      if (prev.length >= 6) return prev;
      return [...prev, kind];
    });
  }

  async function saveDeck() {
    setSavingDeck(true);
    setDeckMsg('');
    const res = await clientApi<{ cards: string[]; signature: string | null }>('/api/deck', {
      method: 'PUT',
      body: JSON.stringify({ cards: deckCards, signature: deckSignature }),
    });
    setSavingDeck(false);
    if (!res.ok) {
      setDeckMsg(`Gagal simpan deck: ${res.error.message}`);
      return;
    }
    setDeckMsg('Deck tersimpan — dipakai di fight berikutnya.');
    await loadDeck();
    await loadStatus();
  }

  const day = status?.today;
  const earned = day ? day.pointsEarned : 0;
  const available = status?.pointsAvailable ?? 0;
  const repsToday = mode === 'pushup' ? (day?.pushups ?? 0) + sessionPushups : (day?.squats ?? 0) + sessionSquats;
  const cap = mode === 'pushup' ? PUSHUP_CAP : SQUAT_CAP;
  const capReached = repsToday >= cap;

  if (statusError && !status) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 pb-10 pt-5">
        <h1 className="font-display text-5xl font-bold uppercase leading-none text-paper">Latihan</h1>
        <div className="glass mt-4 p-4">
          <p className="text-paper">{statusError}</p>
          <p className="mt-2 text-sm text-paper-dim">
            Latihan butuh fighter aktif. Kalau belum login, masuk dulu lalu buat fighter.
          </p>
          <Link href="/masuk" className="mt-3 inline-block min-h-11 rounded-xl bg-amber-brand px-6 py-2 font-display text-lg font-semibold uppercase text-[#1a1206]">
            Masuk
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-10 pt-5">
      <header>
        <p className="font-display text-sm font-semibold uppercase tracking-[0.25em] text-amber-brand">
          Street Fight Hub
        </p>
        <h1 className="font-display text-5xl font-bold uppercase leading-none text-paper">Latihan</h1>
        <p className="mt-1 text-sm text-paper-dim">
          Push-up &amp; squat lewat kamera → poin → naikkan stat petarung. 25 push-up = 1 poin,
          15 squat = 1 poin, maks {MAX_POINTS_PER_DAY} poin/hari.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Mode latihan">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'pushup'}
          onClick={() => changeMode('pushup')}
          className={`min-h-14 rounded-xl font-display text-xl font-semibold uppercase tracking-wide ${
            mode === 'pushup' ? 'bg-amber-brand text-[#1a1206]' : 'glass text-paper'
          }`}
        >
          Push-up
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'squat'}
          onClick={() => changeMode('squat')}
          className={`min-h-14 rounded-xl font-display text-xl font-semibold uppercase tracking-wide ${
            mode === 'squat' ? 'bg-amber-brand text-[#1a1206]' : 'glass text-paper'
          }`}
        >
          Squat
        </button>
      </div>

      <section className="glass overflow-hidden">
        <div className="relative aspect-video w-full bg-ink-950">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`absolute inset-0 h-full w-full object-cover ${running ? '' : 'hidden'}`}
            style={{ transform: 'scaleX(-1)' }}
            aria-label="Pratinjau kamera"
          />
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 h-full w-full ${running ? '' : 'hidden'}`}
            aria-hidden="true"
          />
          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="font-display text-2xl font-semibold uppercase text-paper">
                {camState === 'requesting'
                  ? 'Meminta izin kamera…'
                  : camState === 'denied'
                    ? 'Kamera ditolak'
                    : camState === 'unsupported' || camState === 'error'
                      ? 'Kamera bermasalah'
                      : 'Kamera belum nyala'}
              </p>
              <p className="max-w-sm text-sm leading-relaxed text-paper-dim">
                {camState === 'denied' || camState === 'error' || camState === 'unsupported'
                  ? camError
                  : 'Izinkan kamera, lalu posisikan badan penuh di dalam frame. Push-up paling akurat dari samping.'}
              </p>
              {modelState === 'loading' && <p className="text-sm text-amber-brand">Memuat model deteksi pose…</p>}
              {modelState === 'error' && (
                <p className="max-w-sm text-sm leading-relaxed text-red-brand">
                  Model pose gagal dimuat: {modelError}. Cek koneksi internet lalu muat ulang halaman.
                </p>
              )}
              {modelState === 'ready' && camState !== 'requesting' && (
                <button
                  type="button"
                  onClick={startCamera}
                  className="min-h-12 rounded-xl bg-amber-brand px-8 font-display text-lg font-semibold uppercase tracking-wide text-[#1a1206]"
                >
                  Mulai kamera
                </button>
              )}
            </div>
          )}
          {running && (
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
              <span className="rounded-md bg-ink-950/80 px-2 py-1 font-display text-sm font-semibold uppercase tracking-wider text-paper">
                {phase}
              </span>
              {capReached && (
                <span className="rounded-md bg-amber-brand px-2 py-1 font-display text-sm font-semibold uppercase tracking-wider text-[#1a1206]">
                  Cap tercapai
                </span>
              )}
            </div>
          )}
          {running && (
            <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-ink-950/80 px-2 py-1 font-display text-4xl font-bold leading-none text-paper">
              {repsToday}
              <span className="ml-1 text-base font-semibold text-paper-dim">/ {cap}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 p-4">
          <p key={invalidFlash} className={`min-h-6 text-base font-medium ${invalidFlash ? 'text-red-brand' : 'text-paper'}`} aria-live="polite">
            {feedback}
          </p>
          <div className="flex gap-2">
            {running ? (
              <button
                type="button"
                onClick={stopCamera}
                className="min-h-12 flex-1 rounded-xl bg-ink-700 px-4 font-display text-lg font-semibold uppercase tracking-wide text-paper"
              >
                Berhenti
              </button>
            ) : (
              <button
                type="button"
                onClick={startCamera}
                disabled={modelState !== 'ready'}
                className="min-h-12 flex-1 rounded-xl bg-amber-brand px-4 font-display text-lg font-semibold uppercase tracking-wide text-[#1a1206] disabled:opacity-40"
              >
                {modelState === 'ready' ? 'Mulai kamera' : modelState === 'loading' ? 'Memuat model…' : 'Model gagal'}
              </button>
            )}
            <button
              type="button"
              onClick={submitSession}
              disabled={submitting || (sessionPushups === 0 && sessionSquats === 0)}
              className="min-h-12 flex-1 rounded-xl border border-amber-brand px-4 font-display text-lg font-semibold uppercase tracking-wide text-amber-brand disabled:opacity-40"
            >
              {submitting ? 'Mengirim…' : `Kirim sesi (${sessionPushups + sessionSquats})`}
            </button>
          </div>
          {submitMsg && <p className="text-sm text-paper-dim">{submitMsg}</p>}
          <p className="text-xs leading-relaxed text-paper-mute">
            Rep sesi ini: {sessionPushups} push-up, {sessionSquats} squat. Rep baru dihitung kalau
            gerakannya penuh (siku/lutut sampai ambang) dan tidak terlalu cepat (min {MIN_REP_MS} ms/rep).
            Kirim sesi untuk menyimpan ke server — cap harian dicek server.
          </p>
        </div>
      </section>

      <section className="glass p-4">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-paper">Progres hari ini</h2>
        <div className="mt-3 space-y-3">
          {(
            [
              { label: 'Push-up', value: (day?.pushups ?? 0) + sessionPushups, cap: PUSHUP_CAP },
              { label: 'Squat', value: (day?.squats ?? 0) + sessionSquats, cap: SQUAT_CAP },
            ] as const
          ).map((row) => (
            <div key={row.label}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-paper-dim">{row.label}</span>
                <span className="font-display text-lg font-semibold text-paper">
                  {row.value} <span className="text-paper-mute">/ {row.cap}</span>
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuenow={row.value} aria-valuemax={row.cap} aria-label={`${row.label} hari ini`}>
                <div className="h-full rounded-full bg-amber-brand transition-all duration-300" style={{ width: `${Math.min(100, (row.value / row.cap) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-paper-dim">
          Poin didapat: <strong className="text-paper">{earned} / {MAX_POINTS_PER_DAY}</strong>
          {' · '}Poin tersedia: <strong className={available > 0 ? 'text-amber-brand' : 'text-paper'}>{available}</strong>
          {' '} (25 push-up = 1 poin, 15 squat = 1 poin)
        </p>
      </section>

      <section className="glass p-4">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-paper">Stat petarung</h2>
        <p className="mt-0.5 text-sm text-paper-dim">
          Semua mulai dari 10, maks 100. Di atas 80, tiap poin hanya setengah efek (diminishing returns).
        </p>
        {allocMsg && <p className="mt-2 text-sm text-amber-brand">{allocMsg}</p>}
        <ul className="mt-3 space-y-2">
          {STAT_KEYS.map((key) => (
            <li key={key} className="flex items-center gap-3 rounded-xl bg-ink-800 px-3 py-2.5">
              <span className="w-24 shrink-0 text-sm font-medium text-paper">{STAT_LABELS[key]}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-700">
                <div className="h-full rounded-full bg-amber-brand transition-all duration-300" style={{ width: `${status?.stats[key] ?? 10}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right font-display text-lg font-semibold text-paper">{status?.stats[key] ?? 10}</span>
              <button
                type="button"
                onClick={() => allocate(key)}
                disabled={available <= 0 || (status?.stats[key] ?? 10) >= 100}
                aria-label={`Tambah 1 poin ke ${STAT_LABELS[key]}`}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-amber-brand font-display text-xl font-bold text-[#1a1206] disabled:opacity-30"
              >
                +
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass p-4">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-paper">Deck jurus</h2>
        <p className="mt-0.5 text-sm text-paper-dim">
          Maks 6 kartu dari gaya apa pun — kartu dipakai 2x lebih sering di fight. Jurus khas
          (signature) di luar deck, dipakai 1x/fight.
        </p>
        {deck && (
          <>
            <p className="mt-2 text-sm text-paper-dim">
              Dipilih: <strong className="text-paper">{deckCards.length} / 6</strong>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {deck.availableKinds.map((k) => {
                const on = deckCards.includes(k.kind);
                return (
                  <button
                    key={k.kind}
                    type="button"
                    onClick={() => toggleDeckCard(k.kind)}
                    disabled={!on && deckCards.length >= 6}
                    aria-pressed={on}
                    className={`min-h-11 rounded-lg px-3 text-sm font-medium disabled:opacity-40 ${
                      on ? 'bg-amber-brand text-[#1a1206]' : 'bg-ink-800 text-paper'
                    }`}
                  >
                    {k.label} <span className="text-xs opacity-70">({k.styleLabel})</span>
                  </button>
                );
              })}
            </div>
            <label className="mt-4 block text-sm text-paper-dim">
              Jurus khas (signature, di luar deck)
              <select
                value={deckSignature ?? ''}
                onChange={(e) => setDeckSignature(e.target.value || null)}
                className="mt-1 block min-h-12 w-full rounded-xl border border-ink-700 bg-ink-800 px-3 text-paper"
              >
                <option value="">— Tanpa signature —</option>
                {deck.signatureOptions.map((o) => (
                  <option key={o.kind} value={o.kind}>{o.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={saveDeck}
              disabled={savingDeck}
              className="mt-3 min-h-12 w-full rounded-xl bg-amber-brand font-display text-lg font-semibold uppercase tracking-wide text-[#1a1206] disabled:opacity-40"
            >
              {savingDeck ? 'Menyimpan…' : 'Simpan deck'}
            </button>
            {deckMsg && <p className="mt-2 text-sm text-paper-dim">{deckMsg}</p>}
          </>
        )}
      </section>

      <section className="glass p-4 text-sm leading-relaxed text-paper-dim">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-paper">Gameplan</h2>
        <p className="mt-2">
          Gameplan (tempo + fokus jurus) dipilih sekali sebelum fight dan dikunci: penantang
          memilih saat mengirim tantangan, penerima saat menerima, dan Gas Tarung memakai
          pilihanmu saat menekan tombol. Tempo yang bisa dipilih:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {(Object.keys(GAMEPLAN_TEMPO_LABELS) as (keyof typeof GAMEPLAN_TEMPO_LABELS)[]).map((t) => (
            <li key={t}>{GAMEPLAN_TEMPO_LABELS[t]}</li>
          ))}
        </ul>
      </section>

      <section className="glass">
        <button
          type="button"
          onClick={() => setShowDebug((v) => !v)}
          aria-expanded={showDebug}
          className="flex min-h-12 w-full items-center justify-between px-4 font-display text-lg font-semibold uppercase tracking-wide text-paper"
        >
          Panel debug
          <span className="text-amber-brand">{showDebug ? '−' : '+'}</span>
        </button>
        {showDebug && (
          <div className="border-t border-ink-700 px-4 py-3 font-mono text-sm leading-relaxed text-paper-dim">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span>Model</span>
              <span className="text-right text-paper">{modelState === 'ready' ? 'siap' : modelState === 'loading' ? 'memuat…' : modelState === 'error' ? 'gagal' : '—'}</span>
              <span>Kamera</span>
              <span className="text-right text-paper">{camState}</span>
              <span>FPS</span>
              <span className="text-right text-paper">{fps || '—'}</span>
              <span>Fase</span>
              <span className="text-right text-paper">{debug?.phase ?? '—'}</span>
              <span>Sudut siku</span>
              <span className="text-right text-paper">{fmtAngle(debug?.elbow ?? null)}</span>
              <span>Sudut lutut</span>
              <span className="text-right text-paper">{fmtAngle(debug?.knee ?? null)}</span>
              <span>Sudut torso (plank)</span>
              <span className="text-right text-paper">{debug?.torsoAngleDeg === null || debug?.torsoAngleDeg === undefined ? '—' : `${debug.torsoAngleDeg.toFixed(0)}°`}</span>
              <span>Plank?</span>
              <span className="text-right text-paper">{debug ? (debug.plank ? 'ya' : 'bukan') : '—'}</span>
              <span>Siku min (rep ini)</span>
              <span className="text-right text-paper">{fmtAngle(debug?.minElbow ?? null)}</span>
              <span>Lutut min (rep ini)</span>
              <span className="text-right text-paper">{fmtAngle(debug?.minKnee ?? null)}</span>
              <span>Landmark</span>
              <span className="text-right text-paper">{debug?.landmarks ?? '—'}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-paper-mute">
              Acuan push-up: siku &gt;150° = atas, &lt;105° = bawah; rep dihitung kalau kembali ke
              atas dalam posisi plank (torso bahu→pinggul nyaris horizontal dari samping, atau
              memendek dari depan) dan rep ≥{MIN_REP_MS} ms. Acuan squat: lutut &gt;156° =
              berdiri, &lt;112° = jongkok.
            </p>
          </div>
        )}
      </section>

      <section className="glass p-4 text-sm leading-relaxed text-paper-dim">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-paper">Cara latihan</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Push-up: letakkan HP miring di lantai, kamera dari samping, badan penuh masuk frame.</li>
          <li>Squat: HP tegak 1–2 meter di depan, badan penuh masuk frame dari kepala sampai kaki.</li>
          <li>Pencahayaan terang, latar belakang polos, pakai baju kontras dengan latar.</li>
          <li>Gerakan pelan dan penuh dulu — kalau deteksi sudah benar, baru coba cepat.</li>
        </ul>
      </section>
    </main>
  );
}
