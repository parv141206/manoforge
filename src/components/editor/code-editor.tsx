"use client";

import React from "react";
import { useFileStore } from "@/stores/file-store";
import { useThemeStore } from "@/stores/theme-store";
import { useUiStore } from "@/stores/ui-store";
import { Parser } from "@/lib/parser";
import { tokenize } from "@/lib/tokenizer";
import {
  VscFile,
  VscClose,
  VscLightbulb,
  VscError,
  VscWarning,
} from "react-icons/vsc";
import { TbAssembly } from "react-icons/tb";
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

const IGNORED_SUGGESTION_REFRESH_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
  "Tab",
  "Enter",
  "Escape",
]);

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

interface CodeEditorProps {
  fileIdOverride?: string;
  onExternalFileDrop?: (fileId: string) => void;
}

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

function CodeEditorInner({
  fileIdOverride,
  onExternalFileDrop,
}: CodeEditorProps) {
  const {
    files,
    openFileIds,
    activeFileId: storeActiveFileId,
    setActiveFile,
    closeOpenFile,
    reorderOpenFiles,
    updateFileContent,
    execution,
  } = useFileStore();
  const { colorScheme } = useThemeStore();
  const { layoutMode, editorFontSize, setEditorFontSize, tabSize, setTabSize } =
    useUiStore();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const highlightRef = React.useRef<HTMLDivElement>(null);
  const lineNumbersRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLSpanElement>(null);
  const suppressSuggestionsRef = React.useRef(false);

  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [cursorPosition, setCursorPosition] = React.useState({
    x: 0,
    y: 0,
    placeAbove: false,
  });
  const [liveError, setLiveError] = React.useState<{
    line: number;
    column: number;
    message: string;
  } | null>(null);
  const [cursorInfo, setCursorInfo] = React.useState({ line: 1, col: 1 });

  const activeFileId = fileIdOverride ?? storeActiveFileId;
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

  const labelDiagnostics = React.useMemo(() => {
    const declared = new Map<string, number>();
    const used = new Map<string, number[]>();
    const memoryRef = new Set([
      "AND",
      "ADD",
      "LDA",
      "STA",
      "BUN",
      "BSA",
      "ISZ",
    ]);

    for (let lineNo = 0; lineNo < lines.length; lineNo++) {
      const sourceLine = lines[lineNo] ?? "";
      const commentIdx = sourceLine.indexOf(";");
      const code = (
        commentIdx >= 0 ? sourceLine.slice(0, commentIdx) : sourceLine
      ).trim();
      if (!code) continue;

      const tokens = code.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) continue;

      let idx = 0;
      const first = tokens[0] ?? "";
      if (first.endsWith(",")) {
        const label = first.slice(0, -1);
        if (label) declared.set(label, lineNo + 1);
        idx = 1;
      }

      const opcode = (tokens[idx] ?? "").toUpperCase();
      if (!memoryRef.has(opcode)) continue;

      const operand = tokens[idx + 1] ?? "";
      if (!operand || operand.toUpperCase() === "I") continue;
      if (/^-?\d+$/.test(operand)) continue;
      const cleanOperand = operand.replace(/,$/, "");
      if (!used.has(cleanOperand)) used.set(cleanOperand, []);
      used.get(cleanOperand)?.push(lineNo + 1);
    }

    const unused = [...declared.keys()].filter((name) => !used.has(name));
    const undeclared = [...used.keys()].filter((name) => !declared.has(name));

    const lineIssues: Record<
      number,
      { severity: "warning" | "error"; message: string }
    > = {};

    for (const label of unused) {
      const line = declared.get(label);
      if (!line) continue;
      lineIssues[line] = {
        severity: "warning",
        message: `Unused label: ${label}`,
      };
    }

    for (const label of undeclared) {
      const refs = used.get(label) ?? [];
      for (const line of refs) {
        lineIssues[line] = {
          severity: "error",
          message: `Undeclared label: ${label}`,
        };
      }
    }

    return { unused, undeclared, lineIssues };
  }, [lines]);

  const lineHeight = Math.round(editorFontSize * 1.5);
  const errorCount = (liveError ? 1 : 0) + labelDiagnostics.undeclared.length;
  const unusedCount = labelDiagnostics.unused.length;

  const updateCursorInfo = React.useCallback(
    (textarea: HTMLTextAreaElement) => {
      const pos = textarea.selectionStart;
      const before = textarea.value.slice(0, pos);
      const parts = before.split("\n");
      const line = parts.length;
      const col = (parts[parts.length - 1]?.length ?? 0) + 1;
      setCursorInfo({ line, col });
    },
    [],
  );

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (!content.trim()) {
        setLiveError(null);
        return;
      }

      try {
        const parser = new Parser(tokenize(content), content, { silent: true });
        parser.parse();
        setLiveError(null);
      } catch (err) {
        const maybe = err as {
          message?: string;
          line?: number;
          column?: number;
        };
        if (
          typeof maybe.line === "number" &&
          typeof maybe.column === "number"
        ) {
          setLiveError({
            line: maybe.line,
            column: maybe.column,
            message: maybe.message ?? "Syntax error",
          });
          return;
        }
        setLiveError(null);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [content]);

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const next = editorFontSize + (event.deltaY < 0 ? 1 : -1);
      setEditorFontSize(next);
    };

    textarea.addEventListener("wheel", onWheel, { passive: false });
    return () => textarea.removeEventListener("wheel", onWheel);
  }, [editorFontSize, setEditorFontSize]);

  const getSuggestions = React.useCallback(
    (word: string): Suggestion[] => {
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
    },
    [labels],
  );

  const refreshSuggestions = React.useCallback(
    (textarea: HTMLTextAreaElement, text: string) => {
      if (suppressSuggestionsRef.current) {
        setSuggestions([]);
        return;
      }

      const pos = textarea.selectionStart;
      const { word, start: wordStart } = getCurrentWord(text, pos);

      if (word.length < 1) {
        setSuggestions([]);
        setSelectedIndex(0);
        return;
      }

      const newSuggestions = getSuggestions(word);
      const sameSuggestions =
        suggestions.length === newSuggestions.length &&
        suggestions.every(
          (current, index) =>
            current.text === newSuggestions[index]?.text &&
            current.type === newSuggestions[index]?.type,
        );

      if (!sameSuggestions) {
        setSuggestions(newSuggestions);
      }

      setSelectedIndex((prev) => {
        if (!sameSuggestions) return 0;
        if (newSuggestions.length === 0) return 0;
        return Math.min(prev, newSuggestions.length - 1);
      });

      const textBeforeCursor = text.slice(0, wordStart);
      const linesBeforeCursor = textBeforeCursor.split("\n");
      const currentLine = linesBeforeCursor.length - 1;
      const lineText = linesBeforeCursor[linesBeforeCursor.length - 1] ?? "";
      const caretTop = currentLine * lineHeight - textarea.scrollTop;
      const belowTop = caretTop + lineHeight;

      let charWidth = 8.4;
      if (measureRef.current) {
        measureRef.current.textContent = lineText || "M";
        charWidth = measureRef.current.offsetWidth / (lineText.length || 1);
      }

      const estimatedPopupHeight = Math.min(
        192,
        Math.max(28, newSuggestions.length * 24 + 8),
      );
      const placeAbove =
        belowTop + estimatedPopupHeight > textarea.clientHeight &&
        caretTop - estimatedPopupHeight >= 0;

      setCursorPosition({
        x: Math.max(8, lineText.length * charWidth + 8 - textarea.scrollLeft),
        y: placeAbove
          ? Math.max(8, caretTop - estimatedPopupHeight)
          : Math.max(8, belowTop),
        placeAbove,
      });
    },
    [getSuggestions, lineHeight, suggestions],
  );

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
    suppressSuggestionsRef.current = false;

    setTimeout(() => {
      const newPos = start + suggestion.text.length;
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
    }, 0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    suppressSuggestionsRef.current = false;
    if (activeFileId) {
      updateFileContent(activeFileId, e.target.value);
    }

    updateCursorInfo(e.target);
    refreshSuggestions(e.target, e.target.value);
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

    if (e.key === "Escape" && suggestions.length > 0) {
      e.preventDefault();
      setSuggestions([]);
      setSelectedIndex(0);
      suppressSuggestionsRef.current = true;
      return;
    }

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
      suppressSuggestionsRef.current = false;
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
      const tabText = " ".repeat(tabSize);
      const newContent = before + tabText + after;
      if (activeFileId) {
        updateFileContent(activeFileId, newContent);
        setTimeout(() => {
          const newPos = pos + tabText.length;
          textarea.setSelectionRange(newPos, newPos);
          updateCursorInfo(textarea);
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
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + suggestions.length) % suggestions.length,
      );
      return;
    }

    if (e.key === "Tab" || e.key === "Enter") {
      if (suggestions[selectedIndex]) {
        e.preventDefault();
        applySuggestion(suggestions[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setSelectedIndex(0);
      suppressSuggestionsRef.current = true;
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
      className={`flex h-full flex-col overflow-hidden ${layoutMode === "compact" ? "rounded-none" : "rounded-lg"}`}
      style={{
        backgroundColor: colorScheme.panel,
        border:
          layoutMode === "compact"
            ? `1px solid ${colorScheme.border}66`
            : `1px solid ${colorScheme.border}`,
      }}
    >
      <div
        className="flex items-center gap-1 overflow-x-auto border-b px-2 py-1"
        style={{ borderColor: colorScheme.border }}
        onDragOver={(e) => {
          const hasFile =
            e.dataTransfer.types.includes("application/x-mano-file-id") ||
            e.dataTransfer.types.includes("application/x-mano-tab-id") ||
            e.dataTransfer.types.includes("text/plain");
          if (!hasFile) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          const droppedFileId =
            e.dataTransfer.getData("application/x-mano-file-id") ||
            e.dataTransfer.getData("application/x-mano-tab-id") ||
            e.dataTransfer.getData("text/plain");
          if (!droppedFileId) return;
          e.preventDefault();
          if (onExternalFileDrop) {
            onExternalFileDrop(droppedFileId);
          } else {
            setActiveFile(droppedFileId);
          }
        }}
      >
        {(fileIdOverride
          ? [activeFile]
          : openFileIds
              .map((id) => files.find((f) => f.id === id))
              .filter((f): f is NonNullable<typeof f> => Boolean(f))
        ).map((file) => {
          const isActive = file.id === activeFileId;
          return (
            <div
              key={file.id}
              onClick={() => setActiveFile(file.id)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "copyMove";
                e.dataTransfer.setData("application/x-mano-file-id", file.id);
                e.dataTransfer.setData("application/x-mano-tab-id", file.id);
                e.dataTransfer.setData("text/plain", file.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const draggedTabId = e.dataTransfer.getData(
                  "application/x-mano-tab-id",
                );
                if (draggedTabId) {
                  reorderOpenFiles(draggedTabId, file.id);
                  return;
                }
                const droppedFileId =
                  e.dataTransfer.getData("application/x-mano-file-id") ||
                  e.dataTransfer.getData("text/plain");
                if (!droppedFileId) return;
                if (onExternalFileDrop) {
                  onExternalFileDrop(droppedFileId);
                } else {
                  setActiveFile(droppedFileId);
                }
              }}
              className="group flex max-w-56 cursor-pointer items-center gap-2 rounded-t px-3 py-1.5 text-sm transition-colors"
              style={{
                backgroundColor: isActive
                  ? colorScheme.active
                  : colorScheme.sidebar,
                color: isActive ? colorScheme.text : colorScheme.textMuted,
                border: `1px solid ${colorScheme.border}`,
                borderBottom: "none",
              }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <TbAssembly size={12} />
                <span className="truncate">{file.name}</span>
              </div>
              {!fileIdOverride && openFileIds.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeOpenFile(file.id);
                  }}
                  className="opacity-70 transition-opacity hover:opacity-100"
                  style={{ color: colorScheme.textMuted }}
                  title="Close"
                >
                  <VscClose size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <div
          ref={lineNumbersRef}
          className="flex flex-col overflow-hidden py-2 text-right font-mono text-xs select-none"
          style={{ minWidth: "3rem", backgroundColor: colorScheme.sidebar }}
        >
          {lines.map((_, i) => {
            const issue = labelDiagnostics.lineIssues[i + 1];
            return (
              <div
                key={i}
                className="flex items-center justify-between gap-1 px-2"
                style={{
                  lineHeight: `${lineHeight}px`,
                  backgroundColor: isCurrentLine(i)
                    ? `${colorScheme.accent}40`
                    : "transparent",
                  color:
                    liveError?.line === i + 1
                      ? "#ef4444"
                      : isCurrentLine(i)
                        ? colorScheme.accent
                        : colorScheme.textMuted,
                }}
              >
                <span>{i + 1}</span>
                {issue && (
                  <VscLightbulb
                    size={11}
                    title={issue.message}
                    style={{
                      color:
                        issue.severity === "error"
                          ? "#ef4444"
                          : colorScheme.textMuted,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div
            ref={highlightRef}
            className="pointer-events-none absolute inset-0 overflow-hidden p-2 font-mono wrap-break-word whitespace-pre-wrap"
            style={{
              fontSize: `${editorFontSize}px`,
              lineHeight: `${lineHeight}px`,
            }}
            aria-hidden="true"
          >
            {lines.map((line, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: isCurrentLine(i)
                    ? `${colorScheme.accent}20`
                    : "transparent",
                  textDecoration:
                    liveError?.line === i + 1
                      ? "underline wavy #ef4444"
                      : "none",
                  textUnderlineOffset:
                    liveError?.line === i + 1 ? "3px" : undefined,
                }}
                title={
                  liveError?.line === i + 1 ? liveError.message : undefined
                }
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
            onKeyUp={(e) => {
              updateCursorInfo(e.currentTarget);
              if (IGNORED_SUGGESTION_REFRESH_KEYS.has(e.key)) return;
              if (e.ctrlKey || e.metaKey || e.altKey) return;
              refreshSuggestions(e.currentTarget, e.currentTarget.value);
            }}
            onSelect={(e) => {
              updateCursorInfo(e.currentTarget);
              refreshSuggestions(e.currentTarget, e.currentTarget.value);
            }}
            onClick={(e) => {
              updateCursorInfo(e.currentTarget);
              refreshSuggestions(e.currentTarget, e.currentTarget.value);
            }}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setSuggestions([]), 150)}
            spellCheck={false}
            className="absolute inset-0 resize-none bg-transparent p-2 font-mono text-transparent caret-current outline-none"
            style={{
              caretColor: colorScheme.text,
              fontSize: `${editorFontSize}px`,
              lineHeight: `${lineHeight}px`,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
            placeholder="Start typing your Mano assembly code..."
          />

          <span
            ref={measureRef}
            className="pointer-events-none invisible absolute font-mono whitespace-pre"
            style={{ fontSize: `${editorFontSize}px` }}
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
                transformOrigin: cursorPosition.placeAbove
                  ? "bottom left"
                  : "top left",
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

      <div
        className="flex items-center justify-between border-t px-2 py-1 text-[11px]"
        style={{
          borderColor: colorScheme.border,
          color: colorScheme.textMuted,
          backgroundColor: colorScheme.sidebar,
        }}
      >
        <div className="flex items-center gap-2">
          <span>Zoom {editorFontSize}px</span>
          <span>
            Ln {cursorInfo.line}, Col {cursorInfo.col}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTabSize(2)}
              className="rounded px-1"
              style={{
                color: tabSize === 2 ? colorScheme.text : colorScheme.textMuted,
                backgroundColor:
                  tabSize === 2 ? colorScheme.active : "transparent",
              }}
            >
              2
            </button>
            <button
              onClick={() => setTabSize(4)}
              className="rounded px-1"
              style={{
                color: tabSize === 4 ? colorScheme.text : colorScheme.textMuted,
                backgroundColor:
                  tabSize === 4 ? colorScheme.active : "transparent",
              }}
            >
              4
            </button>
            <button
              onClick={() => setTabSize(8)}
              className="rounded px-1"
              style={{
                color: tabSize === 8 ? colorScheme.text : colorScheme.textMuted,
                backgroundColor:
                  tabSize === 8 ? colorScheme.active : "transparent",
              }}
            >
              8
            </button>
            <span>Spaces</span>
          </div>
          <span className="flex items-center gap-1" title="Errors">
            <VscError size={12} style={{ color: "#ef4444" }} />
            <span>{errorCount}</span>
          </span>
          <span className="flex items-center gap-1" title="Unused labels">
            <VscWarning size={12} style={{ color: colorScheme.textMuted }} />
            <span>{unusedCount}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function CodeEditor(props: CodeEditorProps) {
  return (
    <ErrorBoundary>
      <CodeEditorInner {...props} />
    </ErrorBoundary>
  );
}

export default CodeEditor;
