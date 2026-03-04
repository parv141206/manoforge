"use client";

import React from "react";
import { useFileStore } from "@/stores/file-store";
import { useThemeStore } from "@/stores/theme-store";
import { VscFile } from "react-icons/vsc";
import { ErrorBoundary } from "@/components/ui/error-boundary";

const INSTRUCTIONS = [
  "AND",
  "ADD",
  "LDA",
  "STA",
  "BUN",
  "BSA",
  "ISZ",
  "CLA",
  "CLE",
  "CMA",
  "CME",
  "CIR",
  "CIL",
  "INC",
  "SPA",
  "SNA",
  "SZA",
  "SZE",
  "HLT",
  "INP",
  "OUT",
  "SKI",
  "SKO",
  "ION",
  "IOF",
];

const DIRECTIVES = ["ORG", "END", "DEC", "HEX"];

function highlightLine(
  line: string,
  syntax: {
    keyword: string;
    instruction: string;
    label: string;
    number: string;
    comment: string;
    directive: string;
  },
): React.ReactNode[] {
  const result: React.ReactNode[] = [];

  if (line.trim().startsWith(";")) {
    result.push(
      <span key="comment" style={{ color: syntax.comment }}>
        {line}
      </span>,
    );
    return result;
  }

  const commentIndex = line.indexOf(";");
  let codePart = line;
  let commentPart = "";

  if (commentIndex !== -1) {
    codePart = line.substring(0, commentIndex);
    commentPart = line.substring(commentIndex);
  }

  const tokens = codePart.split(/(\s+|,)/);
  let idx = 0;

  const whitespaceRegex = /^\s+$/;
  const numberRegex = /^[0-9]+$/;
  const hexRegex = /^[0-9A-Fa-f]+$/;

  for (const token of tokens) {
    const upperToken = token.toUpperCase().trim();

    if (!token || whitespaceRegex.exec(token) || token === ",") {
      result.push(<span key={idx++}>{token}</span>);
    } else if (INSTRUCTIONS.includes(upperToken)) {
      result.push(
        <span key={idx++} style={{ color: syntax.instruction }}>
          {token}
        </span>,
      );
    } else if (DIRECTIVES.includes(upperToken)) {
      result.push(
        <span key={idx++} style={{ color: syntax.directive }}>
          {token}
        </span>,
      );
    } else if (numberRegex.exec(token) || hexRegex.exec(token)) {
      result.push(
        <span key={idx++} style={{ color: syntax.number }}>
          {token}
        </span>,
      );
    } else if (
      token.endsWith(",") ||
      (codePart.startsWith(token) && codePart.includes(","))
    ) {
      result.push(
        <span key={idx++} style={{ color: syntax.label }}>
          {token}
        </span>,
      );
    } else if (upperToken === "I") {
      result.push(
        <span key={idx++} style={{ color: syntax.keyword }}>
          {token}
        </span>,
      );
    } else {
      result.push(
        <span key={idx++} style={{ color: syntax.label }}>
          {token}
        </span>,
      );
    }
  }

  if (commentPart) {
    result.push(
      <span key="comment-end" style={{ color: syntax.comment }}>
        {commentPart}
      </span>,
    );
  }

  return result;
}

interface Suggestion {
  text: string;
  type: "instruction" | "directive" | "keyword" | "label";
}

const LABEL_COLUMN = 8;

function formatAssemblyCode(code: string): string {
  const lines = code.split("\n");
  const formatted: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";")) {
      formatted.push(line);
      continue;
    }

    const commentIdx = trimmed.indexOf(";");
    let codePart = trimmed;
    let commentPart = "";
    if (commentIdx !== -1) {
      codePart = trimmed.slice(0, commentIdx).trim();
      commentPart = " " + trimmed.slice(commentIdx);
    }

    const labelMatch = /^(\w+),\s*(.*)$/.exec(codePart);
    if (labelMatch) {
      const label = labelMatch[1] + ",";
      const rest = labelMatch[2] ?? "";
      const labelPadded = label.padEnd(LABEL_COLUMN);
      const restPadded = rest ? rest : "";
      formatted.push(labelPadded + restPadded + commentPart);
    } else {
      formatted.push(" ".repeat(LABEL_COLUMN) + codePart + commentPart);
    }
  }

  return formatted.join("\n");
}

function CodeEditorInner() {
  const { files, activeFileId, updateFileContent, execution } = useFileStore();
  const { colorScheme } = useThemeStore();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const highlightRef = React.useRef<HTMLDivElement>(null);
  const lineNumbersRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLSpanElement>(null);

  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [cursorPosition, setCursorPosition] = React.useState({ x: 0, y: 0 });

  const activeFile = files?.find((f) => f.id === activeFileId);
  const content = activeFile?.content ?? "";
  const lines = content.split("\n");

  const labels = React.useMemo(() => {
    const found: string[] = [];
    for (const line of lines) {
      const match = /^(\w+),/.exec(line.trim());
      if (match?.[1]) {
        found.push(match[1]);
      }
    }
    return found;
  }, [lines]);

  const getSuggestions = (word: string): Suggestion[] => {
    if (!word || word.length < 1) return [];
    const upper = word.toUpperCase();
    const results: Suggestion[] = [];

    for (const instr of INSTRUCTIONS) {
      if (instr.startsWith(upper)) {
        results.push({ text: instr, type: "instruction" });
      }
    }
    for (const dir of DIRECTIVES) {
      if (dir.startsWith(upper)) {
        results.push({ text: dir, type: "directive" });
      }
    }
    if ("I".startsWith(upper)) {
      results.push({ text: "I", type: "keyword" });
    }
    for (const label of labels) {
      if (
        label.toUpperCase().startsWith(upper) &&
        !results.some((r) => r.text === label.toUpperCase())
      ) {
        results.push({ text: label, type: "label" });
      }
    }

    return results.slice(0, 8);
  };

  const getCurrentWord = (
    text: string,
    pos: number,
  ): { word: string; start: number } => {
    let start = pos;
    while (start > 0 && /\w/.test(text[start - 1] ?? "")) {
      start--;
    }
    return { word: text.slice(start, pos), start };
  };

  const applySuggestion = (suggestion: Suggestion) => {
    if (!textareaRef.current || !activeFileId) return;
    const textarea = textareaRef.current;
    const pos = textarea.selectionStart;
    const { start } = getCurrentWord(content, pos);

    const before = content.slice(0, start);
    const after = content.slice(pos);
    const newContent = before + suggestion.text + after;

    updateFileContent(activeFileId, newContent);
    setSuggestions([]);

    setTimeout(() => {
      const newPos = start + suggestion.text.length;
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
    }, 0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (activeFileId) {
      updateFileContent(activeFileId, e.target.value);
    }

    // suggestions
    const textarea = e.target;
    const pos = textarea.selectionStart;
    const { word, start: wordStart } = getCurrentWord(e.target.value, pos);

    if (word.length >= 1) {
      const newSuggestions = getSuggestions(word);
      setSuggestions(newSuggestions);
      setSelectedIndex(0);

      const textBeforeCursor = e.target.value.slice(0, wordStart);
      const linesBeforeCursor = textBeforeCursor.split("\n");
      const currentLine = linesBeforeCursor.length - 1;
      const lineText = linesBeforeCursor[linesBeforeCursor.length - 1] ?? "";

      let charWidth = 8.4; // fallback
      if (measureRef.current) {
        measureRef.current.textContent = lineText || "M";
        charWidth = measureRef.current.offsetWidth / (lineText.length || 1);
      }

      const scrollTop = textarea.scrollTop;
      const scrollLeft = textarea.scrollLeft;
      const lineHeight = 24;

      setCursorPosition({
        x: Math.max(8, lineText.length * charWidth + 8 - scrollLeft),
        y: (currentLine + 1) * lineHeight - scrollTop,
      });
    } else {
      setSuggestions([]);
    }
  };

  const handleScroll = () => {
    if (textareaRef.current) {
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
      }
      if (highlightRef.current) {
        highlightRef.current.scrollTop = textareaRef.current.scrollTop;
        highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
    }
  };

  const isCurrentLine = (lineIndex: number) => {
    // execution.currentLine stores the memory address (PC)
    if (
      execution?.currentLine === null ||
      execution?.currentLine === undefined
    ) {
      return false;
    }
    const mappedLine = execution.addressToLine?.[execution.currentLine];
    return mappedLine === lineIndex;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const pos = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;

    // Ctrl+Shift+F - Format code
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
      e.preventDefault();
      if (activeFileId) {
        const formatted = formatAssemblyCode(val);
        updateFileContent(activeFileId, formatted);
      }
      return;
    }

    // Ctrl+Space - Explicitly show suggestions
    if ((e.ctrlKey || e.metaKey) && e.key === " ") {
      e.preventDefault();
      const { word } = getCurrentWord(val, pos);
      const newSuggestions =
        word.length > 0
          ? getSuggestions(word)
          : [...INSTRUCTIONS, ...DIRECTIVES].slice(0, 8).map((text) => ({
              text,
              type: INSTRUCTIONS.includes(text)
                ? ("instruction" as const)
                : ("directive" as const),
            }));
      setSuggestions(newSuggestions);
      setSelectedIndex(0);
      return;
    }

    // Ctrl+D - Duplicate line
    if ((e.ctrlKey || e.metaKey) && e.key === "d") {
      e.preventDefault();
      const lineStart = val.lastIndexOf("\n", pos - 1) + 1;
      const lineEnd = val.indexOf("\n", pos);
      const actualLineEnd = lineEnd === -1 ? val.length : lineEnd;
      const currentLine = val.slice(lineStart, actualLineEnd);
      const newContent =
        val.slice(0, actualLineEnd) +
        "\n" +
        currentLine +
        val.slice(actualLineEnd);
      if (activeFileId) {
        updateFileContent(activeFileId, newContent);
        setTimeout(() => {
          const newPos = actualLineEnd + 1 + (pos - lineStart);
          textarea.setSelectionRange(newPos, newPos);
        }, 0);
      }
      return;
    }

    // Ctrl+/ - Toggle comment
    if ((e.ctrlKey || e.metaKey) && e.key === "/") {
      e.preventDefault();
      const lineStart = val.lastIndexOf("\n", pos - 1) + 1;
      const lineEnd = val.indexOf("\n", pos);
      const actualLineEnd = lineEnd === -1 ? val.length : lineEnd;
      const currentLine = val.slice(lineStart, actualLineEnd);
      const trimmed = currentLine.trimStart();
      const leadingSpaces = currentLine.length - trimmed.length;

      let newLine: string;
      let newPos: number;
      if (trimmed.startsWith(";")) {
        newLine =
          currentLine.slice(0, leadingSpaces) + trimmed.slice(1).trimStart();
        newPos = Math.max(lineStart, pos - 1);
      } else {
        newLine = currentLine.slice(0, leadingSpaces) + "; " + trimmed;
        newPos = pos + 2;
      }

      const newContent =
        val.slice(0, lineStart) + newLine + val.slice(actualLineEnd);
      if (activeFileId) {
        updateFileContent(activeFileId, newContent);
        setTimeout(() => {
          textarea.setSelectionRange(newPos, newPos);
        }, 0);
      }
      return;
    }

    // Ctrl+Shift+K - Delete line
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "K") {
      e.preventDefault();
      const lineStart = val.lastIndexOf("\n", pos - 1) + 1;
      const lineEnd = val.indexOf("\n", pos);
      const actualLineEnd = lineEnd === -1 ? val.length : lineEnd + 1;
      const newContent = val.slice(0, lineStart) + val.slice(actualLineEnd);
      if (activeFileId) {
        updateFileContent(activeFileId, newContent);
        setTimeout(() => {
          textarea.setSelectionRange(lineStart, lineStart);
        }, 0);
      }
      return;
    }

    // Alt+Up - Move line up
    if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault();
      const lineStart = val.lastIndexOf("\n", pos - 1) + 1;
      const lineEnd = val.indexOf("\n", pos);
      const actualLineEnd = lineEnd === -1 ? val.length : lineEnd;
      if (lineStart === 0) return;

      const prevLineStart = val.lastIndexOf("\n", lineStart - 2) + 1;
      const currentLine = val.slice(lineStart, actualLineEnd);
      const prevLine = val.slice(prevLineStart, lineStart - 1);

      const newContent =
        val.slice(0, prevLineStart) +
        currentLine +
        "\n" +
        prevLine +
        val.slice(actualLineEnd);
      const offsetInLine = pos - lineStart;
      const newPos = prevLineStart + offsetInLine;

      if (activeFileId) {
        updateFileContent(activeFileId, newContent);
        setTimeout(() => {
          textarea.setSelectionRange(newPos, newPos);
        }, 0);
      }
      return;
    }

    // Alt+Down - Move line down
    if (e.altKey && e.key === "ArrowDown") {
      e.preventDefault();
      const lineStart = val.lastIndexOf("\n", pos - 1) + 1;
      const lineEnd = val.indexOf("\n", pos);
      if (lineEnd === -1) return;

      const nextLineEnd = val.indexOf("\n", lineEnd + 1);
      const actualNextLineEnd = nextLineEnd === -1 ? val.length : nextLineEnd;
      const currentLine = val.slice(lineStart, lineEnd);
      const nextLine = val.slice(lineEnd + 1, actualNextLineEnd);

      const newContent =
        val.slice(0, lineStart) +
        nextLine +
        "\n" +
        currentLine +
        val.slice(actualNextLineEnd);
      const offsetInLine = pos - lineStart;
      const newPos = lineStart + nextLine.length + 1 + offsetInLine;

      if (activeFileId) {
        updateFileContent(activeFileId, newContent);
        setTimeout(() => {
          textarea.setSelectionRange(newPos, newPos);
        }, 0);
      }
      return;
    }

    // Ctrl+A - Select all (let browser handle but prevent our logic)
    if ((e.ctrlKey || e.metaKey) && e.key === "a") {
      return;
    }

    // Home - Go to start of line (after indentation)
    if (e.key === "Home" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const lineStart = val.lastIndexOf("\n", pos - 1) + 1;
      const lineEnd = val.indexOf("\n", pos);
      const actualLineEnd = lineEnd === -1 ? val.length : lineEnd;
      const currentLine = val.slice(lineStart, actualLineEnd);
      const firstNonSpace = currentLine.search(/\S/);
      const targetPos =
        firstNonSpace === -1 ? lineStart : lineStart + firstNonSpace;
      const newPos = pos === targetPos ? lineStart : targetPos;
      if (e.shiftKey) {
        textarea.setSelectionRange(newPos, end);
      } else {
        textarea.setSelectionRange(newPos, newPos);
      }
      return;
    }

    if (e.key === "Tab" && suggestions.length === 0) {
      e.preventDefault();
      const before = val.slice(0, pos);
      const after = val.slice(textarea.selectionEnd);
      const newContent = before + "    " + after;
      if (activeFileId) {
        updateFileContent(activeFileId, newContent);
        setTimeout(() => {
          textarea.setSelectionRange(pos + 4, pos + 4);
        }, 0);
      }
      return;
    }

    if (e.key === "Enter" && suggestions.length === 0) {
      e.preventDefault();
      const before = val.slice(0, pos);
      const after = val.slice(textarea.selectionEnd);
      const currentLineStart = before.lastIndexOf("\n") + 1;
      const currentLine = before.slice(currentLineStart);
      const indentMatch = /^(\s*)/.exec(currentLine);
      const indent = indentMatch?.[1] ?? "";
      const newContent = before + "\n" + indent + after;
      const indentLen = indent.length;
      if (activeFileId) {
        updateFileContent(activeFileId, newContent);
        setTimeout(() => {
          const newPos = pos + 1 + indentLen;
          textarea.setSelectionRange(newPos, newPos);
        }, 0);
      }
      return;
    }

    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + suggestions.length) % suggestions.length,
      );
    } else if (e.key === "Tab" || e.key === "Enter") {
      if (suggestions[selectedIndex]) {
        e.preventDefault();
        applySuggestion(suggestions[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setSuggestions([]);
    }
  };

  const getTypeColor = (type: Suggestion["type"]) => {
    switch (type) {
      case "instruction":
        return colorScheme.syntax.instruction;
      case "directive":
        return colorScheme.syntax.directive;
      case "keyword":
        return colorScheme.syntax.keyword;
      case "label":
        return colorScheme.syntax.label;
    }
  };

  if (!activeFile) {
    return (
      <div
        className="flex h-full items-center justify-center rounded-lg p-8"
        style={{ backgroundColor: colorScheme.panel }}
      >
        <div className="text-center" style={{ color: colorScheme.textMuted }}>
          <VscFile size={48} className="mx-auto mb-4" />
          <p className="text-lg">No file selected</p>
          <p className="mt-2 text-sm">
            Select a file from the sidebar or create a new one
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-lg"
      style={{ backgroundColor: colorScheme.panel }}
    >
      <div
        className="flex items-center border-b px-2"
        style={{ borderColor: colorScheme.border }}
      >
        <div
          className="flex items-center gap-2 rounded-t px-3 py-1.5 text-sm"
          style={{
            backgroundColor: colorScheme.active,
            color: colorScheme.text,
          }}
        >
          <VscFile size={12} />
          <span>{activeFile.name}</span>
        </div>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <div
          ref={lineNumbersRef}
          className="flex flex-col overflow-hidden py-2 text-right font-mono text-xs select-none"
          style={{ minWidth: "3rem", backgroundColor: colorScheme.sidebar }}
        >
          {lines.map((_, i) => (
            <div
              key={i}
              className="px-2 leading-6"
              style={{
                backgroundColor: isCurrentLine(i)
                  ? `${colorScheme.accent}40`
                  : "transparent",
                color: isCurrentLine(i)
                  ? colorScheme.accent
                  : colorScheme.textMuted,
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div
            ref={highlightRef}
            className="pointer-events-none absolute inset-0 overflow-hidden p-2 font-mono text-sm leading-6 whitespace-pre"
            aria-hidden="true"
          >
            {lines.map((line, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: isCurrentLine(i)
                    ? `${colorScheme.accent}20`
                    : "transparent",
                }}
              >
                {highlightLine(line, colorScheme.syntax)}
                {"\n"}
              </div>
            ))}
          </div>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setSuggestions([]), 150)}
            spellCheck={false}
            className="absolute inset-0 resize-none bg-transparent p-2 font-mono text-sm leading-6 text-transparent caret-current outline-none"
            style={{ caretColor: colorScheme.text }}
            placeholder="Start typing your Mano assembly code..."
          />

          <span
            ref={measureRef}
            className="pointer-events-none invisible absolute font-mono text-sm whitespace-pre"
            aria-hidden="true"
          />

          {suggestions.length > 0 && (
            <div
              className="absolute z-50 max-h-48 overflow-auto rounded border shadow-lg"
              style={{
                left: Math.min(cursorPosition.x, 200),
                top: cursorPosition.y,
                backgroundColor: colorScheme.sidebar,
                borderColor: colorScheme.border,
                minWidth: "140px",
                maxWidth: "200px",
              }}
            >
              {suggestions.map((suggestion, i) => (
                <div
                  key={suggestion.text}
                  className="flex cursor-pointer items-center gap-2 px-2 py-1 font-mono text-xs"
                  style={{
                    backgroundColor:
                      i === selectedIndex ? colorScheme.active : "transparent",
                    color: colorScheme.text,
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySuggestion(suggestion);
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: getTypeColor(suggestion.type) }}
                  />
                  <span style={{ color: getTypeColor(suggestion.type) }}>
                    {suggestion.text}
                  </span>
                  <span
                    className="ml-auto text-[10px]"
                    style={{ color: colorScheme.textMuted }}
                  >
                    {suggestion.type.slice(0, 5)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CodeEditor() {
  return (
    <ErrorBoundary>
      <CodeEditorInner />
    </ErrorBoundary>
  );
}

export default CodeEditor;
