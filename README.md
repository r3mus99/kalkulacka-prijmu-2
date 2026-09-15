# Kalkulačka čistej mzdy 2026

Jednoduchá webová kalkulačka na orientačný výpočet čistej mzdy zamestnanca na Slovensku v roku 2026.

**Online verzia:** [r3mus99.github.io/kalkulacka-prijmu-2](https://r3mus99.github.io/kalkulacka-prijmu-2/)

## Funkcie

- výpočet čistej mzdy z hrubej mzdy,
- spätný výpočet hrubej mzdy z požadovanej čistej mzdy,
- zdravotné a sociálne odvody,
- nezdaniteľná časť základu dane,
- daňový bonus na deti podľa veku,
- animovaný graf a detailný rozpis výpočtu,
- priebežný zárobok za dnešok, mesiac a rok,
- responzívne rozhranie a podpora obmedzenia animácií,
- automatické nasadenie cez GitHub Pages.

## Lokálne spustenie

Projekt nemá externé závislosti ani build krok. Stačí otvoriť `index.html` v prehliadači alebo spustiť ľubovoľný lokálny statický server.

## Testy

Testy vyžadujú Node.js:

```bash
node app.test.js
```

Výpočtová logika je oddelená od používateľského rozhrania:

- `salary-calculator.js` – mzda, odvody, daň a bonusy,
- `earnings-progress.js` – priebežný zárobok podľa dátumu a pracovného času,
- `formatters.js` – spracovanie a formátovanie hodnôt,
- `app.js` – DOM a používateľské interakcie.

## Upozornenie

Výsledky sú orientačné a nenahrádzajú profesionálne mzdové, účtovné ani daňové poradenstvo.
