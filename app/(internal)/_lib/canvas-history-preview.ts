export interface CanvasHistoryPreviewPage {
  id: string;
  name: string;
  svgDataUri: string;
}

function isSvgDataUri(value: string): boolean {
  return value.startsWith("data:image/svg+xml");
}

export function normalizeCanvasHistoryPreviewPages(input: unknown): CanvasHistoryPreviewPage[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("Preview payload must contain at least one page.");
  }

  return input.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error("Preview payload contains an invalid page item.");
    }

    const id = typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id.trim() : "";
    const name =
      typeof (item as { name?: unknown }).name === "string" ? (item as { name: string }).name.trim() : "";
    const svgDataUri =
      typeof (item as { svgDataUri?: unknown }).svgDataUri === "string"
        ? (item as { svgDataUri: string }).svgDataUri.trim()
        : "";

    if (!id || !svgDataUri || !isSvgDataUri(svgDataUri)) {
      throw new Error("Preview payload contains an invalid SVG preview page.");
    }

    return {
      id,
      name: name || `Page ${index + 1}`,
      svgDataUri,
    };
  });
}
