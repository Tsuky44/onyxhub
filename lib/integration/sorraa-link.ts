import 'server-only'
import { randomToken } from '../crypto'
import { errorMessage, normalizeBaseUrl } from '../http'
import { getSorraa, sorraaConfigured, type SorraaHubLink } from '../services/sorraa/client'
import { getSetting, setSettings } from '../settings/store'

/**
 * La liaison sorraa → OnyxHub (ADR-0017). sorraa pousse ses événements et
 * l'avancement de ses téléchargements à l'adresse et avec la clé enregistrées
 * dans *ses* réglages. Sans elles, il ne dit rien, et les barres de
 * téléchargement restent vides. « Relier sorraa » les y écrit, puis lui
 * demande de joindre OnyxHub : seul ce test, fait depuis le réseau de sorraa,
 * prouve que l'adresse est la bonne.
 */

/** L'adresse d'OnyxHub que sorraa doit joindre : celle fixée pour lui, celle fixée pour Onyx, ou celle du navigateur. */
function hubUrlFor(browserOrigin: string | null): string | null {
  return normalizeBaseUrl(getSetting('sorraa_hub_url')) ?? normalizeBaseUrl(getSetting('onyxhub_url')) ?? normalizeBaseUrl(browserOrigin)
}

/** La ligne d'état de la carte sorraa, d'après ce que sorraa dit de sa liaison. Pure. */
export function describeSorraaLink(link: SorraaHubLink, expectedUrl: string | null): { good: boolean; text: string } {
  const url = normalizeBaseUrl(link.url)
  if (!link.linked || !url) return { good: false, text: "sorraa n'est pas relié à OnyxHub : les téléchargements n'ont pas de barre." }
  if (link.lastError) return { good: false, text: `sorraa n'arrive pas à joindre OnyxHub à ${url} : ${link.lastError.replace(/\.$/, '')}.` }
  if (expectedUrl && expectedUrl !== url) return { good: false, text: `sorraa envoie à ${url}, pas à l'adresse fixée ici : relie-le de nouveau.` }
  return { good: true, text: `sorraa envoie ses téléchargements à ${url}.` }
}

/** `undefined` quand sorraa n'est pas branché : la carte n'a alors rien à dire de la liaison. */
export async function readSorraaLink(): Promise<{ good: boolean; text: string } | undefined> {
  if (!sorraaConfigured()) return undefined
  try {
    const explicit = normalizeBaseUrl(getSetting('sorraa_hub_url')) ?? normalizeBaseUrl(getSetting('onyxhub_url'))
    return describeSorraaLink(await getSorraa().hubLink(), explicit)
  } catch (error) {
    return { good: false, text: `État de la liaison inconnu. ${errorMessage(error)}` }
  }
}

/** Écrit l'adresse d'OnyxHub et la clé pour sorraa dans sorraa (en créant la clé s'il n'y en a pas), puis fait vérifier la liaison par sorraa. */
export async function linkSorraa(browserOrigin: string | null): Promise<{ ok: boolean; message: string }> {
  if (!sorraaConfigured()) return { ok: false, message: "Renseigne d'abord l'URL de sorraa." }
  const hubUrl = hubUrlFor(browserOrigin)
  if (!hubUrl) return { ok: false, message: "Renseigne l'adresse d'OnyxHub telle que sorraa la voit." }

  let key = getSetting('sorraa_hub_key')
  if (!key) {
    key = randomToken()
    setSettings({ sorraa_hub_key: key })
  }

  const sorraa = getSorraa()
  try {
    await sorraa.setHubLink(hubUrl, key)
  } catch (error) {
    return { ok: false, message: `sorraa n'a pas enregistré la liaison. ${errorMessage(error)}` }
  }

  let test
  try {
    test = await sorraa.testHubLink()
  } catch (error) {
    return { ok: false, message: `sorraa est relié à ${hubUrl}, mais la vérification a échoué. ${errorMessage(error)}` }
  }
  if (!test.ok) {
    const why = test.detail ? ` (${test.detail.replace(/\.$/, '')})` : ''
    return { ok: false, message: `sorraa est relié à ${hubUrl}, mais ne joint pas OnyxHub${why}. Renseigne l'adresse d'OnyxHub telle que sorraa la voit, puis relie de nouveau.` }
  }
  return { ok: true, message: `sorraa joint OnyxHub à ${hubUrl} : ses téléchargements auront leur barre.` }
}
