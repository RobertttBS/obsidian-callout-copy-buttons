import { RangeSetBuilder, type Extension } from "@codemirror/state";
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
import { CopyMarkdownButtonWidget, CopyPlainTextButtonWidget } from "./copyButtonWidget";

const CALLOUT_HEADER_WITH_INDENT_CAPTURE_REGEX = /^((?:> )+)\[!.+\]/;

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

        // Add widget decorations for Source Mode copy buttons (markdown and plain text)
        const markdownWidgetDeco = Decoration.widget({
          widget: new CopyMarkdownButtonWidget(calloutBodyText, pluginSettingsManager),
          side: 1, // Place the widget on the right
        });
        builder.add(headerLineInfo.from, headerLineInfo.from, markdownWidgetDeco);

        const plainTextWidgetDeco = Decoration.widget({
          widget: new CopyPlainTextButtonWidget(calloutBodyText, pluginSettingsManager),
          side: 1, // Place the widget after the markdown button
        });
        builder.add(headerLineInfo.from, headerLineInfo.from, plainTextWidgetDeco);
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
 */
export function createCalloutCopyButtonExtensions(
  pluginSettingsManager: PluginSettingsManager,
): Extension[] {
  return [createCalloutCopyButtonViewPlugin(pluginSettingsManager)];
}
