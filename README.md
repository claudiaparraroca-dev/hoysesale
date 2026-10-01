# hoysesale 🪩

¿Dónde se sale hoy? Eliges tu zona y ves en qué discotecas y bares va a estar la gente esta noche, quedas con tus grupos y lías la noche con retos de fotos.

En producción: **https://hoysesale.netlify.app**

## Qué hace

- **Zonas**: Platja d'Aro, Girona · Salt y Barcelona, con sus locales ([`src/lib/cities.js`](src/lib/cities.js); fuente: OpenStreetMap + listas de discotecas).
- **Esta noche**: cada local con su contador, tus amigos y la gente que sale en público. "La noche" va de 12:00 a 12:00, así que tu plan caduca solo.
- **Privacidad en tres niveles** cuando dices dónde vas: *público* (sale tu @, solo si tu perfil es público), *solo amigos* o *anónimo* (solo cuentas en el contador). Con perfil privado nunca sales en público.
- **Amigos** por @usuario (solicitud y aceptar).
- **Sala pública de cada local**: chat de la noche (solo escribe quien ha dicho que va), muro de fotos de retos y top del local.
- **Grupos privados** con código o enlace: chat, dónde va cada uno esta noche, fotos y top.
- **Retos de la noche**: 8 por zona y noche (generales + locales + el más votado por la gente). Cada foto la valida un árbitro IA (Claude) que además bloquea desnudos, menores, vómitos, drogas o gente que no ha dado permiso.
- **Propón retos**: la gente de cada zona propone y vota; el más votado (mín. 3 votos) entra la noche siguiente.
- **Denuncias**: fotos y mensajes desaparecen con 3 denuncias.
- Solo **+18** (fecha de nacimiento al registrarse). Sin email ni contraseña; la cuenta se puede pasar a otro móvil con un enlace privado.

## Stack

React + Vite + vite-plugin-pwa · Netlify Functions + Netlify Blobs · `@anthropic-ai/sdk` (Claude Opus 5.5). El chat funciona con *polling* cada 3 s; si crece, el siguiente paso es Socket.io en Render (como SkillSwap).

Las claves que se guardan en Blobs están documentadas en [`netlify/lib/game.mjs`](netlify/lib/game.mjs).

## Desarrollo local

```bash
npm install
REFEREE_MOCK=1 netlify dev --offline --port 8899   # backend + Blobs locales, árbitro de pruebas que acepta todo
```

Sin `REFEREE_MOCK` usa el árbitro de verdad (necesita `ANTHROPIC_API_KEY`). En Netlify la clave la pone el AI Gateway automáticamente.
