import {DynamicInput} from "./DynamicInput";
import type {FormyInputProps} from "../../types";


export function FormyInput({
    className = "",
    name,
    type,
    onChange,
    ...props
}: FormyInputProps) {
    return (
        <DynamicInput
            type={type}
            onChange={onChange}
            name={name}
            className={className}
            {...props}
        />
    );
}
