type DeepRequired<T> = T extends object
    ? Required<{
        [K in keyof T]: DeepRequired<NonNullable<T[K]>>;
    }>
    : T;
