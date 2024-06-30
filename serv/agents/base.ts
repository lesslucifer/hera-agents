import _ from "lodash"
import ENV from "../../glob/env"
import { IAIModel, IAIModelDynamicPrompt, IAIModelPrompt, IAIModelPromptPart, IAIModelUsage } from "../models/base"
import { GeminiModel } from "../models/gemini"

export type IAIAgentResponse = IAIModelPrompt

export interface IAIAgentPromptPath {
    recordId: number
    isOutput: boolean
    index?: number
    summaryLevel?: number
}

export type IAIAgentInputPrompt = IAIModelDynamicPrompt | IAIAgentPromptPath

export interface IAIAgentModelRequestHistory {
    inputPrompts: IAIAgentInputPrompt[],
    outputPrompt: IAIModelPrompt,
    usage: IAIModelUsage
}

export interface IAIAgentRecord {
    id: number
    agentName?: string
    history: IAIAgentModelRequestHistory[]
    summary: string[]
    embeeding?: number[]
    usage?: IAIModelUsage
}

export class AIAgentContext {
    model: IAIModel
    history: IAIAgentRecord[] = []

    constructor() {
        this.model = new GeminiModel(ENV.GEMINI_KEY, 'gemini-1.5-flash-latest')
    }

    addAgentRecord(agent: IAIAgent, history: IAIAgentModelRequestHistory[]) {
        const record: IAIAgentRecord = {
            id: this.history.length,
            agentName: agent.name,
            history,
            summary: [],
            usage: {
                inputToken: _.sum(history.map(h => h.usage.inputToken)),
                outputToken: _.sum(history.map(h => h.usage.outputToken)),
                totalToken: _.sum(history.map(h => h.usage.totalToken)),
            }
        }
        this.history.push(record)
        return record
    }
}

export interface IAIAgent {
    readonly name: string
    readonly description: string
    readonly shortDescription?: string

    run(ctx: AIAgentContext): Promise<IAIAgentResponse>
}