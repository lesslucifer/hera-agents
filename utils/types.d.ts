type Exact<T, Shape = T> = T & {
    [K in keyof T]: K extends keyof Shape ? T[K] : never
};

interface StrictInterface {
    field1: string;
    field2: number;
}

type StrictType = Exact<StrictInterface, StrictInterface>;