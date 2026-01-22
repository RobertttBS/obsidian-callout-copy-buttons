import { type App, MarkdownView } from "obsidian";
import type { EditorView } from "@codemirror/view";

/**
 * Gets the CodeMirror EditorView from the currently active markdown view.
 * Returns null if no active markdown view or editor is available.
 */
export function getActiveEditorView(app: App): EditorView | null {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  if (view === null) {
    return null;
  }
  // @ts-expect-error - accessing internal CM6 editor property
  const editorView: EditorView | undefined = view.editor?.cm;
  return editorView ?? null;
}
