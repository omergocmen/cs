# AWP 1v1 Context

## Temel Bilgi

- Kod anahtari: `awp`
- Oyuncu sayisi: 2
- Tip: sadece AWP ile uzun hat duellosu.

## Kurallar

- Oyuncular otomatik sniper/AWP ile baslar.
- Yerde silah yoktur.
- Can paketi yoktur.
- Harita yerlesimi AWP icin uzun ve genis hatlara gore ozel uygulanir.
- Olen oyuncu kisa sure sonra kendi tarafinda yeniden dogar.

## Kaynaklar

- Mod tanimi: `server.js` icindeki `MODES.awp`.
- AWP dogum noktalari: `server.js` icindeki `AWP_SPAWNS`.
- Silah/can uretmeme kapsami: `server.js` icindeki `NO_WEAPON_MODES`, `NO_HEALTH_MODES`.
- Istemci arena yerlesimi: `public/game.js` icindeki `applyArenaLayout`.
- Istemci ekipmani: `public/game.js` icindeki `equipForMode`.
