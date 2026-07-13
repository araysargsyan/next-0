import type {ReactNode, ComponentProps} from "react";
import Form from "next/form";

export type FormyActionState = { error: string | Record<string, string> | null }
    | { data: unknown }
    | void | null;

export type FormyAction<State extends FormyActionState = FormyActionState> =
    ((state: Awaited<State>, payload: FormData) => State | Promise<State>)

export interface FormyProps<State extends FormyActionState = FormyActionState>
    extends Omit<ComponentProps<typeof Form>, "children" | "action"> {
    action?: string | FormyAction<State>;
    initialState?: Awaited<State> | null;
    children?: ReactNode | ((state: Awaited<State>, isPending: boolean) => ReactNode);
    onStateChange?: (state: Awaited<State>) => void;
    clearOnSuccess?: boolean;
    plainMode?: boolean;
}

type FormyErrorBaseProps = {
    field?: string;
    below?: boolean;
    absolute?: boolean;
    validate?: (value: string) => string | null;
};
export type FormyErrorProps = FormyErrorBaseProps & (
    | { helpText?: string; parseMessage?: never }
    | { helpText?: never, parseMessage?: (message: string) => { title: string; info?: string } }
);

export interface FormyInputProps extends ComponentProps<"input"> {
    children?: ReactNode;
    validate?: (value: string) => string | null;
    errorBelow?: boolean;
    errorAbsolute?: boolean;
    errorHelpText?: string;
    errorParseMessage?: (message: string) => { title: string; info?: string };
    containerClassName?: string;
}

export type Validators = Record<string, {
    validate: (value: string) => string | null;
    setError: (error: string | null) => void;
}>
