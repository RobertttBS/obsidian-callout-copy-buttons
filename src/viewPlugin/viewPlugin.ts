import { RangeSetBuilder, StateField, type EditorState, type Extension } from "@codemirror/state";
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type PluginSpec,
  type PluginValue,
  type ViewUpdate,
} from "@codemirror/view";
import { type PluginSettingsManager } from "../settings";
import { getCalloutBodyLines } from "../utils/getCalloutBodyText";
import { CopyButtonWidget } from "./copyButtonWidget";

const CALLOUT_HEADER_WITH_INDENT_CAPTURE_REGEX = /^((?:> )+)\[!.+\]/;

/**
 * Information about a callout's position in the document.
 */
export interface CalloutLineRange {
  lineStart: number;
  lineEnd: number;
}

/**
 * StateField that tracks all callout line ranges in the document.
 * This enables other parts of the code to look up callout positions.
 */
export const calloutRangesField = StateField.define<CalloutLineRange[]>({
  create(state: EditorState): CalloutLineRange[] {
    return computeCalloutRanges(state);
  },
  update(
    value: CalloutLineRange[],
    tr: { docChanged: boolean; state: EditorState },
  ): CalloutLineRange[] {
    if (tr.docChanged) {
      return computeCalloutRanges(tr.state);
    }
    return value;
  },
});

function computeCalloutRanges(state: EditorState): CalloutLineRange[] {
  const ranges: CalloutLineRange[] = [];
  const doc = state.doc;

  for (let line = 1; line <= doc.lines; line++) {
    const lineText = doc.line(line).text;
    const calloutIndent = CALLOUT_HEADER_WITH_INDENT_CAPTURE_REGEX.exec(lineText)?.[1];
    if (calloutIndent === undefined) {
      continue;
    }

    // Find the end of this callout
    let lineEnd = line;
    for (let i = line + 1; i <= doc.lines; i++) {
      const bodyLineText = doc.line(i).text;
      if (!bodyLineText.startsWith(calloutIndent)) {
        break;
      }
      lineEnd = i;
    }

    ranges.push({ lineStart: line, lineEnd });
  }

  return ranges;
}

export function createCalloutCopyButtonViewPlugin(
  pluginSettingsManager: PluginSettingsManager,
): ViewPlugin<PluginValue> {
  class CalloutCopyButtonViewPlugin implements PluginValue {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    destroy(): void {
      /* no-op */
    }

    buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      const doc = view.state.doc;

      for (let line = 1; line <= doc.lines; line++) {
        const lineText = doc.line(line).text;
        const calloutIndent = CALLOUT_HEADER_WITH_INDENT_CAPTURE_REGEX.exec(lineText)?.[1];
        if (calloutIndent === undefined) {
          // Not the start of a callout block
          continue;
        }
        const calloutBodyLines = getCalloutBodyLines({
          doc,
          calloutIndent,
          bodyStartLine: line + 1,
        });
        const calloutBodyText = calloutBodyLines.join("\n");

        // Calculate the end line of this callout
        const lineEnd = line + calloutBodyLines.length;

        const headerLineInfo = doc.line(line);

        // Add line decoration with data attributes for Live Preview
        const lineDeco = Decoration.line({
          attributes: {
            "data-callout-line-start": String(line),
            "data-callout-line-end": String(lineEnd),
          },
        });
        builder.add(headerLineInfo.from, headerLineInfo.from, lineDeco);

        // Add widget decoration for Source Mode copy button
        const widgetDeco = Decoration.widget({
          widget: new CopyButtonWidget(calloutBodyText, pluginSettingsManager),
          side: 1, // Place the widget on the right
        });
        builder.add(headerLineInfo.from, headerLineInfo.from, widgetDeco);
      }

      return builder.finish();
    }
  }

  const pluginSpec: PluginSpec<CalloutCopyButtonViewPlugin> = {
    decorations: (value: CalloutCopyButtonViewPlugin) => value.decorations,
  };

  return ViewPlugin.fromClass(CalloutCopyButtonViewPlugin, pluginSpec);
}

/**
 * Returns the extensions needed for callout copy functionality.
 * Includes both the StateField for tracking callout ranges and the ViewPlugin.
 */
export function createCalloutCopyButtonExtensions(
  pluginSettingsManager: PluginSettingsManager,
): Extension[] {
  return [calloutRangesField, createCalloutCopyButtonViewPlugin(pluginSettingsManager)];
}
