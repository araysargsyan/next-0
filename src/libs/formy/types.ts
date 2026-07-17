import type {
    ReactNode,
    ComponentProps,
    CSSProperties,
    RefAttributes,
    ReactElement,
    InputHTMLAttributes,
    RefObject
} from "react";
import Form from "next/form";

export type FormyActionState<T = unknown> = { error: string | Record<string, string> | null }
    | { data: T }
    | void | null;

export type FormyAction<T = unknown> =
    ((state: Awaited<FormyActionState<T>>, payload: FormData) => FormyActionState<T> | Promise<FormyActionState<T>>)

export interface FormyProps<State extends FormyActionState = FormyActionState>
    extends Omit<ComponentProps<typeof Form>, "children" | "action"> {
    action?: string | FormyAction;
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
}>;

export type FormContentProps = Omit<FormyProps, "action" | "children"> & {
    validators: RefObject<Validators>;
    staticMode: boolean;
    action: ComponentProps<typeof Form>["action"] | null;
    children: ReactNode;
};

export type FormyRestoreEngineProps = {
    formRef: RefObject<HTMLFormElement | null>;
};

export type FormElementProps = Omit<FormContentProps, "validators"> & {
    formRef: RefObject<HTMLFormElement | null>;
};

export type FieldsetBarrierProps = {
    fieldsetRef: RefObject<HTMLFieldSetElement | null>;
    active: boolean;
    children: ReactNode;
};

export interface DynamicInputProps {
    children: ReactElement<
        InputHTMLAttributes<HTMLInputElement> & RefAttributes<HTMLInputElement>,
        'input'
    >;
    type: ComponentProps<"input">['type'];
    onChange: ComponentProps<"input">['onChange'];
}
