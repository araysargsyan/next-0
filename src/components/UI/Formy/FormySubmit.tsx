'use client'
import { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

interface FormySubmitProps extends ComponentProps<"button"> {
    loadingLabel?: string;
}

export function FormySubmit({ loadingLabel, children, className, style, ...props }: FormySubmitProps) {
    const { pending: isPending } = useFormStatus();

    const resolvedStyle = {
        ...style,
        backgroundColor: isPending ? "#ccc" : style?.backgroundColor
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
