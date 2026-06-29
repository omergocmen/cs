# Futbol Context

## Temel Bilgi

- Kod anahtari: `futbol`
- Oyuncu sayisi: 2-8
- Tip: takim tabanli top surme ve gol modu.

## Kurallar

- Takimlar `police` ve `bandit`.
- Oyuncular takim dogum noktalarindan baslar.
- Silah yoktur.
- Yerde silah yoktur.
- Can paketi yoktur.
- Silah gorseli istemcide gizlenir.
- Top fizigi sunucu otoritelidir.
- Istemci top surerken gecikmeyi azaltmak icin tahmin uygular.
- Topa yaklasan oyuncu topu bakis yonune gore surer.
- `SPACE` topa sert sut cekmek icin kullanilir.
- `Q` rakibin top kontrolunu bozmak icin kullanilir.
- Ilk 5 gole ulasan takim maci kazanir.

## Kaynaklar

- Mod tanimi: `server.js` icindeki `MODES.futbol`.
- Takim kapsami: `server.js` icindeki `TEAM_MODES`.
- Silah/can uretmeme kapsami: `server.js` icindeki `NO_WEAPON_MODES`, `NO_HEALTH_MODES`.
- Futbol sabitleri ve top fizigi: `server.js` icindeki futbol bolumleri.
- Istemci top gorseli ve tahmin: `public/game.js` icindeki futbol bolumleri.
