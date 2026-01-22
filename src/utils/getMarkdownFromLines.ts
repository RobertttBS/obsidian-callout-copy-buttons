import { type Text } from "@codemirror/state";

const CALLOUT_HEADER_WITH_INDENT_CAPTURE_REGEX = /^((?:> )+)\[!.+\]/;

/**
 * Extracts the callout body markdown from a document given the line range.
 * Strips the callout indent prefix (e.g., "> ") from each body line.
 *
 * @param doc - CodeMirror document
 * @param lineStart - 1-indexed line number of the callout header
 * @param lineEnd - 1-indexed line number of the last line of the callout
 * @returns The callout body with indent stripped, or null if not a valid callout
 */
export function getCalloutMarkdownFromLines(
  doc: Text,
  lineStart: number,
  lineEnd: number,
): string | null {
  if (lineStart < 1 || lineEnd > doc.lines || lineStart > lineEnd) {
    return null;
  }

  const headerLine = doc.line(lineStart).text;
  const indent = CALLOUT_HEADER_WITH_INDENT_CAPTURE_REGEX.exec(headerLine)?.[1];
  if (indent === undefined) {
    return null;
  }

  const bodyLines: string[] = [];
  for (let i = lineStart + 1; i <= lineEnd; i++) {
    const line = doc.line(i).text;
    if (!line.startsWith(indent)) {
      break;
    }
    bodyLines.push(line.slice(indent.length));
  }
  return bodyLines.join("\n");
}
