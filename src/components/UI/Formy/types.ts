import { ReactNode, ComponentProps } from "react";
import { useRouter } from "next/navigation";

export type FormyActionState =
    | { success: boolean; error?: string | Record<string, string> | null }
    | { success: boolean; data?: unknown };

export type StrictFormyState<T> = {
    [K in keyof T]: K extends "error" | "success" | "data" ? T[K] : never
};

export interface FormyProps<State extends FormyActionState & StrictFormyState<State> = FormyActionState> 
    extends Omit<ComponentProps<"form">, "children" | "action"> {
    action?: string | ((state: Awaited<State> | null, payload: FormData) => State | Promise<State>);
    initialState?: Awaited<State> | null;
    children?: ReactNode | ((state: Awaited<State> | null, isPending: boolean) => ReactNode);
    onStateChange?: (state: Awaited<State> | null, router: ReturnType<typeof useRouter>) => void;
    submitLabel?: string;
    loadingLabel?: string;
}
