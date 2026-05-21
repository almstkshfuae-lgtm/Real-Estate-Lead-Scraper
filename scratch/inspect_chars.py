from pathlib import Path
line = Path('lib/ai.ts').read_text(encoding='utf-8').splitlines()[278]
print(line)
print([ord(c) for c in line])
