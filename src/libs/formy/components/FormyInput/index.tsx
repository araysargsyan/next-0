import type { FormyInputProps } from "../../types";

/**
 * FormyInput — a pure Server Component (RSC) wrapper for native <input>.
 *
 * Renders a standard <input> with the `data-formy-input` marker attribute
 * so that FormyRestoreEngine can identify and restore values via event delegation.
 * Zero client JS — no "use client", no dynamic import, no cloneElement.
 */
export function FormyInput({ name, ...props }: FormyInputProps) {
    return <input data-formy-input name={name} {...props} />;
}
