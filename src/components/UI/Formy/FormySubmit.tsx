'use client'
import { useContext, ComponentProps } from "react";
import { FormyContext } from "./FormyContext";

interface FormySubmitProps extends ComponentProps<"button"> {
    loadingLabel?: string;
}

export function FormySubmit({ loadingLabel, children, className, style, ...props }: FormySubmitProps) {
    const { isPending } = useContext(FormyContext);

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
