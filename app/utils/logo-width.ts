/** Narrow defaults apply only when copying from a regular banner. */
export function logoWidthForApplyAll(sourceWidth: number, sourceHeight: number, targetKey: string, width: number) {
  if (sourceWidth / sourceHeight >= 4 || sourceHeight / sourceWidth >= 4) return width
  const match = targetKey.match(/^(\d+)[x:](\d+)$/)
  if (!match) return width
  const targetWidth = Number(match[1]), targetHeight = Number(match[2])
  if (targetWidth / targetHeight >= 4) return 30
  if (targetHeight / targetWidth >= 4) return 100
  return width
}
