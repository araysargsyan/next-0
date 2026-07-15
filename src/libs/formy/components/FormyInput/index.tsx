import type { FormyInputProps } from "../../types";
import { DynamicInput } from "./DynamicInput";

export function FormyInput({
    type,
    onChange,
    ...props
}: FormyInputProps) {
    return (
        <DynamicInput type={type} onChange={onChange}>
            <input type={type} onChange={onChange} {...props} />
        </DynamicInput>
    );
}
