import { useActionState, useState } from "react";
import type { FormyActionState } from "./types";

export function useFormyActionState<State extends FormyActionState>(
    action: string | ((state: Awaited<State> | null, payload: FormData) => State | Promise<State>) | undefined,
    initialState: Awaited<State> | null
): [
    state: Awaited<State> | null,
    dispatch: string | undefined | ((payload: FormData) => void),
    isPending: boolean | null
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
        return useActionState(action, initialState);
    } else {
        return [null, action, null];
    }
}
