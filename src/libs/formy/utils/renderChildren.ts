import {FormyActionState, FormyProps} from "../types";

export function renderChildren(
    children: FormyProps['children'],
    state: Awaited<FormyActionState>,
    isPending: boolean
) {
    return typeof children === "function" ? children(state, isPending) : children
}
