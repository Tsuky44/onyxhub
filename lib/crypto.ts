import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dataDir } from './paths'

/**
 * Chiffrement des secrets en base et du cookie de session : AES-256-GCM,
 * qui authentifie en plus de chiffrer (un cookie modifié est rejeté, pas
 * déchiffré de travers).
 *
 * La clé vient de `ONYXHUB_SECRET` si elle est définie, sinon d'un fichier
 * `data/secret.key` créé au premier démarrage. Changer de clé déconnecte tout
 * le monde et rend illisibles les secrets enregistrés : il faut alors les
 * ressaisir dans Réglages.
 */
const VERSION = 'v1'
const IV_BYTES = 12
const TAG_BYTES = 16

let cachedKey: Buffer | null = null

function loadKey(): Buffer {
  if (cachedKey) return cachedKey
  const fromEnv = process.env.ONYXHUB_SECRET?.trim()
  if (fromEnv) {
    if (fromEnv.length < 32) throw new Error('ONYXHUB_SECRET doit faire au moins 32 caractères')
    cachedKey = createHash('sha256').update(fromEnv).digest()
    return cachedKey
  }
  const file = join(dataDir(), 'secret.key')
  if (!existsSync(file)) {
    // `wx` : si deux process démarrent en même temps, le second échoue au lieu
    // d'écraser la clé du premier, et relit celle qui vient d'être écrite.
    try {
      writeFileSync(file, randomBytes(32).toString('base64'), { mode: 0o600, flag: 'wx' })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new Error('crypto: écriture de secret.key', { cause: error })
    }
  }
  const key = Buffer.from(readFileSync(file, 'utf8').trim(), 'base64')
  if (key.length !== 32) throw new Error('crypto: data/secret.key est corrompu (32 octets attendus)')
  cachedKey = key
  return key
}

/** Chiffre une chaîne. Le résultat est sûr dans un cookie ou une colonne texte. */
export function seal(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', loadKey(), iv)
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `${VERSION}.${Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url')}`
}

/** Déchiffre ce que `seal` a produit. `null` si la valeur a été modifiée ou vient d'une autre clé. */
export function unseal(sealed: string): string | null {
  const [version, payload] = sealed.split('.', 2)
  if (version !== VERSION || !payload) return null
  const raw = Buffer.from(payload, 'base64url')
  if (raw.length < IV_BYTES + TAG_BYTES) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', loadKey(), raw.subarray(0, IV_BYTES))
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES))
    return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8')
  } catch {
    // Étiquette invalide : valeur altérée ou chiffrée avec une ancienne clé.
    // Les deux cas se traitent pareil, comme une valeur absente.
    return null
  }
}

/** Un jeton aléatoire (clé d'intégration, etc.). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/** Compare deux secrets en temps constant, pour ne rien dire de leur préfixe commun. */
export function safeEqual(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest()
  const right = createHash('sha256').update(b).digest()
  return timingSafeEqual(left, right) && a.length === b.length
}
