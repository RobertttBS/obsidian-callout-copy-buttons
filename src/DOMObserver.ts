import { type App } from "obsidian";
import { type PluginSettingsManager } from "./settings";
import {
  addCopyButtonToCallout,
  addCopyPlainTextButtonToCalloutDiv,
  moveEditBlockButtonToCalloutActionButtonsWrapper,
} from "./utils/addCopyButtonToCallout";
import { getActiveEditorView } from "./utils/getEditorView";
import { getCalloutMarkdownFromLines } from "./utils/getMarkdownFromLines";

const CALLOUT_HEADER_REGEX = /^((?:> )+)\[!.+\]/;

export function watchAndAddCopyButtonsToDOM({
  pluginSettingsManager,
  app,
}: {
  pluginSettingsManager: PluginSettingsManager;
  app: App;
}): MutationObserver {
  const observer = watchDOMForNewCallouts(pluginSettingsManager, app);
  addAllCopyButtons(pluginSettingsManager, app);
  return observer;
}

function watchDOMForNewCallouts(
  pluginSettingsManager: PluginSettingsManager,
  app: App,
): MutationObserver {
  const observer = getCalloutDivObserver(pluginSettingsManager, app);
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

function getCalloutDivObserver(
  pluginSettingsManager: PluginSettingsManager,
  app: App,
): MutationObserver {
  return new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) {
          return;
        }
        // Check if node itself is a .cm-callout, or find descendants
        const newCMCalloutNodes: HTMLElement[] = [];
        if (node.matches(".cm-callout")) {
          newCMCalloutNodes.push(node);
        }
        newCMCalloutNodes.push(...node.querySelectorAll<HTMLDivElement>(".cm-callout"));

        for (const calloutNode of newCMCalloutNodes) {
          addCopyButtonsAndMoveEditBlockButton({
            calloutNode,
            isCMCalloutNode: true,
            pluginSettingsManager,
            app,
          });
        }

        // Check if node itself is a .callout, or find descendants
        // Skip .callout nodes that are inside .cm-callout (already handled above)
        const newCalloutNodes: HTMLElement[] = [];
        if (node.matches(".callout") && !node.closest(".cm-callout")) {
          newCalloutNodes.push(node);
        }
        for (const calloutEl of node.querySelectorAll<HTMLDivElement>(".callout")) {
          if (!calloutEl.closest(".cm-callout")) {
            newCalloutNodes.push(calloutEl);
          }
        }

        for (const calloutNode of newCalloutNodes) {
          addCopyButtonsAndMoveEditBlockButton({
            calloutNode,
            isCMCalloutNode: false,
            pluginSettingsManager,
            app,
          });
        }
      });
    });
  });
}

function addAllCopyButtons(pluginSettingsManager: PluginSettingsManager, app: App): void {
  const cmCalloutNodes = document.querySelectorAll<HTMLElement>(".cm-callout");
  cmCalloutNodes.forEach((calloutNode) =>
    addCopyButtonsAndMoveEditBlockButton({
      calloutNode,
      isCMCalloutNode: true,
      pluginSettingsManager,
      app,
    }),
  );
  const calloutNodes = document.querySelectorAll<HTMLElement>(".callout");
  calloutNodes.forEach((calloutNode) =>
    addCopyButtonsAndMoveEditBlockButton({
      calloutNode,
      isCMCalloutNode: false,
      pluginSettingsManager,
      app,
    }),
  );
}

function addCopyButtonsAndMoveEditBlockButton({
  calloutNode,
  isCMCalloutNode,
  pluginSettingsManager,
  app,
}: {
  calloutNode: HTMLElement;
  isCMCalloutNode: boolean;
  pluginSettingsManager: PluginSettingsManager;
  app: App;
}): void {
  addCopyPlainTextButtonToCalloutDiv({ calloutNode, isCMCalloutNode, pluginSettingsManager });

  // Add markdown copy button for Live Preview callouts
  if (isCMCalloutNode) {
    addCopyMarkdownButtonToLivePreviewCallout({ calloutNode, pluginSettingsManager, app });
  }

  moveEditBlockButtonToCalloutActionButtonsWrapper(calloutNode);
}

/**
 * Adds a "Copy (Markdown)" button to Live Preview callouts.
 * At click time, uses DOM position to find the callout in the editor state.
 */
function addCopyMarkdownButtonToLivePreviewCallout({
  calloutNode,
  pluginSettingsManager,
  app,
}: {
  calloutNode: HTMLElement;
  pluginSettingsManager: PluginSettingsManager;
  app: App;
}): void {
  if (calloutNode.querySelector(".callout-copy-button-markdown") !== null) {
    // Markdown copy button already exists
    return;
  }

  addCopyButtonToCallout({
    calloutNode,
    getCalloutBodyText: () => {
      return getMarkdownForCalloutNode(calloutNode, app);
    },
    tooltipText: "Copy (Markdown)",
    buttonClassName: "callout-copy-button-markdown",
    isCMCalloutNode: true,
    pluginSettingsManager,
  });
}

/**
 * Gets the markdown content for a callout node by finding its position in the editor.
 */
function getMarkdownForCalloutNode(calloutNode: HTMLElement, app: App): string | null {
  const editorView = getActiveEditorView(app);
  if (editorView === null) {
    return null;
  }

  // Try to find the position of this callout in the editor
  let pos: number;
  try {
    pos = editorView.posAtDOM(calloutNode, 0);
  } catch {
    return null;
  }

  const doc = editorView.state.doc;
  const lineNumber = doc.lineAt(pos).number;

  // Find the callout that contains this line by scanning the document
  const calloutRange = findCalloutRangeContainingLine(doc, lineNumber);
  if (calloutRange === null) {
    return null;
  }

  return getCalloutMarkdownFromLines(doc, calloutRange.lineStart, calloutRange.lineEnd);
}

/**
 * Finds the callout range that contains the given line number.
 */
function findCalloutRangeContainingLine(
  doc: { lines: number; line: (n: number) => { text: string } },
  targetLine: number,
): { lineStart: number; lineEnd: number } | null {
  // Scan for callout headers and find one that contains the target line
  for (let line = 1; line <= doc.lines; line++) {
    const lineText = doc.line(line).text;
    const indent = CALLOUT_HEADER_REGEX.exec(lineText)?.[1];
    if (indent === undefined) {
      continue;
    }

    // Found a callout header at this line
    const lineStart = line;
    let lineEnd = line;

    // Find the end of this callout
    for (let i = line + 1; i <= doc.lines; i++) {
      const bodyLineText = doc.line(i).text;
      if (!bodyLineText.startsWith(indent)) {
        break;
      }
      lineEnd = i;
    }

    // Check if target line is within this callout
    if (targetLine >= lineStart && targetLine <= lineEnd) {
      return { lineStart, lineEnd };
    }
  }

  return null;
}
