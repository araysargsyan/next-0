"use client";

import { type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import useIsomorphicLayoutEffect from "@/hooks/useIsomorphicLayoutEffect";
import { createLogger } from "@/libs/utils/logger";

const log = createLogger("FormySubmit", "blue");

interface FormySubmitProps extends ComponentProps<"button"> {
    loadingLabel?: string;
}

export function FormySubmit({ loadingLabel, children, className, style, ...props }: FormySubmitProps) {
    const { pending: isPending } = useFormStatus();

    useIsomorphicLayoutEffect(() => {
        log(`🔄 render`, { isPending });
    });

    const resolvedStyle = {
        ...style,
        backgroundColor: isPending ? "#ccc" : style?.backgroundColor,
    };

    return (
        <button
            type="submit"
            disabled={isPending || props.disabled}
            style={resolvedStyle}
            className={className}
            {...props}
        >
            {isPending && loadingLabel ? loadingLabel : children}
        </button>
    );
}
