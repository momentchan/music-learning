"""Build the small, redistributable instrument banks (requires ffmpeg and network).

Sources are pinned so regenerated assets do not silently change. See
public/audio/ATTRIBUTION.md for the recording credits and CC BY 3.0 license.
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
REVISION = '622c2f1c32c8cfce4158ddc3eb26e518ddef37e5'
SOURCE = f'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/{REVISION}'
BANKS = {
    'pluck': ('guitar-acoustic', ['D2', 'E2', 'G2', 'As2', 'Cs3', 'E3', 'G3', 'As3', 'Cs4', 'E4', 'G4', 'As4', 'D5']),
    'keys': ('piano', ['C2', 'Fs2', 'C3', 'Fs3', 'C4', 'Fs4', 'C5', 'Fs5', 'C6']),
}


def prepare(task):
    bank, directory, name = task
    url = f'{SOURCE}/samples/{directory}/{name}.mp3'
    source = urllib.request.urlopen(url, timeout=45).read()
    output = ROOT / 'public' / 'audio' / directory / f'{name}.mp3'
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='guitar-lab-sample-') as temporary:
        raw = Path(temporary) / 'source.mp3'
        raw.write_bytes(source)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(raw), '-t', '6',
                        '-af', 'afade=t=in:st=0:d=0.002,afade=t=out:st=5.85:d=0.15',
                        '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '96k',
                        '-map_metadata', '-1', str(output)], check=True)
    pitch = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[name[0]] + ('s' in name)
    return bank, {'midi': (int(name[-1]) + 1) * 12 + pitch,
                  'file': f'{directory}/{name}.mp3', 'bytes': output.stat().st_size,
                  'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                  'sourceSha256': hashlib.sha256(source).hexdigest()}


if __name__ == '__main__':
    tasks = [(bank, directory, name) for bank, (directory, names) in BANKS.items() for name in names]
    samples = {bank: [] for bank in BANKS}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for bank, sample in pool.map(prepare, tasks):
            samples[bank].append(sample)
            print(f"{sample['file']}: {sample['bytes']} bytes", flush=True)
    total = sum(sample['bytes'] for bank in samples.values() for sample in bank)
    if total > 2_000_000:
        raise RuntimeError(f'Sample banks exceed the 2 MB budget: {total}')
    manifest = {'source': SOURCE, 'revision': REVISION, 'license': 'CC-BY-3.0', 'instruments': samples}
    payload = json.dumps(manifest, indent=2) + '\n'
    (ROOT / 'public' / 'audio' / 'manifest.json').write_text(payload, encoding='utf-8')
    (ROOT / 'src' / 'audio' / 'sample-manifest.json').write_text(payload, encoding='utf-8')
    print(f'{len(tasks)} recordings, {total:,} bytes total', flush=True)
