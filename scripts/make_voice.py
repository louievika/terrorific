#!/usr/bin/env python3
"""ART // LOGIN - Art's voice (Phase D). Offline, open-source, build-time only: the game ships only the resulting MP3s + lines.json.

Engine : Piper (piper-tts 1.8.0, GPL-3.0-or-later; used only as a build tool, its output is not a derivative work of the engine)
Voice  : en_US-joe-medium (VITS/ONNX; dataset licence CC0 per the voice's MODEL_CARD). Picked over ryan (CC BY-NC-SA) and hfc_male (CC BY-NC-SA)
         because those are non-commercial; joe is the lowest-pitched clean-licence male voice (median F0 ~89 Hz vs john 104, norman 105, bryce 127).
Post   : ffmpeg rubberband pitch x0.78 / tempo x0.88 (formants shift down with pitch -> bigger throat), a sub-octave layer, dark EQ,
         soft saturation, compressor, a cold stone-room tail, 40 ms of lead-in. Word timings come from Piper's phoneme alignments, scaled by the
         time-stretch.

Setup (verified on Debian 13 / Python 3.13, ffmpeg 7.1 with rubberband + libmp3lame):
    python3 -m venv tools-tts && tools-tts/bin/pip install "piper-tts[alignment]==1.8.0" scipy
    mkdir -p tts-models && cd tts-models
    B=https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium
    curl -L -O $B/en_US-joe-medium.onnx -O $B/en_US-joe-medium.onnx.json
Run  : tools-tts/bin/python scripts/make_voice.py [models_dir=tts-models] [outdir=assets/voice]
"""
import sys, os, json, subprocess, tempfile, wave
import numpy as np
from scipy import signal

MODELS = sys.argv[1] if len(sys.argv) > 1 else 'tts-models'
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'voice')
os.makedirs(OUT, exist_ok=True)
PITCH, TEMPO, LEAD = 0.78, 0.88, 0.04
SR = 22050

# id, kind, text (5-15 words each)
LINES = [
    ('intro',        'intro',   'Hello. I have been waiting in the dark for you.'),
    ('night1',       'night',   'Night one. Watch the doors. I only knock once.'),
    ('night2',       'night',   'Night two. You kept the lights on. How very kind.'),
    ('night3',       'night',   'Night three. I can hear you breathing from here.'),
    ('night4',       'night',   'Night four. Nobody is coming for you. Nobody ever did.'),
    ('night5',       'night',   'Last night. Let me show you how I smile.'),
    ('taunt1',       'taunt',   'Why are you hiding? I only want to play.'),
    ('taunt2',       'taunt',   'Look at me. Look at me while I smile.'),
    ('taunt3',       'taunt',   'Did you really think a door would stop me?'),
    ('lore_receipt', 'lore',    'Black paint, white powder, one hat. Every costume needs an audience.'),
    ('lore_diary',   'lore',    'Little girl, you counted wrong. The thirteenth heart is waiting for you.'),
    ('lore_call',    'lore',    'You should not have answered. Now I know your voice.'),
    ('win',          'ending',  'You survived. Go home. I will remember your face.'),
    ('bad',          'ending',  'You stayed too long. Now the house keeps you.'),
]

from piper import PiperVoice
voice = PiperVoice.load(os.path.join(MODELS, 'en_US-joe-medium.onnx'), include_alignments=True)
assert voice.config.sample_rate == SR

import re
def nph(word):
    """phoneme count of one word (espeak), used to split a sentence's phoneme timeline between its words"""
    return max(1, sum(len([q for q in g if q.strip() and q not in '.,?!;:-']) for g in voice.phonemize(re.sub(r'[^A-Za-z\']', '', word))))

def synth(text):
    """-> float audio, [(t0, t1)] per word (seconds). Piper chunks = sentences; inside a sentence the phoneme timeline
    (espeak merges clitics, so spaces are unreliable) is divided between words in proportion to each word's phoneme count."""
    sents = [x for x in re.findall(r'[^.?!]+[.?!]?', text) if x.strip()]
    audio, spans, pos = [], [], 0
    chunks = list(voice.synthesize(text, include_alignments=True)); assert len(chunks) == len(sents), (len(chunks), sents)
    for ch, sent in zip(chunks, sents):
        a = ch.audio_float_array; audio.append(a)
        al = ch.phoneme_alignments; assert al, 'no alignments'
        tot = sum(int(x.num_samples) for x in al); k = len(a) / tot
        ph, t = [], pos                                                  # voiced phonemes with (start, end)
        for x in al:
            n = int(x.num_samples) * k
            if x.phoneme not in ('^', '$', ' ') and x.phoneme not in '.,?!;:-': ph.append((t, t + n))
            t += n
        ws = sent.split(); cs = [nph(w) for w in ws]; tc = sum(cs); acc = 0
        for w, c in zip(ws, cs):
            i0 = int(round(acc * len(ph) / tc)); acc += c; i1 = max(i0 + 1, int(round(acc * len(ph) / tc)))
            spans.append((ph[min(i0, len(ph) - 1)][0] / SR, ph[min(i1, len(ph)) - 1][1] / SR))
        pos += len(a)
    return np.concatenate(audio), spans

def ffm(args): subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, check=True)
def rb(x, pitch, tempo):
    with tempfile.TemporaryDirectory() as d:
        i, o = os.path.join(d, 'i.wav'), os.path.join(d, 'o.wav'); pcm = np.int16(np.clip(x, -1, 1) * 32767)
        with wave.open(i, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
        ffm(['-i', i, '-af', 'rubberband=pitch=%f:tempo=%f:transients=smooth' % (pitch, tempo), o])
        with wave.open(o) as w: assert w.getframerate() == SR; return np.frombuffer(w.readframes(w.getnframes()), np.int16) / 32768.0

def sos(kind, f, order=2): return signal.butter(order, f, kind, fs=SR, output='sos')
rng = np.random.default_rng(666)
def process(x):
    main = rb(x, PITCH, TEMPO)
    under = rb(x, PITCH * 0.5, TEMPO)                                  # sub-octave growl layer
    n = min(len(main), len(under)); main, under = main[:n], under[:n]
    under = signal.sosfilt(sos('low', 420), under)
    y = main + 0.55 * under
    y = signal.sosfilt(sos('high', 55), y)
    low = signal.sosfilt(sos('low', 160), y); y = y + 0.5 * low        # chest
    y = y - 0.25 * signal.sosfilt(sos('band', [2800, 4600]), y)         # tame the synthetic sizzle
    y = np.tanh(2.2 * y / (np.max(np.abs(y)) + 1e-9)) * 0.9             # soft saturation
    y = signal.sosfilt(sos('low', 7200), y)
    # simple feed-forward compressor
    env = np.maximum(signal.sosfilt(sos('low', 18), np.abs(y)), 0); g = np.minimum(1.0, (0.22 / (env + 1e-4)) ** 0.6); y = y * g
    # cold room tail (diffuse, dark, ~1.1 s)
    irn = int(SR * 1.1); ir = rng.standard_normal(irn) * np.exp(-np.arange(irn) / SR / 0.32); ir = signal.sosfilt(sos('low', 2600), ir); ir[0] = 0
    y = np.concatenate([np.zeros(int(LEAD * SR)), y, np.zeros(int(0.5 * SR))])
    wet = signal.fftconvolve(y, ir)[:len(y)] * 0.07
    y = y + wet
    y = signal.sosfilt(sos('high', 50), y)
    return y

meta = {'engine': 'piper-tts 1.8.0 (GPL-3.0-or-later, build tool only)', 'voice': 'en_US-joe-medium (CC0 dataset, VITS/ONNX)',
        'post': 'ffmpeg rubberband pitch %.2f tempo %.2f + sub-octave layer, EQ, saturation, compressor, stone-room tail' % (PITCH, TEMPO),
        'format': 'mono MP3, 22.05 kHz, ~56 kbps (decodes on iOS Safari); times are seconds from file start (includes %d ms lead-in)' % int(LEAD * 1000),
        'lines': []}
for lid, kind, text in LINES:
    nwords = len(text.split()); assert 5 <= nwords <= 15, (lid, nwords)
    raw, wt = synth(text)
    assert len(wt) == nwords, (lid, len(wt), nwords, text)
    y = process(raw)
    stretch = (len(y) - int((LEAD + 0.5) * SR)) / len(raw)              # output/input length ratio of the time-stretch
    y = y / (np.max(np.abs(y)) + 1e-9) * 0.89
    speech_end = LEAD + wt[-1][1] * stretch
    wav = os.path.join(OUT, lid + '.tmp.wav'); mp3 = os.path.join(OUT, lid + '.mp3')
    with wave.open(wav, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(np.int16(np.clip(y, -1, 1) * 32767).tobytes())
    ffm(['-i', wav, '-c:a', 'libmp3lame', '-b:a', '56k', '-ac', '1', mp3]); os.remove(wav)
    words = [{'w': w, 't0': round(LEAD + a * stretch, 3), 't1': round(LEAD + b * stretch, 3)} for w, (a, b) in zip(text.split(), wt)]
    meta['lines'].append({'id': lid, 'kind': kind, 'text': text, 'file': 'assets/voice/%s.mp3' % lid,
                          'duration': round(len(y) / SR, 3), 'speech': round(speech_end, 3), 'words': words})
    print('%-13s %5.2fs speech %5.2fs %5.1f KB  %s' % (lid, len(y) / SR, speech_end, os.path.getsize(mp3) / 1024, text))
json.dump(meta, open(os.path.join(OUT, 'lines.json'), 'w'), indent=1)
print('wrote lines.json,', len(LINES), 'lines')
