'use client'

import * as React from 'react'

/**
 * Animates a KPI to its value on mount and on change.
 *
 * Deliberately short and eased-out: enough to draw the eye to a number that
 * moved, not enough to make an operator wait to read it. Respects the OS
 * reduced-motion setting by jumping straight to the value.
 */
export function useCountUp(target: number | null, durationMs = 550): number | null {
  const [value, setValue] = React.useState<number>(target ?? 0)
  const fromRef = React.useRef<number>(target ?? 0)

  React.useEffect(() => {
    if (target === null) return

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const from = fromRef.current
    const start = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const progress = reduced ? 1 : Math.min((now - start) / durationMs, 1)
      const eased = 1 - (1 - progress) ** 3
      setValue(from + (target - from) * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
      else fromRef.current = target
    }

    // Even the reduced-motion path goes through a frame callback, so state is
    // never written synchronously during the effect.
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])

  // A value the source system could not supply stays null all the way to the
  // renderer, which shows N/A rather than a number counting up from zero.
  return target === null ? null : value
}
