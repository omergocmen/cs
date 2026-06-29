# Genel Mod Altyapisi

Bu dosya modlar arasi ortak oyun davranisini tanimlar. Oyun modu detaylari kendi `context/<mod>.md` dosyalarinda tutulur.

## Gecerli Modlar

- `duel`
- `arena`
- `team`
- `gungame`
- `domination`
- `kilic`
- `kral`
- `awp`
- `futbol`

## Sunucu Davranisi

- Oda olustururken gecersiz mod gelirse sunucu varsayilan olarak `duel` kullanir.
- Maksimum oyuncu sayisi mod bazlidir: `duel` ve `awp` 2 oyuncu, diger modlar 8 oyuncu destekler.
- Takim tabanli modlar: `team`, `domination`, `futbol`.
- Round icinde olen oyuncunun bekledigi eleme modlari: `team`, `kilic`.
- Yerde silah uretmeyen modlar: `gungame`, `kilic`, `kral`, `awp`, `futbol`.
- Can paketi olmayan modlar: `awp`, `futbol`.
- Airdrop/buff kasasi su an sadece `arena` modunda calisir.

## Degisiklik Yaparken Bakilacak Yerler

- Sunucu mod listesi ve maksimum oyuncu sayisi: `server.js` icindeki `MODES`.
- Silah/can/takim/eleme davranislari: `server.js` icindeki `NO_WEAPON_MODES`, `NO_HEALTH_MODES`, `TEAM_MODES`, `ELIM_MODES`.
- Oda olusturma ve katilma davranisi: `server.js` icindeki `createRoom`, `joinRoom`, `joinPlayer`.
- Mod aciklamalari ve secim kartlari: `public/game.js` icindeki `MODE_INFO`, `public/index.html` icindeki `data-mode` kartlari.
- Modlara gore ekipman secimi: `public/game.js` icindeki `equipForMode`.
- Skor/HUD davranisi: `public/game.js` icindeki `updateScoreHUD` ve ilgili event handlerlar.
