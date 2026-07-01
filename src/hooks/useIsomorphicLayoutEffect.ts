import { useLayoutEffect } from "react";

/**
 * A safe useLayoutEffect hook for SSR environments (e.g. Next.js).
 * 
 * Instead of falling back to useEffect on the server, we use a simple no-op function () => {}
 * since React never executes effect callbacks during SSR anyway.
 * 
 * We explicitly annotate the constant as typeof useLayoutEffect, leveraging TypeScript's
 * contextual typing to allow the empty function without any type casting.
 */
const useIsomorphicLayoutEffect: typeof useLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : () => {};

export default useIsomorphicLayoutEffect;
