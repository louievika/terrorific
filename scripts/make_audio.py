#!/usr/bin/env python3
"""ART // LOGIN - original game audio, synthesized with numpy/scipy (no samples, no third-party audio). MIT.
Writes assets/audio/{hum,stinger,breathing,creak,static}.wav  (16-bit mono PCM).
  hum        8 s seamless loop, deep sub-bass (+ upper harmonics so phone speakers can hear it)
  stinger    violin-ish minor-second cluster + body impact, with a short room tail (the payoff beat)
  breathing  one ~4.8 s breath cycle (inhale / catch / wet exhale), played back-to-back by the game
  creak      slow stick-slip hinge creak (door), ~1.9 s
  static     4 s phone-line static with a hard 500 ms digital-silence gap in the middle (the 'beat 2' silence)
Run: python3 scripts/make_audio.py [outdir]"""
import sys, os, wave, numpy as np
from scipy import signal
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'audio')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1307)

def save(name, x, sr, peak=0.89):
    x = np.asarray(x, dtype=np.float64); m = np.max(np.abs(x)) or 1.0
    pcm = np.int16(np.clip(x / m * peak, -1, 1) * 32767)
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes())
    print('%-14s %5.2fs  %6.1f KB' % (name + '.wav', len(x) / sr, os.path.getsize(os.path.join(OUT, name + '.wav')) / 1024))

def bandpass(x, lo, hi, sr, order=2):
    sos = signal.butter(order, [lo, hi], 'bandpass', fs=sr, output='sos'); return signal.sosfilt(sos, x)
def lowpass(x, f, sr, order=2): return signal.sosfilt(signal.butter(order, f, 'low', fs=sr, output='sos'), x)
def highpass(x, f, sr, order=2): return signal.sosfilt(signal.butter(order, f, 'high', fs=sr, output='sos'), x)
def periodic_noise(n, lo, hi, sr):
    """noise shaped in the FFT domain -> exactly periodic over n samples (seamless loop)"""
    X = np.fft.rfft(rng.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / sr)
    X *= ((f >= lo) & (f <= hi)) / np.sqrt(np.maximum(f, 1.0)); return np.fft.irfft(X, n)
def env(n, a, d, sr, curve=2.0):
    t = np.arange(n) / sr; e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d * curve); return e

# ---------------------------------------------------------------- hum (loop)
sr = 22050; T = 8.0; n = int(sr * T); t = np.arange(n) / sr
def part(f, a, am_f=0.0, am_d=0.0, ph=0.0): return a * np.sin(2 * np.pi * f * t + ph) * (1 + am_d * np.sin(2 * np.pi * am_f * t))
x = (part(41.0, 1.0, 0.125, 0.25) + part(41.25, 0.55, 0.25, 0.3, 1.1) + part(55.0, 0.5, 0.125, 0.4, 2.0) + part(82.0, 0.42, 0.25, 0.2)
     + part(110.0, 0.30, 0.125, 0.5, 0.5) + part(123.0, 0.12, 0.375, 0.5) + part(164.0, 0.16, 0.25, 0.3) + part(220.0, 0.06, 0.125, 0.6))
x += 0.25 * periodic_noise(n, 25, 260, sr) / np.std(periodic_noise(n, 25, 260, sr)) * 0.25
x = np.tanh(1.6 * x / np.max(np.abs(x))) ; save('hum', x, sr, 0.8)

# ---------------------------------------------------------------- breathing (one cycle)
sr = 22050; T = 4.8; n = int(sr * T); t = np.arange(n) / sr
def sm(a, b, t0, t1): return np.clip((t - t0) / (t1 - t0), 0, 1) * (b - a) + a
w = rng.standard_normal(n)
b1, b2, b3 = bandpass(w, 250, 700, sr), bandpass(w, 700, 1800, sr), bandpass(w, 1800, 4200, sr)
inh = np.sin(np.pi * np.clip((t - 0.1) / 1.9, 0, 1)) ** 1.5                       # 0.1..2.0
exh = np.where(t > 2.5, np.sin(np.pi * np.clip((t - 2.5) / 2.1, 0, 1)) ** 1.2, 0)  # 2.5..4.6
catch = np.exp(-((t - 2.25) / 0.06) ** 2) * 0.35                                  # little wet catch between breaths
x = inh * (0.55 * b1 + 0.8 * b2 * sm(0.3, 1, 0.1, 1.6) + 0.25 * b3) + exh * (0.9 * b1 + 0.5 * b2 + 0.12 * b3 * 1.0)
# throat: a wavering glottal buzz under the exhale (rasp), formant-filtered
f0 = 62 + 10 * np.sin(2 * np.pi * 0.6 * t) + 4 * rng.standard_normal(n).cumsum() / np.sqrt(n) * 6
ph = 2 * np.pi * np.cumsum(f0) / sr; buzz = signal.sawtooth(ph) * 0.5 + 0.5 * np.sign(np.sin(ph * 0.5))
buzz = bandpass(buzz, 180, 900, sr) * exh * (0.55 + 0.45 * np.sin(2 * np.pi * 9 * t))
x += 0.55 * buzz + catch * bandpass(w, 400, 1500, sr)
x += 0.5 * (np.sin(2 * np.pi * 46 * t) * (inh * 0.6 + exh * 0.9))                  # chest sub
x *= np.minimum(1, t / 0.05) * np.minimum(1, (T - t) / 0.12)
save('breathing', x, sr, 0.85)

# ---------------------------------------------------------------- creak (door hinge, stick-slip)
sr = 22050; T = 1.9; n = int(sr * T); t = np.arange(n) / sr
slow = 0.5 - 0.5 * np.cos(2 * np.pi * np.clip(t / T, 0, 1) * 0.85)                 # hinge speed: ease up then down
wander = np.cumsum(rng.standard_normal(n)); wander = lowpass(wander / np.max(np.abs(wander)), 9, sr, 2)
f0 = 150 + 330 * slow + 70 * wander + 40 * np.sin(2 * np.pi * 3.1 * t)
ph = 2 * np.pi * np.cumsum(f0) / sr
pulse = signal.sawtooth(ph, 0.12) + 0.4 * signal.square(ph * 1.5, 0.3)
stick = np.clip(0.5 + 0.9 * np.sin(2 * np.pi * (7 + 9 * slow) * t + 2 * wander), 0, 1) ** 2   # stick-slip amplitude chatter
res = bandpass(pulse, 500, 900, sr) + 0.9 * bandpass(pulse, 1200, 1800, sr) + 0.55 * bandpass(pulse, 2300, 3300, sr) + 0.6 * lowpass(pulse, 220, sr)
x = res * stick * (0.25 + 0.75 * slow) * np.minimum(1, t / 0.08) * np.minimum(1, (T - t) / 0.25)
x += 0.07 * bandpass(rng.standard_normal(n), 900, 4500, sr) * stick * slow   # rust grit
save('creak', x, sr, 0.8)

# ---------------------------------------------------------------- stinger (violin-ish cluster + impact + tail)
sr = 32000; T = 2.6; n = int(sr * T); t = np.arange(n) / sr
notes = [880.0, 932.33, 1318.5, 1396.9, 1864.7]
amp_e = np.minimum(1, t / 0.012) * np.exp(-np.maximum(t - 0.05, 0) / 0.55)
sw = np.zeros(n)
for i, f in enumerate(notes):
    vib = 1 + (0.012 + 0.012 * np.clip(t / 0.8, 0, 1)) * np.sin(2 * np.pi * (5.4 + 0.3 * i) * t + i)
    fi = f * vib * (1 - 0.055 * np.clip(t / 1.4, 0, 1)) * (1 + 0.0009 * i)
    ph = 2 * np.pi * np.cumsum(fi) / sr
    s = signal.sawtooth(ph, 0.9) + 0.5 * signal.sawtooth(ph * 1.003, 0.9)          # two slightly detuned bowed strings
    sw += s * (1.0 if i < 3 else 0.55)
body = bandpass(sw, 700, 3600, sr) + 0.5 * bandpass(sw, 250, 520, sr)
bow = bandpass(rng.standard_normal(n), 3000, 9000, sr) * 0.05 * (np.exp(-t / 0.5))
imp_f = 120 * np.exp(-t / 0.35) + 26
imp = np.sin(2 * np.pi * np.cumsum(imp_f) / sr) * np.minimum(1, t / 0.004) * np.exp(-t / 0.5)
crash = bandpass(rng.standard_normal(n), 400, 5000, sr) * np.exp(-t / 0.09) * np.minimum(1, t / 0.002)
x = 0.34 * body * amp_e + 0.2 * bow + 1.0 * imp + 0.55 * crash
ir_n = int(sr * 1.1); ir = rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / sr / 0.28); ir = lowpass(ir, 5000, sr)
wet = signal.fftconvolve(x, ir)[:n] * 0.09; x = x + wet
x *= np.minimum(1, (T - t) / 0.4)
save('stinger', x, sr, 0.92)

# ---------------------------------------------------------------- static (phone line, with a hard silence gap)
sr = 16000; T = 4.0; n = int(sr * T); t = np.arange(n) / sr
hiss = bandpass(rng.standard_normal(n), 300, 3400, sr, 3) * 0.5
crack = np.zeros(n); idx = rng.random(n) < 22 / sr
crack[idx] = rng.standard_normal(idx.sum()) * rng.choice([0.4, 1.0, 2.2], idx.sum(), p=[0.6, 0.3, 0.1])
crack = bandpass(signal.lfilter([1], [1, -0.82], crack), 400, 3800, sr)
hum60 = 0.04 * np.sin(2 * np.pi * 60 * t) + 0.02 * np.sin(2 * np.pi * 180 * t)
warble = 0.55 + 0.45 * np.sin(2 * np.pi * 0.7 * t + 1.3) * np.sin(2 * np.pi * 0.23 * t)
x = (hiss * warble + crack * 0.7 + hum60)
a, b = int(1.5 * sr), int(2.0 * sr)                                     # 500 ms of absolute silence
x[:a] *= np.minimum(1, t[:a] / 0.25) ; x[b:] *= np.minimum(1, (T - t[b:]) / 0.9)
x[a - 48:a] *= np.linspace(1, 0, 48); x[b:b + 48] *= np.linspace(0, 1, 48)
x[a:b] = 0.0
x[b + 1500:b + 1500 + 900] += 0.0                                       # (room for a click the game adds)
save('static', x, sr, 0.7)
