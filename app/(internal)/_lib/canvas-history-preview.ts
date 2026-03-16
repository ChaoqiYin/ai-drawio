export interface CanvasHistoryPreviewPage {
  id: string;
  name: string;
  svgDataUri: string;
}

const BLANK_CANVAS_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'><rect width='640' height='360' fill='#f8fafc'/><rect x='64' y='48' width='512' height='264' rx='24' fill='#ffffff' stroke='#cbd5e1' stroke-width='2' stroke-dasharray='10 10'/><text x='320' y='184' text-anchor='middle' font-family='Arial, sans-serif' font-size='24' fill='#94a3b8'>Blank Canvas</text></svg>";

function isSvgDataUri(value: string): boolean {
  return value.startsWith("data:image/svg+xml");
}

export function buildBlankCanvasHistoryPreviewPages(): CanvasHistoryPreviewPage[] {
  return [
    {
      id: "page-1",
      name: "Blank Canvas",
      svgDataUri: `data:image/svg+xml;utf8,${encodeURIComponent(BLANK_CANVAS_SVG)}`
    }
  ];
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
