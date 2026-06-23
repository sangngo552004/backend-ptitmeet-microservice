const SOUND_PREF_KEYS = {
  chat: "ptitmeet_chatNotif",
  handRaise: "ptitmeet_raiseHandNotif",
  joinLeave: "ptitmeet_joinLeaveNotif",
};

let audioContext = null;
let lastPlayedAtByType = {};

const DEFAULT_PREFS = {
  chat: true,
  handRaise: true,
  joinLeave: true,
};

const getAudioContext = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
};

const isSoundEnabled = (type) => {
  if (typeof window === "undefined") {
    return false;
  }

  const prefKey = SOUND_PREF_KEYS[type];
  if (!prefKey) {
    return true;
  }

  const saved = window.localStorage.getItem(prefKey);
  if (saved == null) {
    return DEFAULT_PREFS[type] ?? true;
  }

  try {
    return JSON.parse(saved);
  } catch {
    return DEFAULT_PREFS[type] ?? true;
  }
};

const playTone = ({ frequencies, duration = 0.18, volume = 0.035, throttleMs = 700, type }) => {
  if (!isSoundEnabled(type)) {
    return;
  }

  const nowMs = Date.now();
  if (nowMs - (lastPlayedAtByType[type] || 0) < throttleMs) {
    return;
  }
  lastPlayedAtByType[type] = nowMs;

  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  const startAt = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, startAt);
  master.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  master.connect(ctx.destination);

  frequencies.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.8 / (index + 1), startAt);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  });
};

export const playMeetingCue = (type) => {
  if (type === "chat") {
    playTone({
      type,
      frequencies: [660, 880],
      duration: 0.16,
      volume: 0.03,
      throttleMs: 800,
    });
    return;
  }

  if (type === "handRaise") {
    playTone({
      type,
      frequencies: [523.25, 659.25, 783.99],
      duration: 0.22,
      volume: 0.04,
      throttleMs: 900,
    });
    return;
  }

  if (type === "joinLeave") {
    playTone({
      type,
      frequencies: [440, 554.37],
      duration: 0.14,
      volume: 0.028,
      throttleMs: 1200,
    });
  }
};
