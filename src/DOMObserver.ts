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
    // Optimization: Use classic loop for performance
    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];
      if (!mutation) continue;
      // Only care about node additions
      if (mutation.type !== "childList") continue;

      const addedNodes = mutation.addedNodes;
      for (let j = 0; j < addedNodes.length; j++) {
        const node = addedNodes[j];
        if (!(node instanceof HTMLElement)) continue;

        // OPTIMIZATION: Avoid querySelectorAll and Array spreading.
        // Check Live Preview Callouts (.cm-callout)
        if (node.classList.contains("cm-callout")) {
          processNode(node, true, pluginSettingsManager, app);
        } else {
          // Use getElementsByClassName (live collection, faster than querySelectorAll)
          const cmCallouts = node.getElementsByClassName("cm-callout");
          for (let k = 0; k < cmCallouts.length; k++) {
            processNode(cmCallouts[k] as HTMLElement, true, pluginSettingsManager, app);
          }
        }

        // Check Standard Callouts (.callout)
        // Must exclude those inside .cm-callout to prevent duplicates in Live Preview
        if (node.classList.contains("callout") && !node.closest(".cm-callout")) {
          processNode(node, false, pluginSettingsManager, app);
        } else {
          const callouts = node.getElementsByClassName("callout");
          for (let k = 0; k < callouts.length; k++) {
            const calloutEl = callouts[k] as HTMLElement;
            // closest() check is necessary but can be expensive; do it only on candidates
            if (!calloutEl.closest(".cm-callout")) {
              processNode(calloutEl, false, pluginSettingsManager, app);
            }
          }
        }
      }
    }
  });
}

function processNode(
  calloutNode: HTMLElement,
  isCMCalloutNode: boolean,
  pluginSettingsManager: PluginSettingsManager,
  app: App,
): void {
  addCopyPlainTextButtonToCalloutDiv({ calloutNode, isCMCalloutNode, pluginSettingsManager });

  if (isCMCalloutNode) {
    addCopyMarkdownButtonToLivePreviewCallout({ calloutNode, pluginSettingsManager, app });
  }

  moveEditBlockButtonToCalloutActionButtonsWrapper(calloutNode);
}

function addAllCopyButtons(pluginSettingsManager: PluginSettingsManager, app: App): void {
  // Use getElementsByClassName for initial load as well
  const cmCalloutNodes = document.getElementsByClassName("cm-callout");
  for (let i = 0; i < cmCalloutNodes.length; i++) {
    processNode(cmCalloutNodes[i] as HTMLElement, true, pluginSettingsManager, app);
  }

  const calloutNodes = document.getElementsByClassName("callout");
  for (let i = 0; i < calloutNodes.length; i++) {
    const node = calloutNodes[i] as HTMLElement;
    if (!node.closest(".cm-callout")) {
      processNode(node, false, pluginSettingsManager, app);
    }
  }
}

function addCopyMarkdownButtonToLivePreviewCallout({
  calloutNode,
  pluginSettingsManager,
  app,
}: {
  calloutNode: HTMLElement;
  pluginSettingsManager: PluginSettingsManager;
  app: App;
}): void {
  // Simple class check is faster than querySelector
  if (calloutNode.getElementsByClassName("callout-copy-button-markdown").length > 0) {
    return;
  }

  addCopyButtonToCallout({
    calloutNode,
    getCalloutBodyText: () => getMarkdownForCalloutNode(calloutNode, app),
    tooltipText: "Copy (Markdown)",
    buttonClassName: "callout-copy-button-markdown",
    isCMCalloutNode: true,
    pluginSettingsManager,
  });
}

function getMarkdownForCalloutNode(calloutNode: HTMLElement, app: App): string | null {
  const editorView = getActiveEditorView(app);
  if (!editorView) return null;

  let pos: number;
  try {
    pos = editorView.posAtDOM(calloutNode, 0);
  } catch {
    return null;
  }

  const doc = editorView.state.doc;
  const lineNumber = doc.lineAt(pos).number;

  const calloutRange = findCalloutRangeContainingLine(doc, lineNumber);
  if (!calloutRange) return null;

  return getCalloutMarkdownFromLines(doc, calloutRange.lineStart, calloutRange.lineEnd);
}

function findCalloutRangeContainingLine(
  doc: { lines: number; line: (n: number) => { text: string } },
  targetLine: number,
): { lineStart: number; lineEnd: number } | null {
  const docLineCount = doc.lines;
  let lineStart = -1;
  let indent = "";

  // 1. Scan UPWARDS
  for (let i = targetLine; i >= 1; i--) {
    const text = doc.line(i).text;

    // Fast path: if line doesn't start with >, it's definitely not part of the callout
    if (text.charCodeAt(0) !== 62) {
      // 62 is '>'
      // Wait, we might be inside a callout that is inside another blockquote?
      // Just check trim start.
      if (!text.trimStart().startsWith(">")) return null;
    }

    const match = CALLOUT_HEADER_REGEX.exec(text);
    if (match && match[1]) {
      lineStart = i;
      indent = match[1];
      break;
    }
  }

  if (lineStart === -1) return null;

  // 2. Scan DOWNWARDS
  let lineEnd = targetLine;
  for (let i = targetLine + 1; i <= docLineCount; i++) {
    const text = doc.line(i).text;
    if (!text.startsWith(indent)) {
      break;
    }
    lineEnd = i;
  }

  return { lineStart, lineEnd };
}
