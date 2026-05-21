from pathlib import Path
text = Path('lib/ai.ts').read_text(encoding='utf-8')
print(text.count('`'))
