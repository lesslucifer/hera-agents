import { Content } from "@google/generative-ai"

export interface ITool<Arguments extends Array<any> = any[]> {
    readonly name: string
    readonly description: any
    apply(...args: Arguments): Promise<Content>
}