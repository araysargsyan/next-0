import { useLayoutEffect } from "react";

const useIsomorphicLayoutEffect: typeof useLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : () => {};

export default useIsomorphicLayoutEffect;
