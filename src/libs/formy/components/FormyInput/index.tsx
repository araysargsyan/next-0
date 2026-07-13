import { FormyError } from "../FormyError";
import {DynamicInput} from "./DynamicInput";
import type {FormyErrorProps, FormyInputProps} from "../../types";


export function FormyInput({
    children = null,
    validate,
    errorBelow = true,
    errorAbsolute = true,
    errorHelpText = "",
    errorParseMessage,
    containerClassName = "relative mb-6",
    className = "w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black",
    name,
    type,
    onChange,
    ...props
}: FormyInputProps) {
    const formyErrorProps: FormyErrorProps = {
        field: name,
        below: errorBelow,
        absolute: errorAbsolute,
        validate,
    };
    if (errorParseMessage) {
        formyErrorProps.parseMessage = errorParseMessage;
    }
    if (errorHelpText) {
        formyErrorProps.helpText = errorHelpText;
    }

    return (
        <div className={containerClassName}>
            <DynamicInput
                type={type}
                onChange={onChange}
                name={name}
                className={className}
                {...props}
            />
            {children}
            <FormyError {...formyErrorProps} />
        </div>
    );
}
