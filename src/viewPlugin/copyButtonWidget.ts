import { WidgetType } from "@codemirror/view";
import classNames from "classnames";
import { setIcon } from "obsidian";
import { type PluginSettingsManager } from "../settings";
import { addClassNames } from "../utils/addClassNames";
import { stripLeadingQuoteMarkers } from "../utils/getCalloutBodyText";

type CopyButtonType = "markdown" | "plain-text";

abstract class BaseCopyButtonWidget extends WidgetType {
  constructor(
    protected text: string,
    protected pluginSettingsManager: PluginSettingsManager,
    protected buttonType: CopyButtonType,
  ) {
    super();
  }

  protected abstract getTextToCopy(): string;
  protected abstract getTooltip(): string;

  toDOM(): HTMLElement {
    const copyButton = document.createElement("div");
    const buttonTypeClass = `callout-copy-button-${this.buttonType}`;
    const className = classNames(
      "callout-copy-button",
      "callout-copy-button-widget",
      buttonTypeClass,
      this.pluginSettingsManager.getCopyButtonSettingsClassName(),
    );
    addClassNames({ el: copyButton, classNames: className });
    copyButton.setAttribute("aria-label", this.getTooltip());

    setIcon(copyButton, "copy");

    copyButton.addEventListener("click", (e) => {
      e.stopPropagation();
      if (copyButton.hasAttribute("disabled")) return;
      const textToCopy = this.getTextToCopy();
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          setIcon(copyButton, "check");
          copyButton.addClass("just-copied");
          copyButton.setAttribute("disabled", "true");
          setTimeout(() => {
            setIcon(copyButton, "copy");
            copyButton.removeClass("just-copied");
            copyButton.removeAttribute("disabled");
          }, 3000);
        })
        .catch((error: unknown) => {
          console.error(error);
        });
    });

    return copyButton;
  }

  ignoreEvent(): boolean {
    // Prevent clicks from being interpreted as editor interactions
    return true;
  }
}

export class CopyMarkdownButtonWidget extends BaseCopyButtonWidget {
  constructor(text: string, pluginSettingsManager: PluginSettingsManager) {
    super(text, pluginSettingsManager, "markdown");
  }

  protected getTextToCopy(): string {
    return this.text;
  }

  protected getTooltip(): string {
    return "Copy (Markdown)";
  }
}

export class CopyPlainTextButtonWidget extends BaseCopyButtonWidget {
  constructor(text: string, pluginSettingsManager: PluginSettingsManager) {
    super(text, pluginSettingsManager, "plain-text");
  }

  protected getTextToCopy(): string {
    return stripLeadingQuoteMarkers(this.text);
  }

  protected getTooltip(): string {
    return "Copy (plain text)";
  }
}

// Keep the old name for backward compatibility
export { CopyMarkdownButtonWidget as CopyButtonWidget };
