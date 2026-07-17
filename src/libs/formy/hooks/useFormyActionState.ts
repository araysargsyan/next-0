"use client";

import {useActionState, useState, type ComponentProps} from "react";
import type {FormyAction, FormyActionState} from "../types";
import Form from "next/form";

export function useFormyActionState(
    action: string | undefined | FormyAction,
    initialState: Awaited<FormyActionState>,
): [
    state: Awaited<FormyActionState>,
    dispatch: ComponentProps<typeof Form>['action'] | null,
    isPending: boolean
] {
    const isFunction = typeof action === "function";
    const [initialIsFunction] = useState(isFunction);

    if (initialIsFunction !== isFunction) {
        throw new Error(
            `Formy: The action prop type cannot be changed dynamically from ${
                initialIsFunction ? "a function" : "a string/undefined"
            } to ${isFunction ? "a function" : "a string/undefined"} during the lifecycle of the component.`
        );
    }

    if (typeof action === "function") {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [state, dispatch, isPending] = useActionState(action, initialState);
        return [state, dispatch, isPending];
    } else {
        return [initialState, action ?? null, false];
    }
}
