"use client";

import {useActionState, useState, ComponentProps} from "react";
import type { FormyActionState } from "../types";
import Form from "next/form";

export function useFormyActionState<State extends FormyActionState = FormyActionState>(
    action: string | ((state: Awaited<State> | null, payload: FormData) => State | Promise<State>) | undefined,
    initialState: Awaited<State> | null
): [
    state: Awaited<State> | null,
    dispatch: ComponentProps<typeof Form>['action'] | undefined,
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
        const actionStr = typeof action === "string" ? action : undefined;
        return [initialState, actionStr, false];
    }
}
