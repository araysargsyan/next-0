import type {ReactNode, ComponentProps, CSSProperties, RefAttributes, ReactElement, InputHTMLAttributes} from "react";
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
    staticMode?: boolean;
}

type FormyErrorBaseProps = {
    field?: string;
    validate?: (value: string) => string | null;
    className?: string;
    style?: CSSProperties;
    children?: ReactNode | ((error: string | null, infoText?: string) => ReactNode);
};
export type FormyErrorProps = FormyErrorBaseProps & (
    | { helpText?: string; parseMessage?: never }
    | { helpText?: never, parseMessage?: (message: string) => { title: string; info?: string } }
);

export type FormyInputProps = ComponentProps<"input">;

export type Validators = Record<string, {
    validate: (value: string) => string | null;
    setError: (error: string | null) => void;
}>

export interface DynamicInputProps {
    children: ReactElement<
        InputHTMLAttributes<HTMLInputElement> & RefAttributes<HTMLInputElement>,
        'input'
    >,
    type: ComponentProps<"input">['type'],
    onChange: ComponentProps<"input">['onChange'],
}
