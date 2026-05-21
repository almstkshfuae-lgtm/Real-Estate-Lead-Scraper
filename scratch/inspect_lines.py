from pathlib import Path
lines = Path('lib/ai.ts').read_text(encoding='utf-8').splitlines()
for i in range(275, 281):
    print(i+1, repr(lines[i]))
