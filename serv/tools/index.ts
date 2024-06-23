import { Content } from "@google/generative-ai"

export interface ITool<Arg extends object = object> {
    readonly name: string
    readonly description: any
    apply(arg: Arg): Promise<Content>
}