export function getOptimalMinColumnWidth(
  content: string | undefined | null,
  minWidthPx: number = 60,
  charWidthPx: number = 8,
  paddingPx: number = 24
): string {
  if (!content) return `${minWidthPx}px`;
  const calculatedWidth = (content.length * charWidthPx) + paddingPx;
  return `${Math.max(minWidthPx, calculatedWidth)}px`;
}
