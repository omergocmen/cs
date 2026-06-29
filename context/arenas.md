# Harita ve Arena Context

Bu dosya modlardan bagimsiz arena secimi ve mod-arena eslesmelerini tanimlar.

## Gecerli Arena Anahtarlari

- `depot`
- `lanes`
- `fortress`
- `yard`
- `crossfire`
- `futbol`

## Mod Eslesmeleri

- `futbol` modu secildiginde istemci arena secimini otomatik `futbol` sahasina alir.
- `awp`, `kral` ve `futbol` modlari istemcide kendi ozel arena yerlesimlerini zorlar.
- Normal modlarda secilen arena temasina ve engel dizilimine gore oyun alani kurulur.

## Kaynaklar

- Arena anahtarlari: `server.js` icindeki `ARENAS`.
- Arena secim kartlari: `public/index.html` icindeki `data-arena` elemanlari.
- Arena tema ve yerlesimleri: `public/game.js` icindeki `ARENA_THEMES` ve `applyArenaLayout`.
