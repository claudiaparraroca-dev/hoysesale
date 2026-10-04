import { PRIVACY, TERMS, TERMS_VERSION } from '../lib/legal'
import { Sheet } from './ui'

export default function Legal({ page, onClose }) {
  const sections = page === 'privacy' ? PRIVACY : TERMS
  return (
    <Sheet title={page === 'privacy' ? 'Política de privacidad' : 'Condiciones de uso'} onClose={onClose}>
      <div className="legal">
        {sections.map(([title, text]) => (
          <section key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </section>
        ))}
        <p className="small">Versión {TERMS_VERSION}</p>
      </div>
    </Sheet>
  )
}
