const FALLBACK_CURSOR_COLOR = "#38bdf8";

interface CollaborationCursorParticipant {
  clientId: number;
  nickname: string;
  color: string;
  local: boolean;
}

function validClientId(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function safeCursorColor(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : FALLBACK_CURSOR_COLOR;
}

/**
 * CSS string syntax is close to JavaScript string syntax, but not identical.
 * Encoding every code point as a CSS hex escape keeps collaborator-provided
 * nicknames inside the generated `content` value, including quotes, slashes,
 * newlines, and strings that resemble closing style tags.
 */
function cssString(value: string): string {
  const escaped = Array.from(value, (character) => {
    const codePoint = character.codePointAt(0);
    return codePoint === undefined ? "" : `\\${codePoint.toString(16)} `;
  }).join("");
  return `"${escaped}"`;
}

export function collaborationCursorStyles(
  localClientId: number | null,
  participants: readonly CollaborationCursorParticipant[],
): string {
  const styles: string[] = [];

  if (localClientId !== null && validClientId(localClientId)) {
    styles.push(
      `.collaboration-notebook .yRemoteSelection-${localClientId}{background:transparent!important}` +
        `.collaboration-notebook .yRemoteSelectionHead-${localClientId}{border-left-color:transparent!important;display:none!important}` +
        `.collaboration-notebook .yRemoteSelectionHead-${localClientId}::after{content:none!important;display:none!important}`,
    );
  }

  for (const participant of participants) {
    if (
      participant.local ||
      participant.clientId === localClientId ||
      !validClientId(participant.clientId)
    ) {
      continue;
    }
    const color = safeCursorColor(participant.color);
    const nickname = participant.nickname.trim() || "Collaborator";
    styles.push(
      `.collaboration-notebook .yRemoteSelection-${participant.clientId}{background:${color}55}` +
        `.collaboration-notebook .yRemoteSelectionHead-${participant.clientId}{` +
        `border-left-color:${color};` +
        `--collaboration-cursor-color:${color};` +
        `--collaboration-cursor-name:${cssString(nickname)}}`,
    );
  }

  return styles.join("");
}
