# Bolge Kapma Context

## Temel Bilgi

- Kod anahtari: `domination`
- Oyuncu sayisi: 2-8
- Tip: takim tabanli bolge kontrol modu.

## Kurallar

- Takimlar `police` ve `bandit`.
- Dost atesi kapali tutulur.
- Haritada 3 bolge vardir: Alfa, Bravo, Charlie.
- Bir bolgede yalniz tek takimin oyunculari varsa bolge o takima dogru ele gecirilir.
- Iki takim ayni bolgedeyse kapma ilerlemez.
- Tutulan bolgeler her saniye takima puan kazandirir.
- Hedef skor `150`; bu skora ilk ulasan takim maci kazanir.

## Kaynaklar

- Mod tanimi: `server.js` icindeki `MODES.domination`.
- Takim kapsami: `server.js` icindeki `TEAM_MODES`.
- Bolge sabitleri: `server.js` icindeki `DOM_ZONES`, `DOM_TARGET`.
- Istemci bolge gorselleri: `public/game.js` icindeki domination bolumleri.
