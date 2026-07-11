type DeepRequired<T> = T extends object
    ? Required<{
        [K in keyof T]: DeepRequired<NonNullable<T[K]>>;
    }>
    : T;
type InferGuardedType<G> = G extends (value: unknown) => value is infer T ? T : never;
