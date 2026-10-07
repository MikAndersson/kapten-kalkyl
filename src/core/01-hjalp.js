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
  // Raderar allt Kapten Kalkyl har sparat i den här webbläsaren
  clearAll() {
    try { Object.keys(localStorage).filter(k => k.startsWith('kk-')).forEach(k => localStorage.removeItem(k)); return true; } catch (e) { return false; }
  },
};

/* Integritetsrutan längst ner. Knappen raderar det som sparats (kräver två klick). */
function setupPrivacy() {
  const button = document.getElementById('clear-storage');
  if (!button) return;
  button.onclick = () => {
    if (!button.dataset.armed) {
      button.dataset.armed = '1';
      button.textContent = 'Klicka igen för att radera';
      setTimeout(() => { delete button.dataset.armed; button.textContent = 'Radera det som sparats'; }, 4000);
      return;
    }
    storage.clearAll();
    location.reload();
  };
}

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
