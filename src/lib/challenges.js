// Retos de la noche. Cada noche y ciudad salen 8: 5 generales + 2 de la ciudad + 1 propuesto
// por la gente (el más votado). Si no hay propuestas, sale otro general.
// `hint` lo lee el árbitro IA; `text` lo ve el jugador.
import { hash } from './night.js'

const c = (id, pts, emoji, text, hint) => ({ id, pts, emoji, text, hint })

export const GENERIC = [
  // Bebida (con cabeza: nada de "bébete X en Y minutos")
  c('g-3-cubatas', 15, '🥃', 'Foto con 3 cubatas en las manos', 'A person holding three drinks/glasses at once.'),
  c('g-brindis-6', 20, '🥂', 'Brindis con 6 vasos o más', 'At least six glasses/cups clinking together in a toast.'),
  c('g-chupitos', 15, '🧉', 'Una fila de chupitos', 'A row of shot glasses (at least 3).'),
  c('g-cubata-raro', 15, '🍹', 'La copa más rara de la noche', 'A cocktail or drink with an unusual look (garnish, color, umbrella, sparkler...). Be generous.'),
  c('g-agua', 10, '💧', 'Un vaso de agua (hidrátate, crack)', 'A glass or bottle of water.'),
  // Gente (siempre posando: que se vea que les parece bien)
  c('g-camarero', 25, '🧑‍🍳', 'Foto con el camarero o camarera', 'A selfie or photo together with a bartender/waiter who is visibly posing or smiling at the camera, behind or near a bar.'),
  c('g-dj', 30, '🎧', 'Foto con el DJ', 'A photo where a DJ (at decks/booth) appears with the player, posing or waving.'),
  c('g-desconocido', 20, '🤝', 'Foto con alguien que acabas de conocer (los dos con ✌️)', 'Two or more people posing together, at least two doing a peace/V sign. They must look aware and willing.'),
  c('g-cumple', 30, '🎂', 'Foto con alguien que cumple años hoy', 'People posing where some birthday element is visible (crown, cake, balloon, sign, sparkler) or someone clearly being celebrated. Be generous.'),
  c('g-conga', 25, '🚂', 'Una conga de 5 personas o más', 'At least five people in a line like a conga, hands on shoulders or similar.'),
  c('g-mismo-color', 20, '👯', '3 personas vestidas del mismo color', 'Three people posing together wearing the same dominant clothing color.'),
  c('g-portero', 30, '🚪', 'Foto con el portero (si se deja)', 'A photo with a doorman/bouncer who is visibly posing or OK with it, at an entrance.'),
  c('g-gafas', 15, '🕶️', 'Gafas de sol en plena noche', 'Someone wearing sunglasses in a night setting.'),
  c('g-piramide', 30, '🔺', 'Pirámide humana (con cuidado)', 'People forming a small human pyramid or stacked pose. Be lenient.'),
  // Ambiente
  c('g-pista', 10, '🪩', 'La pista a tope', 'A crowded dance floor or party crowd.'),
  c('g-bola', 15, '✨', 'Una bola de discoteca', 'A disco/mirror ball.'),
  c('g-neon', 10, '🟣', 'Un cartel de neón', 'A neon or illuminated sign.'),
  c('g-pulsera', 10, '🎟️', 'Tu entrada o pulsera de la noche', 'A ticket, wristband or entry stamp from a club/event.'),
  c('g-kebab', 20, '🌯', 'El kebab o pizza de después', 'Late-night food: kebab, pizza slice, burger, durum, fries...'),
  c('g-amanecer', 35, '🌅', 'Ver amanecer', 'Sunrise or dawn sky (early morning light).'),
  c('g-taxi', 10, '🚕', 'El taxi o bus de vuelta', 'A taxi, night bus or ride-share car (inside or outside).'),
  c('g-tacones', 15, '👠', 'Tacones en la mano', 'Someone holding their high heels/shoes in their hand.'),
  c('g-grupo-salto', 25, '🦘', 'Foto del grupo saltando', 'A group of at least 3 people jumping in the air in the photo.'),
  c('g-espejo', 10, '🪞', 'Selfie en el espejo del baño (el clásico)', 'A mirror selfie, typically in a bathroom.'),
]

export const LOCAL = {
  'platja-daro': [
    c('pda-passeig', 15, '🌴', 'Foto en el Passeig Marítim de noche', 'A seafront promenade at night (palm trees, sea, lights).'),
    c('pda-sorra', 20, '🏖️', 'Pies en la arena a las tantas', 'Feet in sand on a beach at night.'),
    c('pda-mar', 25, '🌊', 'Tocar el agua del mar de noche', 'Someone touching or standing in sea water at night.'),
    c('pda-cola', 10, '🧍', 'La cola para entrar', 'A queue of people waiting to enter a club.'),
    c('pda-pulsera-zz', 15, '🎫', 'Con la pulsera o sello de 2 discos distintas', 'Two different wristbands or entry stamps visible.'),
    c('pda-guiri', 20, '🇫🇷', 'Foto con un francés (que se vea que lo es)', 'People posing together where something clearly French is visible (flag, French t-shirt, French text...). Be lenient.'),
  ],
  girona: [
    c('gi-lleona', 30, '🦁', "Petó al cul de la Lleona", 'Someone kissing or posing next to the famous lioness statue on a column in Girona (Lleona de Girona).'),
    c('gi-onyar', 20, '🌉', "Les cases de l'Onyar de nit", "The colourful riverside houses of Girona (Cases de l'Onyar) or a bridge over the Onyar at night."),
    c('gi-catedral', 25, '⛪', 'Les escales de la Catedral', 'The big stone staircase of Girona Cathedral, or the cathedral itself.'),
    c('gi-mirona', 20, '🎤', 'A la porta de La Mirona', 'People at the entrance or facade of a concert hall (Sala La Mirona, Salt).'),
    c('gi-pont-ferro', 20, '🟥', 'Al Pont de les Peixateries Velles (el rojo de Eiffel)', 'The red iron bridge in Girona (Pont de les Peixateries Velles).'),
    c('gi-devesa', 15, '🌳', 'La Devesa de noche', 'Tall plane trees of a park (Parc de la Devesa) or any big park at night. Be lenient.'),
  ],
  barcelona: [
    c('bcn-peix', 25, '🐟', 'Con el Peix del Port Olímpic', 'The big golden fish sculpture at Port Olímpic (Frank Gehry) or Port Olímpic area.'),
    c('bcn-barceloneta', 20, '🏖️', 'La Barceloneta de noche', 'A Barcelona beach at night.'),
    c('bcn-metro', 15, '🚇', 'El metro de vuelta', 'Inside a metro carriage or station.'),
    c('bcn-guiri', 20, '🧳', 'Foto con un guiri con camiseta del Barça', 'People posing together with someone wearing an FC Barcelona shirt.'),
    c('bcn-cerveza-beer', 15, '🍺', 'Una lata comprada en la calle', 'A can of beer held in a street at night.'),
    c('bcn-sagrada', 30, '⛪', 'La Sagrada Família de noche', 'Sagrada Família basilica at night.'),
  ],
}

function pick(arr, n, rand) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand() % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0
    return s
  }
}

// proposals: retos propuestos por la gente ya convertidos a reto { id, pts, emoji, text, hint }
export function challengesFor(city, night, topProposal = null) {
  const rand = rng(hash(`hoysesale:${city}:${night}`))
  const local = pick(LOCAL[city] || [], 2, rand)
  const generic = pick(GENERIC, topProposal ? 5 : 6, rand)
  return [...(topProposal ? [topProposal] : []), ...local, ...generic]
}
