/* ==========================================================================
   FIGURER
   Färdiga SVG-figurer som lektionerna hämtar med <figur namn="…"/>.
   Lägg till en egen figur genom att skriva en ny rad här, eller lägg en
   <svg> direkt inuti <figur> i XML-filen.
   Klasser: ln = linje, fl = fylld yta, ac = accentlinje, dash = streckad,
            dot/dotb = punkt, text.a/text.b = färgad text.
   ========================================================================== */
const FIGURER = {
  'rektangel':
    `<svg class="fig" viewBox="0 0 200 120"><rect class="fl" x="20" y="20" width="150" height="70"/><text x="85" y="108">l</text><text x="176" y="60">b</text></svg>`,
  'triangel':
    `<svg class="fig" viewBox="0 0 200 120"><path class="fl" d="M20 95 L180 95 L120 20 Z"/><line class="dash" x1="120" y1="20" x2="120" y2="95"/><text x="95" y="113">b</text><text x="126" y="62">h</text></svg>`,
  'cirkel':
    `<svg class="fig" viewBox="0 0 200 120"><circle class="fl" cx="100" cy="58" r="45"/><line class="ac" x1="100" y1="58" x2="145" y2="58"/><text x="115" y="52" class="a">r</text></svg>`,
  'trapets':
    `<svg class="fig" viewBox="0 0 200 120"><path class="fl" d="M50 25 L150 25 L180 95 L20 95 Z"/><text x="95" y="18">a</text><text x="95" y="113">b</text><line class="dash" x1="60" y1="25" x2="60" y2="95"/><text x="64" y="64">h</text></svg>`,
  'ratblock':
    `<svg class="fig" viewBox="0 0 240 140"><path class="fl" d="M30 60 L170 60 L170 120 L30 120 Z"/><path class="fl" d="M30 60 L70 25 L210 25 L170 60 Z"/><path class="fl" d="M170 60 L210 25 L210 85 L170 120 Z"/><text x="92" y="136">l</text><text x="195" y="112">b</text><text x="14" y="94">h</text></svg>`,
  'tyngdtriangel':
    `<svg class="fig" viewBox="0 0 220 150"><path class="fl" d="M110 12 L205 138 L15 138 Z"/><line class="ln" x1="45" y1="92" x2="175" y2="92"/><line class="ln" x1="110" y1="92" x2="110" y2="138"/><text x="102" y="72" class="b" font-size="20">G</text><text x="68" y="122" font-size="18">γ</text><text x="140" y="122" font-size="18">V</text></svg>`,
  'interpolation':
    `<svg class="fig" viewBox="0 0 300 200"><line class="ln" x1="40" y1="170" x2="285" y2="170"/><line class="ln" x1="40" y1="170" x2="40" y2="15"/>
<line class="ac" x1="80" y1="135" x2="250" y2="45"/><circle class="dotb" cx="80" cy="135" r="5"/><circle class="dotb" cx="250" cy="45" r="5"/><circle class="dot" cx="165" cy="90" r="6"/>
<line class="dash" x1="80" y1="135" x2="80" y2="170"/><line class="dash" x1="250" y1="45" x2="250" y2="170"/><line class="dash" x1="165" y1="90" x2="165" y2="170"/><line class="dash" x1="40" y1="90" x2="165" y2="90"/>
<text x="72" y="188" class="b">x₁</text><text x="242" y="188" class="b">x₂</text><text x="160" y="188" class="a">x</text><text x="56" y="128" class="b">y₁</text><text x="226" y="40" class="b">y₂</text><text x="12" y="94" class="a">y?</text></svg>`,
  'rata-linjen':
    `<svg class="fig" viewBox="0 0 280 190"><line class="ln" x1="30" y1="165" x2="270" y2="165"/><line class="ln" x1="30" y1="165" x2="30" y2="10"/><line class="ac" x1="30" y1="130" x2="250" y2="30"/><circle class="dot" cx="30" cy="130" r="5"/><line class="dash" x1="120" y1="89" x2="200" y2="89"/><line class="dash" x1="200" y1="89" x2="200" y2="53"/><text x="40" y="146" class="a">m</text><text x="150" y="104">Δx</text><text x="206" y="76">Δy</text><text x="160" y="40" class="b">k = Δy/Δx</text></svg>`,
  'pythagoras':
    `<svg class="fig" viewBox="0 0 260 170"><path class="fl" d="M30 145 L220 145 L220 30 Z"/><rect x="206" y="131" width="14" height="14" fill="none" stroke="var(--ink)" stroke-width="1.5"/><text x="118" y="164">a</text><text x="228" y="92">b</text><text x="108" y="80" class="a">c (hypotenusa)</text></svg>`,
  'trig-triangel':
    `<svg class="fig" viewBox="0 0 280 180"><path class="fl" d="M30 150 L240 150 L240 35 Z"/><rect x="226" y="136" width="14" height="14" fill="none" stroke="var(--ink)" stroke-width="1.5"/><path class="ac" d="M75 150 A45 45 0 0 0 70 128"/><text x="82" y="143" class="a">v</text><text x="100" y="170">närliggande katet</text><text x="246" y="96">motstående</text><text x="70" y="80" class="b">hypotenusa</text></svg>`,
  'takstol':
    `<svg class="fig" viewBox="0 0 260 120"><path class="fl" d="M20 100 L240 100 L130 42 Z"/><line class="dash" x1="130" y1="42" x2="130" y2="100"/><text x="136" y="78">h</text><text x="62" y="116">5 m</text><text x="40" y="94" class="a">28°</text></svg>`,
  'vektor':
    `<svg class="fig" viewBox="0 0 260 150"><line class="dash" x1="20" y1="110" x2="250" y2="110"/><line class="ac" x1="40" y1="110" x2="200" y2="40"/><polygon class="dot" points="200,40 186,42 192,52"/><line class="dash" x1="200" y1="40" x2="200" y2="110"/><text x="110" y="126">x</text><text x="206" y="80">y</text><text x="100" y="64" class="a">|R|</text></svg>`,
  'balk-tyngdpunkt':
    `<svg class="fig" viewBox="0 0 300 110"><rect class="fl" x="20" y="60" width="260" height="16"/><rect x="225" y="30" width="30" height="30" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2"/><circle class="dotb" cx="150" cy="68" r="5"/><text x="128" y="98">3 m</text><text x="222" y="22" class="a">5 m</text><text x="20" y="98" class="m">0</text></svg>`,
  'koordinatsystem':
    `<svg class="fig" viewBox="0 0 260 200"><line class="ln" x1="20" y1="110" x2="250" y2="110"/><line class="ln" x1="130" y1="190" x2="130" y2="10"/><polygon class="dotb" points="250,110 242,106 242,114"/><polygon class="dotb" points="130,10 126,18 134,18"/><text x="240" y="128">x</text><text x="138" y="20">y</text><line class="ac" x1="70" y1="170" x2="210" y2="30"/><circle class="dot" cx="130" cy="110" r="4"/><circle class="dot" cx="150" cy="90" r="4"/><circle class="dot" cx="170" cy="70" r="4"/><circle class="dot" cx="190" cy="50" r="4"/><line class="dash" x1="190" y1="50" x2="190" y2="110"/><line class="dash" x1="130" y1="50" x2="190" y2="50"/><text x="196" y="48" class="a">(2, 5)</text><text x="134" y="126" class="m">0</text><text x="186" y="126" class="m">2</text><text x="112" y="54" class="m">5</text><text x="200" y="100" class="m">y = 2x + 1</text></svg>`,
  'komposanter':
    `<svg class="fig" viewBox="0 0 260 160"><line class="dash" x1="20" y1="130" x2="250" y2="130"/><line class="ac" x1="40" y1="130" x2="210" y2="32"/><polygon class="dot" points="210,32 196,34 202,45"/><line class="ln" x1="40" y1="130" x2="210" y2="130"/><line class="ln" x1="210" y1="130" x2="210" y2="32"/><path class="ac" d="M80 130 A40 40 0 0 0 75 110"/><text x="86" y="124" class="a">v</text><text x="105" y="70" class="a">F</text><text x="110" y="148" class="b">Fx = F·cos v</text><text x="214" y="86" class="b">Fy</text><text x="214" y="100" class="b">= F·sin v</text></svg>`,
  'tp-enkla':
    `<svg class="fig" viewBox="0 0 300 150"><rect class="fl" x="15" y="25" width="120" height="90"/><line class="dash" x1="75" y1="25" x2="75" y2="115"/><line class="dash" x1="15" y1="70" x2="135" y2="70"/><circle class="dot" cx="75" cy="70" r="5"/><text x="60" y="140" class="m">mitten</text><path class="fl" d="M165 115 L285 115 L225 20 Z"/><line class="dash" x1="165" y1="83.3" x2="285" y2="83.3"/><circle class="dot" cx="225" cy="83.3" r="5"/><line class="ln" x1="292" y1="115" x2="292" y2="83.3"/><text x="262" y="104" class="a">h/3</text><text x="195" y="140" class="m">1/3 från basen</text></svg>`,
  'tp-tprofil':
    `<svg class="fig" viewBox="0 0 280 230"><line class="ln" x1="20" y1="210" x2="270" y2="210"/><line class="dash" x1="145" y1="215" x2="145" y2="8"/><rect class="fl" x="60" y="20" width="170" height="38"/><rect class="fl" x="125" y="58" width="40" height="152"/><text x="70" y="44" class="b">A</text><text x="138" y="140" class="b">B</text><circle class="dot" cx="145" cy="91" r="5"/><line class="dash" x1="145" y1="91" x2="250" y2="91"/><text x="200" y="86" class="a">T: 172</text><text x="118" y="14" class="m">195</text><text x="238" y="44" class="m">45</text><text x="172" y="140" class="m">220</text><text x="132" y="226" class="m">45</text><text x="200" y="226" class="m">mått i mm</text></svg>`,
  'tp-lform':
    `<svg class="fig" viewBox="0 0 240 230"><line class="ln" x1="20" y1="205" x2="230" y2="205"/><line class="ln" x1="30" y1="215" x2="30" y2="10"/><rect class="fl" x="30" y="25" width="45" height="180"/><rect class="fl" x="75" y="160" width="90" height="45"/><circle class="dotb" cx="52.5" cy="115" r="4"/><circle class="dotb" cx="120" cy="182.5" r="4"/><circle class="dot" cx="75" cy="137.5" r="6"/><line class="dash" x1="75" y1="137.5" x2="75" y2="205"/><line class="dash" x1="30" y1="137.5" x2="75" y2="137.5"/><text x="82" y="134" class="a">T (50; 75)</text><text x="38" y="20" class="m">50</text><text x="170" y="186" class="m">50</text><text x="105" y="222" class="m">100</text><text x="2" y="115" class="m">200</text></svg>`,
  'jordtryck':
    `<svg class="fig" viewBox="0 0 260 200"><rect class="fl" x="100" y="20" width="26" height="160"/><line class="ln" x1="20" y1="180" x2="250" y2="180"/><path d="M126 20 L126 180 L220 180 Z" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2"/><line class="ac" x1="230" y1="126.7" x2="132" y2="126.7"/><polygon class="dot" points="128,126.7 138,121.7 138,131.7"/><line class="dash" x1="60" y1="126.7" x2="100" y2="126.7"/><line class="ln" x1="70" y1="180" x2="70" y2="126.7"/><text x="34" y="160" class="a">h/3</text><text x="150" y="110" class="a">resultant</text><text x="20" y="196" class="m">+10,5 m</text><text x="160" y="196" class="m">jordtryck ökar nedåt</text></svg>`,
};
