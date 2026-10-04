// Textos legales. ⚠️ Antes de abrir la app al público, rellena OWNER y revisa los textos
// (mejor con alguien que sepa de RGPD): esto es una base razonable, no asesoramiento legal.
export const TERMS_VERSION = '2026-10-04'

export const OWNER = {
  name: '[Nombre y apellidos o empresa responsable]',
  nif: '[NIF]',
  email: '[email de contacto]',
  city: '[Ciudad], España',
}

export const PRIVACY = [
  ['Quién es responsable', `${OWNER.name} (${OWNER.nif}), ${OWNER.city}. Contacto para cualquier tema de privacidad: ${OWNER.email}.`],
  ['Qué datos guardamos', 'Tu nombre, tu @usuario, tu año de nacimiento (para comprobar que eres mayor de 18), tu zona, si tu perfil es público o privado, tus amistades y grupos, el local que eliges cada noche y con qué visibilidad, los mensajes que escribes, las fotos de retos que subes y tus puntos. No pedimos email, teléfono ni ubicación GPS. De tu conexión solo guardamos una huella cifrada temporal para frenar el abuso (registros en masa).'],
  ['Para qué', 'Para que la app funcione: mostrar dónde sale la gente según la visibilidad que elijas, los chats, los grupos, los retos y los rankings; y para mantenerla segura (moderación de denuncias y prevención de abusos).'],
  ['Base legal', 'La ejecución del servicio que aceptas al registrarte (art. 6.1.b RGPD) y nuestro interés legítimo en mantener la app segura (art. 6.1.f).'],
  ['Revisión de fotos con IA', 'Cada foto de reto se envía a un servicio de inteligencia artificial (Anthropic, Claude) solo para comprobar que cumple el reto y que no tiene contenido prohibido. Ese servicio no usa las fotos para entrenar sus modelos.'],
  ['Quién más trata tus datos', 'Netlify (alojamiento y base de datos) y Anthropic (revisión de fotos). Pueden tratar datos fuera de la UE (EE. UU.) con las garantías del RGPD (cláusulas contractuales tipo / Data Privacy Framework). No vendemos tus datos ni los usamos para publicidad.'],
  ['Cuánto tiempo', 'Tu plan de cada noche, los chats de los locales y los puntos se borran a los 7 días. Las fotos de retos, a los 30 días. Tus datos de cuenta, hasta que borres la cuenta. Si borras la cuenta se elimina todo lo tuyo al momento.'],
  ['Tus derechos', `Puedes acceder, corregir, borrar, oponerte, limitar o llevarte tus datos. Borrar tu cuenta lo puedes hacer tú desde Perfil → Borrar mi cuenta; para lo demás, escribe a ${OWNER.email}. Si crees que no tratamos bien tus datos, puedes reclamar a la Agencia Española de Protección de Datos (aepd.es).`],
  ['Menores', 'La app es solo para mayores de 18 años. Si detectamos una cuenta de un menor, la borramos.'],
]

export const TERMS = [
  ['Edad', 'Tienes que tener 18 años o más. Al registrarte confirmas que es así.'],
  ['Tu cuenta', 'Eres responsable de lo que se hace desde tu cuenta. No compartas tu enlace de acceso. Una persona, una cuenta.'],
  ['Lo que publicas', 'Eres responsable de tus mensajes y fotos. Está prohibido: desnudos o contenido sexual, menores, drogas, violencia, acoso, insultos, discursos de odio, spam, y fotos de personas que no han dado su permiso. Las fotos con desconocidos solo valen si posan y están de acuerdo.'],
  ['Tu seguridad', 'Decidir salir en público es elección tuya; piensa bien quién puede verte. Nunca quedes a solas con desconocidos de la app sin precaución. Bebe con cabeza: ningún reto te obliga a beber.'],
  ['Moderación', 'Cualquiera puede denunciar contenido. Lo que acumula denuncias se oculta y lo revisamos. Podemos borrar contenido y expulsar cuentas que incumplan estas normas.'],
  ['Locales', 'La lista de locales es informativa y no implica ninguna relación con ellos. Los horarios, aforos y precios son cosa de cada local.'],
  ['Licencia de tus fotos', 'Mantienes los derechos de tus fotos. Nos das permiso para mostrarlas dentro de la app en los muros que elijas, mientras estén publicadas.'],
  ['Responsabilidad', 'La app se ofrece tal cual. No somos responsables de lo que pase en los locales ni de lo que publiquen otros usuarios, más allá de retirarlo cuando lo sepamos.'],
  ['Cambios', 'Si cambiamos estas condiciones te avisaremos en la app. Ley aplicable: la española.'],
]
