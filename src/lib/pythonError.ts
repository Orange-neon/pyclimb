const USER_FRAME = /^\s*File ["']<exec>["'], line (\d+)(?:, in (.+))?\s*$/;

/** Removes Pyodide's implementation frames while preserving frames from student code. */
export function formatPythonError(value: string): string {
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return "Python stopped without an error message.";

  const lines = normalized.split("\n");
  const firstUserFrame = lines.findIndex((line) => USER_FRAME.test(line));
  if (firstUserFrame === -1) return normalized;

  return lines
    .slice(firstUserFrame)
    .map((line) => {
      const match = line.match(USER_FRAME);
      if (!match) return line;
      const [, lineNumber, context] = match;
      const location = context && context !== "<module>" ? ` in ${context}` : "";
      return `Your code, line ${lineNumber}${location}:`;
    })
    .join("\n")
    .trim();
}
