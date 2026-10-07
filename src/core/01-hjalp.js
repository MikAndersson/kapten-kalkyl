/* ---------- Hjälpfunktioner ---------- */

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

// Sparar små inställningar i webbläsaren (aktuell bild, svar, röst, egna lektioner).
// Fungerar tyst även om webbläsaren blockerar lagring.
const storage = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem('kk-' + key);
      return value == null ? fallback : JSON.parse(value);
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('kk-' + key, JSON.stringify(value)); return true; } catch (e) { return false; }
  },
};

const escapeHtml = text => String(text)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const xmlEscape = text => String(text == null ? '' : text)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Visar tal med svenskt decimalkomma: 7.5 -> "7,5"
const swedishNumber = n => String(n).replace('.', ',');

// Delar upp en text i stycken om tre meningar, för pratbubblan.
function toParagraphs(text) {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-ZÅÄÖ"])/);
  const paragraphs = [];
  for (let i = 0; i < sentences.length; i += 3) {
    paragraphs.push(`<p>${escapeHtml(sentences.slice(i, i + 3).join(' '))}</p>`);
  }
  return paragraphs.join('');
}
