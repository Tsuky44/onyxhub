import { adminForRoute } from '@/lib/auth/viewer'
import { smbDownload } from '@/lib/files/download'
import { errorMessage, ServiceError } from '@/lib/http'
import { getSmb } from '@/lib/services/smb/client'

/** Téléchargement depuis l'explorateur (admin) : un fichier tel quel, un dossier en ZIP. */
export async function GET(request: Request) {
  const { denied } = await adminForRoute()
  if (denied) return denied
  const path = new URL(request.url).searchParams.get('chemin') ?? ''
  try {
    return await smbDownload(getSmb(), path, request.signal)
  } catch (error) {
    const status = error instanceof ServiceError && error.status === 400 ? 400 : 502
    return Response.json({ error: errorMessage(error) }, { status })
  }
}
