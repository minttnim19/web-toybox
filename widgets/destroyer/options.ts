export type LauncherPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface DestroyerOptions {
  /** Corner where the launch button sits. */
  position: LauncherPosition;
  /** CSS selector limiting the destructible area. */
  scope: string;
}

const POSITIONS: readonly LauncherPosition[] = [
  'bottom-right',
  'bottom-left',
  'top-right',
  'top-left',
];

/** Read options from the data-attributes of the embedding <script> tag. */
export function readOptions(script: HTMLScriptElement | null): DestroyerOptions {
  const data = script?.dataset ?? {};
  const position = POSITIONS.find((p) => p === data.position) ?? 'bottom-right';
  const scope = data.scope?.trim() || 'body';
  return { position, scope };
}
