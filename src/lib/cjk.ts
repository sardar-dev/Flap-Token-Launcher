// Matches CJK Unified Ideographs (the core Chinese character block) plus the
// Extension A and Compatibility Ideographs blocks, which together cover the
// characters actually used in Chinese token names/symbols in practice.
// Deliberately does NOT match Hiragana/Katakana (Japanese) or Hangul
// (Korean) ranges, so Japanese/Korean-only names aren't misclassified.
const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

export function containsChinese(text: string | null | undefined): boolean {
  if (!text) return false;
  return CJK_REGEX.test(text);
}
