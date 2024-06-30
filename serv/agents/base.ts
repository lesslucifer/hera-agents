import { IAIModel, IAIModelPrompt, IAIModelPromptPart } from "../models/base"

export type IAIAgentResponse = IAIModelPrompt

export interface IAIAgentRecord {
    id: string
    type: 'user' | 'model' | 'tool_call' | 'tool_response'
    agentName?: string
    tags: string[]
    prompt: IAIModelPrompt
    summary?: string
    embeeding?: number[]
}

export interface IAIAgentContext {
    model: IAIModel
    history: IAIAgentRecord[]
}

export interface IAIAgent {
    readonly name: string
    readonly description: string
    readonly shortDescription?: string

    run(ctx: IAIAgentContext): Promise<IAIAgentResponse>
}