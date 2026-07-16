"use client";

import dynamic from "next/dynamic";
import Form from "next/form";
import {memo} from "react";
import {FormElementProps} from "../../types";

const FormyRestoreEngine = memo(
    dynamic(() => import("../FormyRestoreEngine"))
);

export function FormElement({
    formRef,
    action,
    staticMode,
    children,
    onSubmit,
    ...props
}: FormElementProps) {
    return action ? (
        <Form ref={formRef} action={action} {...props} onSubmit={onSubmit}>
            {children}
            {staticMode && <FormyRestoreEngine formRef={formRef}/>}
        </Form>
    ) : (
        <form ref={formRef} {...props} onSubmit={onSubmit}>
            {children}
            {staticMode && <FormyRestoreEngine formRef={formRef}/>}
        </form>
    );
}
