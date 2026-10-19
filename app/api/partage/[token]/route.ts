import { smbDownload } from '@/lib/files/download'
import { clearFailures, findShare, isExpired, recordDownload, recordFailure, tooManyAttempts, verifyPassword } from '@/lib/files/shares'
import { errorMessage } from '@/lib/http'
import { getSmb } from '@/lib/services/smb/client'

/**
 * Le téléchargement d'un lien de partage, sans compte. Un lien sans mot de
 * passe se télécharge en GET ; avec mot de passe, en POST depuis le
 * formulaire de la page `/partage/<jeton>` : le mot de passe ne passe jamais
 * dans l'URL (MediaHub le mettait en `?password=`, donc dans les journaux).
 */
type Context = { params: Promise<{ token: string }> }

function back(token: string, request: Request, error: string): Response {
  // Retour à la page du lien avec le message, en 303 pour repasser en GET.
  return Response.redirect(new URL(`/partage/${encodeURIComponent(token)}?erreur=${error}`, request.url), 303)
}

async function serve(token: string, request: Request, password: string | null): Promise<Response> {
  const share = findShare(token)
  if (!share || isExpired(share)) return new Response('Ce lien n’existe pas ou a expiré.', { status: 404 })
  if (share.passwordHash) {
    if (tooManyAttempts(token)) return back(token, request, 'essais')
    if (!password || !(await verifyPassword(password, share.passwordHash))) {
      recordFailure(token)
      return back(token, request, 'mot-de-passe')
    }
    clearFailures(token)
  }
  try {
    const response = await smbDownload(getSmb(), share.path, request.signal)
    recordDownload(share.id)
    return response
  } catch (error) {
    console.warn(`[partage] ${share.path} : ${errorMessage(error)}`)
    return new Response('Le fichier partagé est indisponible pour le moment.', { status: 502 })
  }
}

export async function GET(request: Request, { params }: Context) {
  const { token } = await params
  return serve(token, request, null)
}

export async function POST(request: Request, { params }: Context) {
  const { token } = await params
  const form = await request.formData().catch(() => null)
  const password = form?.get('motDePasse')
  return serve(token, request, typeof password === 'string' ? password : null)
}
