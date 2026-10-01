// Ciudades y locales. Fuente: OpenStreetMap + listas de discotecas conocidas (oct 2026).
// type: 'club' (discoteca / sala), 'pub' (pub / bar de copas), 'bar' (bar / beach bar / previa)
const v = (id, name, type, area) => ({ id, name, type, area })

export const CITIES = {
  'platja-daro': {
    name: "Platja d'Aro",
    emoji: '🏖️',
    venues: [
      v('zsa-zsa', 'Zsa Zsa', 'club'),
      v('be-out', 'Be Out', 'club'),
      v('paladium', 'Paladium', 'club', 'Sala Up · Down · Privat'),
      v('assac', 'Assac Disco', 'club'),
      v('blow-pda', 'Blow', 'club', 'Cavall Bernat'),
      v('casa-club', 'Casa Club', 'club'),
      v('black-white', 'Black & White', 'club'),
      v('farandula', 'Farándula', 'pub'),
      v('moana', 'Moana', 'pub'),
      v('cactus', 'Cactus', 'pub'),
      v('baobab', 'Baobab Lounge Bar', 'pub'),
      v('trocadero', 'Beach Club Trocadero', 'bar'),
      v('bobar', 'Bobar Beach', 'bar'),
      v('el-golfo', 'El Golfo', 'bar'),
    ],
  },
  girona: {
    name: 'Girona · Salt',
    emoji: '🦁',
    venues: [
      v('la-mirona', 'Sala La Mirona', 'club', 'Salt'),
      v('gatzara', 'Gatzara', 'club'),
      v('blow-girona', 'Blow', 'club', 'Miquel Blay'),
      v('univers', 'Sala Univers', 'club'),
      v('pati-rabi', 'El Pati del Rabí', 'club', 'Barri Vell'),
      v('sunset-jazz', 'Sunset Jazzclub', 'club'),
      v('bali', 'Bali', 'pub'),
      v('codigo', 'Código', 'pub'),
      v('croaks', "Croak's", 'pub'),
      v('nykteris', "Nykteri's", 'pub', 'Cocktelería'),
      v('mckiernans', "McKiernan's", 'pub', 'Irish pub'),
      v('els-quimics', 'Els Químics', 'pub'),
      v('chuggles', "Chuggle's Craft Beer", 'bar'),
      v('cerveceria-barri-vell', 'La Cervecería del Barri Vell', 'bar'),
      v('dubai-shisha', 'Dubai Shisha Lounge', 'bar'),
    ],
  },
  barcelona: {
    name: 'Barcelona',
    emoji: '🌃',
    venues: [
      v('opium', 'Opium', 'club', 'Port Olímpic'),
      v('shoko', 'Shôko', 'club', 'Port Olímpic'),
      v('pacha-bcn', 'Pacha', 'club', 'Port Olímpic'),
      v('bling-bling', 'Bling Bling', 'club', 'Sant Gervasi'),
      v('razzmatazz', 'Razzmatazz', 'club', 'Poblenou'),
      v('apolo', 'Sala Apolo', 'club', 'Paral·lel'),
      v('otto-zutz', 'Otto Zutz', 'club', 'Gràcia'),
      v('sutton', 'Sutton', 'club', 'Sant Gervasi'),
      v('downtown', 'Downtown', 'club'),
      v('bikini', 'Sala Bikini', 'club', 'Les Corts'),
      v('jamboree', 'Jamboree', 'club', 'Plaça Reial'),
      v('luz-de-gas', 'Luz de Gas', 'club'),
      v('safari', 'Safari Disco Club', 'club'),
      v('macarena', 'Macarena Club', 'club', 'Gòtic'),
      v('antilla', 'Antilla Latin Club', 'club'),
      v('believe', 'Believe Club', 'club'),
      v('arena', 'Arena', 'club', 'LGTBI+'),
      v('la-paloma', 'La Paloma', 'club'),
      v('costa-breve', 'Costa Breve', 'club'),
      v('boulevard', 'Boulevard Culture Club', 'club', 'Rambla'),
      v('plataforma', 'Plataforma', 'club'),
      v('les-enfants', 'Les Enfants Brillants', 'club'),
      v('r33', 'R33', 'club'),
      v('wolf', 'Wolf', 'club'),
      v('harlem', 'Harlem Jazz Club', 'pub'),
      v('black-box', 'Black Box', 'club'),
    ],
  },
}

export const TYPE_LABEL = { club: 'Disco', pub: 'Pub', bar: 'Bar' }
export const TYPE_EMOJI = { club: '🪩', pub: '🍸', bar: '🍻' }

// Opción especial: quedarse en casa también cuenta
export const HOME = { id: 'casa', name: 'Hoy no salgo', type: 'home', area: 'Sofá y manta' }

export function venueById(city, id) {
  if (id === HOME.id) return HOME
  return CITIES[city]?.venues.find(x => x.id === id) || null
}
