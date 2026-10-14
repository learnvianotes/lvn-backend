/**
 * A backslash a model failed to escape in its JSON (ADR-0086): `\text` arrives as a tab and "ext", `\rightarrow` as a
 * carriage return and "ightarrow". These control characters never belong in what a model writes for a note, so where
 * one is followed by the rest of a LaTeX command it is turned back into the command.
 */
export function mendEscapes(text: string): string {
  return (
    text
      .replace(/\t(ext\{|imes\b|heta\b|au\b|riangle\b|op\b)/g, '\\t$1')
      .replace(/\r(ightarrow\b|ho\b|angle\b)/g, '\\r$1')
      .replace(/\f(rac\{|orall\b)/g, '\\f$1')
      // eslint-disable-next-line no-control-regex -- the backspace an unescaped \b becomes
      .replace(/\x08(eta\b|ullet\b|egin\{|ar\{)/g, '\\b$1')
  )
}

/** Every string in a parsed answer, mended. */
export function mendAll<T>(value: T): T {
  if (typeof value === 'string') return mendEscapes(value) as T
  if (Array.isArray(value)) return value.map(mendAll) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mendAll(v)])) as T
  return value
}
