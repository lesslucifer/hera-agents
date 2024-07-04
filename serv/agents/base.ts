import _ from "lodash"
import ENV from "../../glob/env"
import { IAIModel, IAIModelDynamicPrompt, IAIModelGenerationRequest, IAIModelGenerationRequestCustomConfig, IAIModelOutput, IAIModelPrompt, IAIModelUsage, IAIToolDeclaration, emptyAIModelUsage, mkPrompt } from "../models/base"
import { GeminiModel } from "../models/gemini"
import { AIAgentHelper } from "./helper"

export type IAIAgentResponse = IAIModelPrompt

export type IAIAgentInputPrompt = IAIModelDynamicPrompt // TODO: input prompt path

export interface IAIAgentModelRequestHistoryEntry {
}

export interface IAIAgentRecord {
    id: number
    tags: string[]
    agentName?: string
    summary?: string
    embeeding?: number[]
    inputPrompts: IAIAgentInputPrompt[],
    outputPrompt: IAIModelPrompt,
    usage: IAIModelUsage
}

export class AIAgentContext {
    model: IAIModel
    history: IAIAgentRecord[] = []
    totalUsage: IAIModelUsage = emptyAIModelUsage()

    constructor() {
        this.model = new GeminiModel(ENV.GEMINI_KEY, 'gemini-1.5-flash-latest')
    }

    addUserPrompt(prompt: IAIModelDynamicPrompt) {
        const record: IAIAgentRecord = {
            id: this.history.length,
            tags: ["user"],
            inputPrompts: [],
            outputPrompt: { ...mkPrompt(prompt), role: 'user' },
            usage: emptyAIModelUsage()
        }
        this.history.push(record)
        return record
    }

    addAgentRecord(agentName: string, tags: string[], inputPrompts: IAIAgentInputPrompt[], outputPrompt: IAIModelPrompt, usage: IAIModelUsage) {
        const record: IAIAgentRecord = {
            id: this.history.length,
            tags,
            agentName: agentName,
            inputPrompts,
            outputPrompt,
            usage
        }
        this.history.push(record)
        this.totalUsage.inputToken += usage.inputToken
        this.totalUsage.outputToken += usage.outputToken
        this.totalUsage.totalToken += usage.totalToken
        return record
    }

    async execute(
        inputPrompts: IAIAgentInputPrompt[],
        sysInstruction?: string,
        tools?: IAIToolDeclaration[],
        customConfig?: IAIModelGenerationRequestCustomConfig
    ): Promise<IAIModelOutput> {
        const processedPrompts = inputPrompts

        const request: IAIModelGenerationRequest = {
            prompts: processedPrompts,
            sysInstruction,
            tools,
            customConfig
        };

        const response = await this.model.generate(request);
        return response;
    }

    get conversationPrompts() {
        return this.history.flatMap(r => r.outputPrompt)
    }

    get lastOutputPrompt() {
        return _.last(this.history)?.outputPrompt
    }

    clone(): AIAgentContext {
        const clonedContext = new AIAgentContext();
        
        // Clone the model
        clonedContext.model = this.model

        // Clone the history
        clonedContext.history = [...this.history]
        clonedContext.totalUsage = { ...this.totalUsage };

        return clonedContext;
    }
}

export interface IAIAgent {
    readonly name: string
    readonly description: string
    readonly shortDescription?: string

    run(ctx: AIAgentContext, request?: IAIModelDynamicPrompt): Promise<IAIAgentResponse>
}