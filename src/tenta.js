/* Hjälpfunktion för lösningar: C('rad 1', 'rad 2', …). Sista raden visas grön. */
const C = (...rows) => `<div class="calc calc-plain">${rows.map((r, i) => i === rows.length - 1 ? `<span class="ans">${r}</span>` : r).join('\n')}</div>`;

/* --------------------------------------------------------------------------
   ÖVNINGSTENTANS UPPGIFTER
     part   1 = Del 1 (G-nivå), 2 = Del 2 (VG-nivå)
     n      uppgiftsnummer
     p      poäng
     ch     lektions-id för "Repetera i lektionen" (id="…" i lektionens XML-fil)
     q      uppgiftstext (HTML tillåten, t.ex. <br>)
     f      svarsrutor: { l: etikett, u: enhet, a: rätt svar, tol: tolerans }
            eller flervalsruta: { l: etikett, sel: ['A','B'], a: 'A' }
            Poängen delas lika mellan svarsrutorna i en uppgift.
     s      lösning som visas efter rättning (använd C() för uträkningar)
   Poängsumman per del räknas ut automatiskt.
   -------------------------------------------------------------------------- */
const EXAM=[
{part:1,n:1,p:1,ch:'geometri',q:'En betongplatta är 7,6 m lång och 4,5 m bred. Beräkna arean.',
 f:[{l:'Area',u:'m²',a:34.2,tol:0.06}],s:C('A = l · b = 7,6 · 4,5','A = 34,2 m²')},
{part:1,n:2,p:2,ch:'geometri',q:'En grundplatta är 8,0 m × 5,5 m × 0,25 m. Beräkna volymen i m³.',
 f:[{l:'Volym',u:'m³',a:11}],s:C('V = l · b · h = 8,0 · 5,5 · 0,25','V = 11,0 m³')},
{part:1,n:3,p:2,ch:'enheter',q:'En regel har tvärsnittet 45 × 120 mm och är 4,2 m lång. Beräkna volymen i m³.',
 f:[{l:'Volym',u:'m³',a:0.02268,tol:0.0005}],s:C('45 mm = 0,045 m, 120 mm = 0,120 m','V = 0,045 · 0,120 · 4,2','V = 0,022 68 m³ ≈ 0,0227 m³')},
{part:1,n:4,p:1,ch:'mekanik',q:'En tegelvägg har volymen 3,2 m³ och tyngdtätheten 20 kN/m³. Beräkna väggens tyngd.',
 f:[{l:'Tyngd',u:'kN',a:64}],s:C('G = γ · V = 20 · 3,2','G = 64 kN')},
{part:1,n:5,p:1,ch:'enheter',q:'En stålbalk har massan 640 kg. Beräkna tyngdkraften i kN. Använd g ≈ 10 m/s².',
 f:[{l:'Tyngd',u:'kN',a:6.4}],s:C('G = m · g = 640 · 10 = 6 400 N','G = 6,4 kN')},
{part:1,n:6,p:1,ch:'procent',q:'En maskin kostar 32 000 kr. Priset sänks med 15 %. Beräkna det nya priset.',
 f:[{l:'Nytt pris',u:'kr',a:27200,tol:1}],s:C('Förändringsfaktor: 1 − 0,15 = 0,85','32 000 · 0,85 = 27 200 kr')},
{part:1,n:7,p:2,ch:'procent',q:'En byggställning köptes för 42 000 kr och säljs senare för 31 500 kr. Beräkna värdeminskningen i procent.',
 f:[{l:'Värdeminskning',u:'%',a:25}],s:C('(31 500 − 42 000) / 42 000','= −10 500 / 42 000 = −0,25','Värdeminskning: 25 %')},
{part:1,n:8,p:2,ch:'interpolation',q:'Ett formfaktorvärde är 0,62 vid 10 m höjd och 0,86 vid 20 m höjd. Bestäm värdet vid 14 m med linjär interpolation.',
 f:[{l:'Värde vid 14 m',u:'',a:0.716,tol:0.006}],s:C('y = y₁ + (x − x₁) / (x₂ − x₁) · (y₂ − y₁)','y = 0,62 + (14 − 10) / (20 − 10) · (0,86 − 0,62)','y = 0,62 + 0,4 · 0,24','y = 0,716 ≈ 0,72')},
{part:1,n:9,p:2,ch:'statistik',q:'Ett kontor består av 900 m² som använder 22 kWh/m² och 600 m² som använder 42 kWh/m². Beräkna den viktade medelförbrukningen.',
 f:[{l:'Medelförbrukning',u:'kWh/m²',a:30}],s:C('E_tot = 900 · 22 + 600 · 42','E_tot = 19 800 + 25 200 = 45 000 kWh','A_tot = 1 500 m²','E_medel = 45 000 / 1 500 = 30 kWh/m²')},
{part:1,n:10,p:1,ch:'enheter',q:'Ett bygge behöver transportera 15,4 ton material. En lastbil tar 1,8 ton per körning. Hur många hela körningar krävs?',
 f:[{l:'Körningar',u:'st',a:9,tol:0}],s:C('15,4 / 1,8 = 8,56','Avrunda uppåt: 9 körningar')},
{part:1,n:11,p:1,ch:'trigonometri',q:'En stege är 5,0 m lång och dess fot står 1,4 m från väggen. Hur högt upp på väggen når stegen?',
 f:[{l:'Höjd',u:'m',a:4.8}],s:C('h = √(5,0² − 1,4²)','h = √(25 − 1,96) = √23,04','h = 4,8 m')},

{part:2,n:12,p:3,ch:'mekanik',q:'En betongplatta är 7,0 m × 5,0 m × 0,20 m. Betongen har tyngdtätheten 25 kN/m³. Beställningsvolymen ska innehålla 5 % spill. Beräkna beställningsvolymen och plattans totala tyngd (med spill).',
 f:[{l:'Beställningsvolym',u:'m³',a:7.35},{l:'Total tyngd',u:'kN',a:183.75,tol:0.8}],s:C('V = 7,0 · 5,0 · 0,20 = 7,0 m³','V_best = 7,0 · 1,05 = 7,35 m³','G = γ · V = 25 · 7,35','G = 183,75 kN ≈ 184 kN')},
{part:2,n:13,p:2,ch:'procent',q:'Ett byggprojekt kostar 3,2 miljoner kr. Kostnaden ökar 6 % första året och 4 % andra året. Beräkna kostnaden efter två år och den totala procentuella ökningen.',
 f:[{l:'Kostnad',u:'milj kr',a:3.52768,tol:0.006},{l:'Total ökning',u:'%',a:10.24,tol:0.06}],s:C('3,2 · 1,06 · 1,04 = 3,527 68 milj kr ≈ 3,53 milj kr','Faktor: 1,06 · 1,04 = 1,1024','Total ökning: 10,24 % (inte 10 %)')},
{part:2,n:14,p:3,ch:'statistik',q:'Två arbetslag har följande tider i dagar.<br>Lag A: 12, 11, 12, 13, 12<br>Lag B: 9, 15, 10, 16, 10<br>Beräkna medelvärdet och variationsbredden för båda lagen. Vilket lag är mest stabilt?',
 f:[{l:'Medel A',u:'dagar',a:12},{l:'Medel B',u:'dagar',a:12},{l:'Bredd A',u:'dagar',a:2,tol:0},{l:'Bredd B',u:'dagar',a:7,tol:0},{l:'Mest stabilt',sel:['Lag A','Lag B','Lika'],a:'Lag A'}],
 s:C('Medel A = (12+11+12+13+12) / 5 = 60 / 5 = 12 dagar','Medel B = (9+15+10+16+10) / 5 = 60 / 5 = 12 dagar','Bredd A = 13 − 11 = 2 dagar','Bredd B = 16 − 9 = 7 dagar','Samma medel, men A har mycket mindre spridning ⇒ Lag A mest stabilt')},
{part:2,n:15,p:4,ch:'trigonometri',q:'En takprofil bildar en rätvinklig triangel. Den horisontella längden är 7,5 m och höjdskillnaden är 3,2 m. Beräkna takvinkeln mot horisontalplanet och taksidans längd.',
 f:[{l:'Takvinkel',u:'°',a:23.1,tol:0.15},{l:'Taksidans längd',u:'m',a:8.154,tol:0.02}],s:C('tan v = 3,2 / 7,5 = 0,4267','v = tan⁻¹(0,4267) ≈ 23,1°','L = √(7,5² + 3,2²) = √66,49','L ≈ 8,15 m','(Kontroll: 7,5 / cos 23,1° ≈ 8,15 m ✓)')},
{part:2,n:16,p:2,ch:'procent',q:'En byggställning minskar i värde från 20 000 kr till 14 580 kr på 3 år. Beräkna den genomsnittliga procentuella värdeminskningen per år.',
 f:[{l:'Minskning per år',u:'%',a:10,tol:0.1}],s:C('x³ = 14 580 / 20 000 = 0,729','x = 0,729^(1/3) = 0,90','0,90 − 1 = −0,10','Värdeminskning: 10 % per år')},
];

/* --------------------------------------------------------------------------
   EXTRAUPPGIFTER – utan poäng, rättas en och en. Samma format som ovan.
   -------------------------------------------------------------------------- */
const EXTRA=[
{n:'E1',ch:'linjara-funktioner',q:'Firma A tar 150 kr + 32 kr/h. Firma B tar 390 kr + 20 kr/h. Efter hur många timmar kostar de lika mycket?',
 f:[{l:'Brytpunkt',u:'h',a:20}],s:C('150 + 32x = 390 + 20x','12x = 240','x = 20 h. Före 20 h är A billigast, efter är B billigast.')},
{n:'E2',ch:'linjara-funktioner',q:'En transport på 5 km kostar 1 450 kr och en på 12 km kostar 2 780 kr (linjär modell). Bestäm k, m och hur långt du kommer för 4 300 kr.',
 f:[{l:'k',u:'kr/km',a:190},{l:'m',u:'kr',a:500},{l:'Sträcka',u:'km',a:20}],s:C('k = (2 780 − 1 450) / (12 − 5) = 190 kr/km','m = 1 450 − 190 · 5 = 500 kr','4 300 = 190x + 500 ⇒ x = 20 km')},
{n:'E3',ch:'tyngdpunkt',q:'En 8 m lång balk väger 400 kg. Ett paket på 200 kg ligger 2 m från vänster ände. Bestäm gemensam tyngdpunkt från vänster ände.',
 f:[{l:'x_T',u:'m',a:3.333,tol:0.02}],s:C('x_T = (400 · 4 + 200 · 2) / 600','x_T = 2 000 / 600 ≈ 3,33 m')},
{n:'E4',ch:'vektorer',q:'Två krafter verkar på en punkt: F₁ = (300, 40) N och F₂ = (180, −100) N. Beräkna resultantens storlek och vinkel mot positiva x-axeln.',
 f:[{l:'|R|',u:'N',a:483.7,tol:1},{l:'Vinkel θ',u:'°',a:352.9,tol:0.15}],s:C('R = (480, −60) N','|R| = √(480² + 60²) ≈ 483,7 N','θ = tan⁻¹(−60 / 480) ≈ −7,1°','Rₓ > 0 och R_y < 0 ⇒ θ = −7,1° + 360° = 352,9° (moturs från positiva x-axeln, som på formelbladet)')},
{n:'E5',ch:'algebra',q:'Lös ut r ur V = π · r² · h. Beräkna sedan r för en cylinder med V = 2,0 m³ och h = 1,5 m.',
 f:[{l:'r',u:'m',a:0.6515,tol:0.006}],s:C('r² = V / (π h)  ⇒  r = √(V / (π h))','r = √(2,0 / (π · 1,5)) = √0,4244','r ≈ 0,65 m')},
{n:'E6',ch:'tyngdpunkt',q:'En T-profil har en fläns 150 × 30 mm ovanpå ett liv 30 × 120 mm. Livet står på x-axeln och profilen är symmetrisk kring y-axeln. Beräkna tyngdpunktens höjd y.',
 f:[{l:'y_T',u:'mm',a:101.67,tol:0.5}],s:C('Fläns: A = 4 500 mm², y = 120 + 15 = 135 mm','Liv: A = 3 600 mm², y = 60 mm','y_T = (4 500 · 135 + 3 600 · 60) / 8 100','y_T ≈ 101,7 mm')},
{n:'E7',ch:'statistik',q:'Kostnader i tkr för sju leveranser: 42, 47, 45, 39, 90, 41, 43. Bestäm medelvärde och median. Vilket mått beskriver en typisk leverans bäst?',
 f:[{l:'Medelvärde',u:'tkr',a:49.571,tol:0.05},{l:'Median',u:'tkr',a:43,tol:0},{l:'Bäst mått',sel:['Medelvärde','Median'],a:'Median'}],s:C('Summa = 347, medel = 347 / 7 ≈ 49,6 tkr','Sorterat: 39, 41, 42, 43, 45, 47, 90 → median = 43 tkr','90 tkr är ett extremvärde som drar upp medelvärdet, så medianen är bäst')},
{n:'E8',ch:'ekonomi',q:'En maskin köps för 60 000 kr och skrivs av med 15 % per år. Vad är den värd efter 3 år?',
 f:[{l:'Värde',u:'kr',a:36847.5,tol:5}],s:C('V = 60 000 · 0,85³','V ≈ 36 848 kr')},
{n:'E9',ch:'tal-och-brak',q:'Beräkna 3/4 − 2/5 och svara i decimalform.',
 f:[{l:'Svar',u:'',a:0.35,tol:0.001}],s:C('Gemensam nämnare 20: 15/20 − 8/20 = 7/20','7/20 = 0,35')},
];

/* --------------------------------------------------------------------------
   KAPTEN KALKYLS REPLIKER I TENTAVYN
   -------------------------------------------------------------------------- */
const EXAM_TEXTS = {
  intro: 'Välkommen till övningstentan! Den är byggd som sluttentan: del 1 på G-nivå och del 2 på VG-nivå, 30 poäng totalt. Starta klockan, räkna på papper med miniräknare och formelblad, och redovisa precis som på riktigt. Skriv sedan in dina slutsvar i rutorna. När du trycker på Rätta tentan ser du poängen, vilka svar som stämmer och hela lösningen till varje uppgift. Längst ner finns extrauppgifter om linjära modeller, vektorer och tyngdpunkt. Lycka till!',
  fullScore: max => `Fantastiskt, full pott! Alla ${max} poäng. Nu gäller det bara att redovisa lika snyggt på tentan: formel, insättning, mellanled och svar med enhet. Du är redo!`,
  result: ({ total, max, part1, part2, empty, repeat, wrongNos, wrongCount }) =>
    `Du fick ${total} av ${max} poäng: ${part1} på del 1 och ${part2} på del 2. ` +
    (empty ? `Du lämnade ${empty} svarsrutor tomma. ` : '') +
    (wrongCount ? `${wrongCount === 1 ? 'Uppgift' : 'Uppgift'} ${wrongNos} blev fel. ${wrongCount === 1 ? 'Den hör' : 'De hör'} till ${repeat}. ` +
      'Jag har satt ihop en repetitionslista med bara de avsnitten. Tryck på Repetera bara de här avsnitten, så går vi igenom dem, och sedan gör du tentan igen. ' : '') +
    'Varje fel nu är en poäng du inte tappar på tentan!',
};

// Engelska versioner av replikerna, används om datorn saknar svensk röst.
const EXAM_TEXTS_EN = {
  intro: 'Welcome to the practice exam! It is built like the final exam: part 1 at pass level and part 2 at distinction level, 30 points in total. Start the clock, work on paper with your calculator and formula sheet, and show your working just like on the real exam. Then type your final answers into the boxes. When you press the button to mark the exam, you will see your points, which answers are correct and the full solution to every task. At the bottom there are extra tasks on linear models, vectors and centre of gravity. Good luck!',
  fullScore: max => `Fantastic, full marks! All ${max} points. Now you just need to show your working just as neatly on the exam: formula, substitution, intermediate steps and an answer with a unit. You are ready!`,
  result: ({ total, max, part1, part2, empty, repeat, wrongNos, wrongCount }) =>
    `You got ${total} out of ${max} points: ${part1} on part 1 and ${part2} on part 2. ` +
    (empty ? `You left ${empty} answer boxes empty. ` : '') +
    (wrongCount ? `Task ${wrongNos} ${wrongCount === 1 ? 'was' : 'were'} wrong, which belongs to ${repeat}. I have put together a review list with just those sections. Press the review button, go through them, and then take the exam again. ` : '') +
    'Every mistake now is a point you will not lose on the exam. Try the tasks again without the solutions in a while!',
};
