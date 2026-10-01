// Reduce la foto a 1024px de lado y JPEG ~0.8: suficiente para la IA,
// ligera para guardar en el móvil y para enviar a la función.
export async function compressImage(file, max = 1024) {
  const bitmap = await createImageBitmap(file).catch(() => null)
  const source = bitmap || (await loadImg(file))
  const w = source.width, h = source.height
  const scale = Math.min(1, max / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.8)
}

function loadImg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
