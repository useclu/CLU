export const GAME_LINE_LOGO_MAX_SOURCE_BYTES = 8 * 1024 * 1024
export const GAME_LINE_LOGO_MAX_DATA_URL_LENGTH = 350_000

export async function createLineLogoDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/i.test(file.type)) {
    throw new Error('Format non pris en charge. Utilisez PNG, JPG, WebP ou SVG.')
  }
  if (file.size > GAME_LINE_LOGO_MAX_SOURCE_BYTES) {
    throw new Error('Image trop lourde. La limite d’import est de 8 Mo.')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Impossible de lire cette image.'))
      image.src = objectUrl
    })

    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Impossible de préparer le logo.')

    context.clearRect(0, 0, size, size)
    const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight)
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const x = Math.round((size - width) / 2)
    const y = Math.round((size - height) / 2)
    context.drawImage(image, x, y, width, height)

    let dataUrl = canvas.toDataURL('image/webp', 0.88)
    if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/png')
    if (dataUrl.length > GAME_LINE_LOGO_MAX_DATA_URL_LENGTH) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.78)
    }
    if (dataUrl.length > GAME_LINE_LOGO_MAX_DATA_URL_LENGTH) {
      throw new Error('Le logo reste trop lourd après optimisation. Essayez une image plus simple.')
    }
    return dataUrl
  }
  finally {
    URL.revokeObjectURL(objectUrl)
  }
}
