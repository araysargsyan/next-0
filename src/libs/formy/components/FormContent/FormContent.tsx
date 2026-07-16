import {useRef, useLayoutEffect, useCallback} from "react";
import type {FormContentProps} from "../../types";
import {runFormValidation} from "../../utils/validation";
import {FormElement} from "./FormElement";
import {FieldsetBarrier} from "./FieldsetBarrier";
import {createLogger} from "@/libs/utils/logger";


const log = createLogger("FormContent", "cyan");
export function FormContent({
    validators,
    action,
    staticMode,
    children,
    onSubmit,
    ...props
}: FormContentProps) {
    useLayoutEffect(() => {
        log(`[${props.id ?? "anonymous"}] 🔄 render`);
    });

    const fieldsetRef = useRef<HTMLFieldSetElement>(null);
    const formRef = useRef<HTMLFormElement>(null);

    const handleSubmit = useCallback<
        Exclude<FormContentProps["onSubmit"], undefined>
    >((e) => {
        if (formRef.current) {
            const formData = new FormData(formRef.current);
            const hasErrors = runFormValidation(validators.current, (name) => {
                const val = formData.get(name);
                return typeof val === "string" ? val : "";
            });

            if (hasErrors) {
                log(`[${props.id ?? "anonymous"}] client validation failed`);
                e.preventDefault();
                return;
            }
        }
        onSubmit?.(e);
    }, [onSubmit, props.id, validators]);

    return (
        <FieldsetBarrier fieldsetRef={fieldsetRef} active={staticMode}>
            <FormElement
                formRef={formRef}
                action={action}
                staticMode={staticMode}
                onSubmit={handleSubmit}
                {...props}
            >
                {children}
            </FormElement>
        </FieldsetBarrier>
    );
}
