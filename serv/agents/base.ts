import _ from "lodash"
import ENV from "../../glob/env"
import { IAIModel, IAIModelDynamicPrompt, IAIModelGenerationRequest, IAIModelGenerationRequestCustomConfig, IAIModelOutputPrompt, IAIModelPrompt, IAIModelUsage, IAIToolDeclaration, mkPrompt } from "../models/base"
import { GeminiModel } from "../models/gemini"
import { AIAgentHelper } from "./helper"

export type IAIAgentResponse = IAIModelPrompt

export interface IAIAgentPromptPath {
    recordId: number
    isOutput: boolean
    index?: number
    summaryLevel?: number
}

export type IAIAgentInputPrompt = IAIModelDynamicPrompt | IAIAgentPromptPath

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
                usage: {
                    inputToken: 0,
                    outputToken: 0,
                    totalToken: 0,
                }
            }],
            summary: [],
            usage: {
                inputToken: 0,
                outputToken: 0,
                totalToken: 0,
            }
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

    agentToModelPrompt(prompt: IAIAgentInputPrompt, visitedPaths: Set<string> = new Set()): IAIModelPrompt {
        if (AIAgentHelper.isPromptPath(prompt)) {
            // Handle IAIAgentPromptPath
            const pathKey = `${prompt.recordId}-${prompt.isOutput}-${prompt.index}-${prompt.summaryLevel}`;
            if (visitedPaths.has(pathKey)) {
                throw new Error(`Circular reference detected: ${pathKey}`);
            }
            visitedPaths.add(pathKey);

            const record = _.get(this.history, prompt.recordId);
            if (!record) throw new Error(`Record with id ${prompt.recordId} not found`);

            if (prompt.summaryLevel !== undefined) {
                // Use summary if available
                if (record.summary && record.summary.length > 0) {
                    const summaryIndex = Math.min(prompt.summaryLevel, record.summary.length - 1);
                    return mkPrompt(record.summary[summaryIndex]);
                }
            }

            if (prompt.isOutput) {
                const historyIndex = prompt.index ?? record.history.length - 1;
                return record.history[historyIndex].outputPrompt;
            } else {
                const historyIndex = prompt.index ?? record.history.length - 1;
                const inputPrompt = record.history[historyIndex].inputPrompts[0];
                return this.agentToModelPrompt(inputPrompt, visitedPaths);
            }
        } else {
            return mkPrompt(prompt);
        }
    }

    async execute(
        agent: IAIAgent,
        inputPrompts: IAIAgentInputPrompt[],
        sysInstruction?: string,
        tools?: IAIToolDeclaration[],
        customConfig?: IAIModelGenerationRequestCustomConfig
    ): Promise<IAIModelOutputPrompt> {
        const processedPrompts = inputPrompts.map(p => this.agentToModelPrompt(p));

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
    private inputPrompts: IAIModelPrompt[]
    private history: IAIAgentModelRequestHistoryEntry[] = [];
    private lastOutput: IAIModelPrompt = null

    constructor(context: AIAgentContext, private agent: IAIAgent, private orignalInput: IAIAgentInputPrompt[]) {
        this.context = context;
        this.inputPrompts = orignalInput.map(p => context.agentToModelPrompt(p))
    }

    async execute(
        prompt: IAIModelDynamicPrompt,
        sysInstruction?: string,
        tools?: IAIToolDeclaration[],
        customConfig?: IAIModelGenerationRequestCustomConfig
    ): Promise<IAIModelOutputPrompt> {
        const actualInputPrompts = [
            ...this.inputPrompts,
            ...this.history.flatMap(h => [...h.inputPrompts, h.outputPrompt]),
            prompt
        ]
        const response = await this.context.execute(this.agent, actualInputPrompts, sysInstruction, tools, customConfig);

        const entryInputPrompts: IAIAgentInputPrompt[] = [
            ...this.orignalInput,
            ...this.history.flatMap(h => [...h.inputPrompts, h.outputPrompt]),
            prompt
        ]

        const historyEntry: IAIAgentModelRequestHistoryEntry = {
            inputPrompts: entryInputPrompts,
            outputPrompt: _.pick(response, 'role', 'parts'),
            usage: response.usage ?? { inputToken: 0, outputToken: 0, totalToken: 0 }
        };
        this.history.push(historyEntry);

        this.lastOutput = response
        return response;
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