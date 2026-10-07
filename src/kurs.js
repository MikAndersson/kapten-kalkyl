/* ==========================================================================
   KURSINSTÄLLNINGAR
   Ändra här om sidan ska användas för en annan kurs. Inget här är knutet till
   en viss årskull, så samma sida kan användas år efter år.
   Lektionernas innehåll ligger i XML-filerna i mappen lessons/.
   ========================================================================== */
const KURS = {
  namn: 'Tillämpad matematik',

  // Mappen med lektionsfiler och innehållsförteckningen index.xml
  lektionsmapp: 'lessons/',

  // Skrivtid för klockan i övningstentan, i minuter
  skrivtidMinuter: 180,

  // Formelbladet (src/formelblad/formelblad.html). Under tentan visas hela bladet,
  // under minitentorna bara korten nedan. Kortens namn kommer från kommentaren
  // "KORT: <titel>" i formelbladet: små bokstäver, utan å/ä/ö, bindestreck i stället
  // för mellanslag och bara det som står före "·". "Tid ↔ decimaler" blir tid-decimaler.
  formelbladKort: {
    'tal-och-brak':       ['rakneordning', 'brak', 'teckenomvandling', 'potenser'],
    'enheter':            ['enheter', 'enhetsomvandling', 'tid-decimaler'],
    'procent':            ['procent'],
    'ekonomi':            ['ranta', 'procent'],
    'algebra':            ['algebraiska-uttryck', 'potenser', 'formelomvandling', 'teckenomvandling'],
    'linjara-funktioner': ['rata-linjen', 'koordinater-och-funktioner', 'losa-ekvationssystem'],
    'geometri':           ['geometri', 'skala', 'enheter', 'enhetsomvandling'],
    'trigonometri':       ['trigonometri-och-pythagoras', 'lutning'],
    'vektorer':           ['vektorer', 'trigonometri-och-pythagoras'],
    'statistik':          ['statistik'],
    'interpolation':      ['interpolation', 'rata-linjen'],
    'mekanik':            ['massa-och-densitet', 'tyngdkraft', 'tyngdtathet', 'ytlast-och-linjelast', 'geometri'],
    'tyngdpunkt':         ['tyngdpunkt'],
  },
};
