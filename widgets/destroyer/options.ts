const POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const;
export type LauncherPosition = (typeof POSITIONS)[number];

export interface DestroyerOptions {
  /** Corner where the launch button sits. */
  position: LauncherPosition;
  /** CSS selector limiting the destructible area. */
  scope: string;
}

const DEFAULT_POSITION: LauncherPosition = 'bottom-right';

/** Read options from the data-attributes of the embedding <script> tag. Never throws. */
export function readOptions(script: HTMLScriptElement | null): DestroyerOptions {
  const data = script?.dataset ?? {};

  let position = DEFAULT_POSITION;
  const rawPosition = data.position?.trim();
  if (rawPosition) {
    const match = POSITIONS.find((p) => p === rawPosition);
    if (match) position = match;
    else
      console.warn(
        `[destroyer] Unknown data-position "${rawPosition}", using "${DEFAULT_POSITION}". ` +
          `Valid values: ${POSITIONS.join(', ')}.`,
      );
  }

  const scope = data.scope?.trim() || 'body';
  return { position, scope };
}
