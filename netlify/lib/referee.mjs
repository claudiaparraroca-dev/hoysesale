// Árbitro IA: ¿la foto cumple el reto y se puede publicar?
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod/v4'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

const Verdict = z.object({
  ok: z.boolean(),
  safe: z.boolean(),
  reason: z.string(),
})

const SYSTEM = `You are the referee of "hoysesale", a nightlife photo-challenge app for adults (18+) in Spain.
Players photograph themselves completing fun party challenges. Photos are shown to other players.

Decide two things:
1. "ok": does the photo plausibly complete the challenge? Night photos are dark, blurry and chaotic: be fair and generous. Reject photos of a screen showing an image, or clearly downloaded/stock images.
2. "safe": can it be shown to other players? Set safe=false (and ok=false) if the photo contains nudity or sexual content, anyone who looks like a minor, vomit, injuries, drugs, violence, or a person who is clearly being mocked, is passed out, or obviously did not agree to be photographed. People posing, smiling or looking at the camera are fine.

"reason": one short, cheeky, warm sentence in Spanish (max 15 words), addressed to the player (tú), party tone. If rejected, say what was missing.`

const client = new Anthropic()

export function parseImage(image) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(image || '')
  if (!m || m[2].length > 4_000_000) return null
  return { mediaType: m[1], data: m[2] }
}

export async function judge({ mediaType, data }, challenge) {
  // Solo para pruebas locales (netlify dev con REFEREE_MOCK=1)
  if (process.env.REFEREE_MOCK === '1' && process.env.NETLIFY_DEV === 'true') return { ok: true, safe: true, reason: 'Árbitro de pruebas: ¡vale!' }
  const response = await client.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 2000,
    output_config: { effort: 'low', format: zodOutputFormat(Verdict) },
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
        { type: 'text', text: `Challenge (shown to player): "${challenge.text}"\nReferee notes: ${challenge.hint || '-'}` },
      ],
    }],
  })
  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    return { ok: false, safe: false, reason: 'Esta foto no la puedo revisar. Prueba con otra.' }
  }
  const v = response.parsed_output
  return { ok: v.ok && v.safe, safe: v.safe, reason: v.reason }
}

export const isRateLimit = err => err instanceof Anthropic.RateLimitError
