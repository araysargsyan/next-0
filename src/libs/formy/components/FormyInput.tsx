"use client";

import { useErrorsContext } from "../contexts/ErrorsContext";
import { FormyError } from "./FormyError";
import type { InputEvent, ChangeEvent, ComponentProps } from "react";

interface FormyInputProps extends ComponentProps<"input"> {
    name: string;
    validate?: (value: string) => string | null;
    errorBelow?: boolean;
    errorAbsolute?: boolean;
    errorHelpText?: string;
    errorParseMessage?: (message: string) => { title: string; info?: string };
    containerClassName?: string;
}

export function FormyInput({
    name,
    validate,
    errorBelow = true,
    errorAbsolute = true,
    errorHelpText = "",
    errorParseMessage,
    containerClassName = "relative mb-6",
    className = "w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black",
    ...props
}: FormyInputProps) {
    const { clearFieldError } = useErrorsContext(name);

    const handleInput = (e: InputEvent<HTMLInputElement>) => {
        clearFieldError?.(name);
        props.onInput?.(e);
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        clearFieldError?.(name);
        props.onChange?.(e);
    };

    return (
        <div className={containerClassName}>
            <input
                name={name}
                className={className}
                onInput={handleInput}
                onChange={handleChange}
                {...props}
            />
            <FormyError
                field={name}
                below={errorBelow}
                absolute={errorAbsolute}
                helpText={errorHelpText || undefined}
                parseMessage={errorParseMessage}
                validate={validate}
            />
        </div>
    );
}
