type BuildCanvasHistoryLabelInput = {
  fallbackLabel: string;
  historyLabel?: string;
  prompt?: string;
};

export function buildCanvasHistoryLabel({
  fallbackLabel,
  historyLabel = "",
  prompt = ""
}: BuildCanvasHistoryLabelInput): string {
  const normalizedFallbackLabel = fallbackLabel.trim();
  const normalizedHistoryLabel = historyLabel.trim();
  const normalizedPrompt = prompt.trim();

  if (
    normalizedHistoryLabel.length > 0 &&
    normalizedHistoryLabel !== normalizedFallbackLabel
  ) {
    return normalizedHistoryLabel;
  }

  if (normalizedPrompt.length > 0) {
    return normalizedPrompt;
  }

  return normalizedFallbackLabel;
}
