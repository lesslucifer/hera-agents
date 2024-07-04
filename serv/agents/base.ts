import _ from "lodash"
import ENV from "../../glob/env"
import { AIModelUsageEmpty, IAIModel, IAIModelDynamicPrompt, IAIModelGenerationRequest, IAIModelGenerationRequestCustomConfig, IAIModelOutput, IAIModelPrompt, IAIModelUsage, IAIToolDeclaration, mkPrompt } from "../models/base"
import { GeminiModel } from "../models/gemini"
import { AIAgentHelper } from "./helper"

export type IAIAgentResponse = IAIModelPrompt

export type IAIAgentInputPrompt = IAIModelDynamicPrompt // TODO: input prompt path

export interface IAIAgentModelRequestHistoryEntry {
    inputPrompts: IAIAgentInputPrompt[],
    outputPrompt: IAIModelPrompt,
    usage: IAIModelUsage
}

export interface IAIAgentRecord {
    id: number
    agentName?: string
    history: IAIAgentModelRequestHistoryEntry[]
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

    addUserPrompt(prompt: IAIModelDynamicPrompt) {
        const record: IAIAgentRecord = {
            id: this.history.length,
            history: [{
                inputPrompts: [],
                outputPrompt: { ...mkPrompt(prompt), role: 'user' },
                usage: AIModelUsageEmpty
            }],
            summary: [],
            usage: AIModelUsageEmpty
        }
        this.history.push(record)
        return record
    }

    addAgentRecord(agent: IAIAgent, history: IAIAgentModelRequestHistoryEntry[]) {
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

    session(agent: IAIAgent, input: IAIAgentInputPrompt[]) {
        return new AIAgentContextSession(this, agent, input)
    }

    get conversationPrompts() {
        return this.history.flatMap(h => h.history.map(h => h.outputPrompt))
    }
}

export class AIAgentContextSession {
    private context: AIAgentContext;
    private inputPrompts: IAIAgentInputPrompt[]
    private history: IAIAgentModelRequestHistoryEntry[] = [];
    private lastOutput: IAIModelPrompt = null

    constructor(context: AIAgentContext, private agent: IAIAgent, private orignalInput: IAIAgentInputPrompt[]) {
        this.context = context;
        this.inputPrompts = [...orignalInput]
    }

    async execute(
        prompt: IAIModelDynamicPrompt,
        sysInstruction?: string,
        tools?: IAIToolDeclaration[],
        customConfig?: IAIModelGenerationRequestCustomConfig
    ): Promise<IAIModelPrompt> {
        const inputPrompts = [
            ...this.inputPrompts,
            ...this.history.map(h => h.outputPrompt),
            prompt
        ]
        const response = await this.context.execute(inputPrompts, sysInstruction, tools, customConfig);

        const historyEntry: IAIAgentModelRequestHistoryEntry = {
            inputPrompts: inputPrompts,
            outputPrompt: response.prompt,
            usage: response.usage ?? AIModelUsageEmpty
        };
        this.history.push(historyEntry);

        this.lastOutput = response.prompt
        return response.prompt;
    }

    end() {
        this.context.addAgentRecord(this.agent, this.history)
        return this.lastOutput
    }
}

export interface IAIAgent {
    readonly name: string
    readonly description: string
    readonly shortDescription?: string

    run(ctx: AIAgentContext): Promise<IAIAgentResponse>
}