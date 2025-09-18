from pathlib import Path
import re

path = Path('src/artikelen.html')
text = path.read_text(encoding='utf-8')

for idx in range(14):
    pattern = re.compile(rf'data-article-target="{idx}"[^>]*x-bind:aria-current="[^"]*"')
    replacement = f'data-article-target="{idx}" x-bind:class="cardClasses({idx})" x-bind:aria-current="currentIndex === {idx} ? \"true\" : null"'
    text, count = pattern.subn(replacement, text, count=1)
    if count == 0:
        # if pattern not found, try to insert attribute separately
        text = text.replace(f'data-article-target="{idx}" x-bind:class="cardClasses({idx})"', replacement)

path.write_text(text, encoding='utf-8')
