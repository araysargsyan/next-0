import type {ReactNode, ComponentProps, RefObject} from "react";
import Form from "next/form";

export type FormyActionState =
    | { error: string | Record<string, string> | null }
    | { data: unknown };

export interface FormyProps<State extends FormyActionState = FormyActionState>
    extends Omit<ComponentProps<typeof Form>, "children" | "action"> {
    action?: string | ((state: Awaited<State> | null, payload: FormData) => State | Promise<State>);
    initialState?: Awaited<State> | null;
    children?: ReactNode | ((state: State | null, isPending: boolean) => ReactNode);
    onStateChange?: (state: State | null) => void;
    clearOnSuccess?: boolean;
    plainMode?: boolean;
}

export interface FormyStoreSlice {
    forms: Record<string, Record<string, string>>;
    setFormValue: (formId: string, name: string, value: string) => void;
    clearForm: (formId: string) => void;
}

export interface FormyPersistAdapter {
    getValues: () => Record<string, string> | void;
    setValue: (name: string, value: string) => void;
    clear: () => void;
}
export type FormyPersistHook = (formId: string) => FormyPersistAdapter;

export type GetStateFn<Store extends FormyStoreSlice = FormyStoreSlice> = () => Store;

export type OnActionChangeFn = (
    state: FormyActionState | null,
    isPending: boolean,
    clearOnSuccess: boolean
) => void;

export interface FormyCoreProps extends Omit<
    FormyProps,
    'children' | 'action' | 'initialState' | 'onStateChange' | 'clearOnSuccess' | 'onLoad'
> {
    children: ReactNode;
    clearFieldError: (name: string) => void;
    formAction: ComponentProps<typeof Form>['action'] | undefined;
    setValue: (name: string, value: string) => void;
    validatorsRef: RefObject<Record<string, {
        validate: (value: string) => string | null;
        setError: (error: string | null) => void;
    }>>;
    formRef: RefObject<HTMLFormElement | null>;
    persist: FormyPersistAdapter;
    onActionChangeRef: RefObject<OnActionChangeFn | null>;
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
