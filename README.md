# Kapten Kalkyl – TR26 Tillämpad matematik

En uppläst repetitionslektion med interaktiva bilder och minitentor, och en övningstenta som slumpas fram ur över 2 000 mallar. Rättningen förklarar vanliga fel och kontrollerar redovisningen.

- **Lektioner och tenta:** `index.html` (det här är sidan eleverna öppnar)
- **Editor för lektioner och tentafrågor:** `editor.html` (länkas inte från lektionssidan)
- **Innehåll:** `lessons/` (en XML-fil per lektion) och `mallar/` (tentamallar)
- **Källkod:** `src/`, `tools/`, `build.py`. Se `LÄSMIG.txt` för alla taggar och format.

---

## Lägg upp sidan på GitHub Pages (ca 10 minuter)

### 1. Skapa ett konto
Gå till [github.com](https://github.com) och välj **Sign up**. Användarnamnet syns i adressen, till exempel `https://anna-bygg.github.io/kapten-kalkyl/`.

### 2. Skapa ett nytt projekt (repository)
1. Klicka på **+** uppe till höger och välj **New repository**.
2. **Repository name:** `kapten-kalkyl`
3. Välj **Public** (GitHub Pages är gratis för öppna projekt).
4. Kryssa *inte* i "Add a README". Den finns redan här.
5. Klicka på **Create repository**.

### 3. Ladda upp filerna
1. På den tomma projektsidan klickar du på länken **uploading an existing file**.
2. Packa upp zip-filen på datorn och öppna mappen `kapten-kalkyl`.
3. Markera **allt som ligger i mappen** (filerna och mapparna `lessons`, `mallar`, `src`, `tools`) och dra in det i webbläsaren.
   - Dra *innehållet*, inte själva mappen. Annars hamnar sidan på `…/kapten-kalkyl/kapten-kalkyl/`.
   - Mapparna följer med när man drar dem i Chrome, Edge och Firefox.
4. Vänta tills alla filer listas och klicka på **Commit changes** längst ner.

### 4. Slå på GitHub Pages
1. Gå till **Settings** (kugghjulet i projektets meny) och sedan **Pages** i vänstermenyn.
2. Under **Build and deployment**, **Source**: välj **Deploy from a branch**.
3. Under **Branch**: välj **main** och mappen **/ (root)**. Klicka på **Save**.
4. Efter en till två minuter visas adressen överst på samma sida:
   `https://DITT-ANVÄNDARNAMN.github.io/kapten-kalkyl/`

Klart! Dela länken med klassen. Editorn finns på samma adress med `editor.html` på slutet.

---

## Ändra innehållet

**Ändra en lektion eller mall:** öppna filen på github.com (till exempel `lessons/03-procent.xml`), klicka på pennan (**Edit this file**), gör ändringen och klicka på **Commit changes**. Sidan uppdateras efter någon minut. Ladda om med Ctrl+F5 om du inte ser ändringen.

**Lägg till en lektion:**
1. Skriv lektionen i `editor.html` och tryck **Ladda ner**.
2. Gå in i mappen `lessons/` på github.com och välj **Add file → Upload files**.
3. Öppna `lessons/index.xml`, klicka på pennan och lägg till en rad: `<fil>min-lektion.xml</fil>`.

**Lägg till egna tentafrågor:**
1. Gör mallarna under fliken **Tentafrågor** i editorn och tryck **Ladda ner samlingen**.
2. Ladda upp `egna-mallar.xml` till mappen `mallar/`.
3. Lägg till `<fil>egna-mallar.xml</fil>` i `mallar/index.xml`.

**Ångra en ändring:** klicka på **History** (klockan) på filen, så ser du alla tidigare versioner.

**Ändringar i koden (`src/`):** de kräver ett nytt bygge. Kör `python3 build.py --github` i projektmappen på datorn. Då skrivs `index.html` och `editor.html` om, och de laddar du sedan upp. Ändringar i XML-filerna kräver *inte* detta.

---

## För läraren
Klicka på **Fork** uppe till höger så får du en egen kopia av hela projektet att anpassa till nästa kurs. Kursnamn och skrivtid ändras i `src/kurs.js` (kräver ett nytt bygge, se ovan).

Felrapporter och förslag tas gärna emot under **Issues**.
