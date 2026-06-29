# Kral Kim Context

## Temel Bilgi

- Kod anahtari: `kral`
- Oyuncu sayisi: 2-8
- Tip: bir krala karsi avci oyuncular modu.

## Kurallar

- Ilk kral rastgele secilir ve merkez/pit bolgesinde baslar.
- Kral 300 canlidir.
- Kral daha buyuk gorunur.
- Kral ozel `kingrifle` kullanir.
- Kral olmayan oyuncular birbirlerine hasar veremez.
- Normal oyuncular sadece krala hasar verebilir.
- Krali son vurusla olduren oyuncu sonraki roundun krali olur.
- Kralin silahi normal oyunculari tek isabette oldurecek sekilde ayarlanmistir.

## Kaynaklar

- Mod tanimi: `server.js` icindeki `MODES.kral`.
- Silah uretmeme kapsami: `server.js` icindeki `NO_WEAPON_MODES`.
- Kral secimi: `server.js` icindeki `ensureKing`.
- Kral round sonu: `server.js` icindeki `endKingRound`.
- Istemci ekipmani: `public/game.js` icindeki `equipForMode`.
