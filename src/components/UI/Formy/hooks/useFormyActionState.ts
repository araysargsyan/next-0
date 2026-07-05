"use client";

import { useActionState, useState, useCallback, type Dispatch, type SetStateAction } from "react";
import type { FormyActionState } from "../types";

export function useFormyActionState<State extends FormyActionState>(
    action: string | ((state: Awaited<State> | null, payload: FormData) => State | Promise<State>) | undefined,
    initialState: Awaited<State> | null
): [
    state: State | null,
    dispatch: string | undefined | ((payload: FormData) => void),
    isPending: boolean | null,
    setState: Dispatch<SetStateAction<State | null>>
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

    const [state, setState] = useState<State | null>(initialState);

    const wrappedAction = useCallback(async (prevState: Awaited<State> | null, payload: FormData) => {
        if (typeof action === "function") {
            const result = action(prevState, payload);
            const res = await result;
            setState(res);
            return res;
        }
        return prevState;
    }, [action]);

    if (isFunction) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [_, dispatch, isPending] = useActionState(wrappedAction, initialState);
        return [state, dispatch, isPending, setState];
    } else {
        return [state, action, null, setState];
    }
}
