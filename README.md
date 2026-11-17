# ZWB Intensiv-Trainer

Lernplattform zur Vorbereitung auf die Prüfung zur **Zusatzbezeichnung Intensivmedizin**. Gegliedert nach WBO-Katalog: Lektionen, Fälle, Karteikarten mit Spaced Repetition (FSRS), Spickzettel, Radiologie-Atlas, Mock-Prüfung, Volltextsuche.

- **Start:** `index.html` im Browser öffnen. Funktioniert offline, der Lernstand wird lokal im Browser gespeichert.
- **Prüfen:** `node tools/check.mjs` (Syntax, IDs, Quellenmarker, Rendering aller Ansichten).
- **Für Agenten:** siehe [`AGENTS.md`](AGENTS.md).
- **Änderungen:** [`CHANGELOG.md`](CHANGELOG.md).

Nicht kommerziell. Eingebettete Bilder: Radiopaedia.org (CC BY-NC-SA 3.0) und LITFL ECG Library (CC BY-NC-SA 4.0), Urheber jeweils am Bild genannt.

## Lizenz

- **Code** (HTML-Gerüst, CSS, JavaScript, `tools/`): Apache License 2.0, siehe [`LICENSE`](LICENSE).
- **Ausgenommen sind die eingebetteten Fremdbilder.** Sie stehen **nicht** unter Apache 2.0, sondern unter ihren eigenen Lizenzen und dürfen nur nicht kommerziell genutzt werden:
  - Radiologie-Bilder (`RPIMG`): Radiopaedia.org, CC BY-NC-SA 3.0, verkleinert; Urheber und rID-DOI jeweils am Bild.
  - EKG-Bilder (`EKGIMG`): LITFL ECG Library (Burns E, Buttner R), CC BY-NC-SA 4.0.
- Die Lerninhalte dienen der Prüfungsvorbereitung und ersetzen keine Leitlinie und keine ärztliche Entscheidung im Einzelfall.
