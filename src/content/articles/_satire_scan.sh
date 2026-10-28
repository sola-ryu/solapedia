#!/usr/bin/env bash
cd ~/workspace/git/solapedia/src/content/articles

echo "=== SHORT ARTICLES (< 20 lines) ==="
for f in *.md; do
  n=$(wc -l < "$f")
  if [ "$n" -lt 20 ]; then
    echo "$n $f"
  fi
done | sort -n

echo ""
echo "=== REAL SCIENTISTS/PERPLES MENTIONED ==="
grep -l "Einstein\|Newton\|Darwin\|Tesla\|Edison\|Curie\|Pasteur\|Fleming\|Mendel\|Hawking\|Galileo" *.md 2>/dev/null

echo ""
echo "=== REAL TECH PEOPLE MENTIONED ==="
grep -l "Elon Musk\|Steve Jobs\|Bill Gates\|Mark Zuckerberg\|Jeff Bezos\|Tim Cook" *.md 2>/dev/null

echo ""
echo "=== ARTICLES WITHOUT SITE-WORD PATTERNS (look 'real') ==="
# Articles that mention "America" or a country name in the first sentence without a fake inventor
grep -l "The .* is a " *.md 2>/dev/null | head -30
