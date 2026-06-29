# Gun Game Context

## Temel Bilgi

- Kod anahtari: `gungame`
- Oyuncu sayisi: 2-8
- Tip: herkes herkese silah ilerleme modu.

## Kurallar

- Yerde silah yoktur.
- Oyuncunun silahi kill sayisina gore otomatik belirlenir.
- Silah sirasi: `smg`, `rifle`, `shotgun`, `sniper`.
- Her oldurmede oyuncunun cani tam dolar.
- Son silah olan sniper/AWP ile kill alan oyuncu maci kazanir.

## Kaynaklar

- Mod tanimi: `server.js` icindeki `MODES.gungame`.
- Silah uretmeme kapsami: `server.js` icindeki `NO_WEAPON_MODES`.
- Silah sirasi: `server.js` ve `public/game.js` icindeki `GUN_GAME_ORDER`.
- Ekipman secimi: `public/game.js` icindeki `applyGunGameWeapon`.
