import { IAIModel, IAIModelPrompt } from "../models/base"

export type IAIAgentResponse = IAIModelPrompt

export interface IAIAgentContext {
    model: IAIModel
}

export interface IAIAgent {
    readonly name: string
    readonly description: string
    readonly shortDescription?: string

    run(ctx: IAIAgentContext): Promise<IAIAgentResponse>
}