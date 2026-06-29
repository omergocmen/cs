# Takim Context

## Temel Bilgi

- Kod anahtari: `team`
- Oyuncu sayisi: 2-8
- Tip: Polis vs Haydut round eleme modu.

## Kurallar

- Oyuncular `police` veya `bandit` takiminda oynar.
- Dost atesi kapali tutulur.
- Round icinde olen oyuncu yeniden dogmaz, round bitene kadar bekler.
- Rakip takimin tum hayatta kalanlari elenirse round kazanilir.
- Skor, takimlarin kazandigi round sayisidir.
- Takim modunda isim etiketi yalnizca kendi takimindaki oyuncular icin gorunur.

## Kaynaklar

- Mod tanimi: `server.js` icindeki `MODES.team`.
- Takim kapsami: `server.js` icindeki `TEAM_MODES`.
- Eleme kapsami: `server.js` icindeki `ELIM_MODES`.
- Round sonu kontrolu: `server.js` icindeki `checkRoundEnd`.
- Isim etiketi gorunurlugu: `public/game.js` icindeki `nameTagVisibleFor`.
