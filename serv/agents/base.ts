import _ from "lodash"
import { nanoid } from "nanoid"
import ENV from "../../glob/env"
import { IAIModel, IAIModelDynamicPrompt, IAIModelGenerationRequestCustomConfig, IAIModelPrompt, IAIModelUsage, IAIToolDeclaration, emptyAIModelUsage, emptyPrompt, mkPrompt } from "../models/base"
import { GeminiModel } from "../models/gemini"
import { IAITool } from "../tools"
import { AIAgentHelper } from "./helper"

export type IAIAgentResponse = IAIModelPrompt

export type IAIAgentInputPrompt = IAIModelDynamicPrompt // TODO: input prompt path

export enum AIAgentRecordType {
    MODEL_REQUEST = 'MODEL_REQUEST',
    AGENT_REQUEST = 'AGENT_REQUEST',
    AGENT_RESPONSE = 'AGENT_RESPONSE',
}

export interface IAIAgentGenerationRecord {
    id: string
    tree: string[]

    owner?: string

    inputPrompts: IAIAgentInputPrompt[]
    outputPrompt: IAIModelPrompt

    usage: IAIModelUsage
    embeeding?: number[]

    requestTime?: number
    outputTime?: number

    metadata?: {
        model?: string
    }
}

export interface IAIAgentRecord {
    id: string
    tree: string[]

    tags: string[]

    description?: string
    agent?: string

    prompt: IAIModelPrompt

    embeeding?: number[]

    generationIds: string[]
    time: number
}

export class AIAgentContext {
    model: IAIModel
    activeAgents: IAIAgent[]
    agentRecords: IAIAgentRecord[] = []
    generations: IAIAgentGenerationRecord[] = []
    totalUsage: IAIModelUsage = emptyAIModelUsage()

    constructor() {
        this.model = new GeminiModel(ENV.GEMINI_KEY, 'gemini-1.5-flash-latest')
    }

    addActiveAgent(agent: IAIAgent) {
        if (!agent) return

        const dupAgent = this.activeAgents.find(ag => ag.name === agent.name)
        if (dupAgent && dupAgent !== agent) {
            throw new Error(`FATAL: Duplicated agent! There are two agent with name: ${agent.name}`)
        }

        if (!dupAgent) {
            this.activeAgents.push(agent)
        }
    }

    async generate(inputPrompts: IAIAgentInputPrompt[],
        sysInstruction?: string,
        tools: IAIToolDeclaration[] = [],
        tree: string[] = [],
        ownerName: string = '',
        customConfig?: IAIModelGenerationRequestCustomConfig
    ) {
        const reqTime = Date.now()
        const output = await this.model.generate({
            prompts: inputPrompts,
            sysInstruction: sysInstruction,
            tools: tools,
            customConfig: customConfig
        })

        const genId = nanoid()
        const gen = {
            id: genId,
            tree: [...tree, genId],
            owner: ownerName,

            inputPrompts,
            outputPrompt: output.prompt,
            usage: output.usage,
            
            requestTime: reqTime,
            outputTime: Date.now(),

            metadata: {
                model: this.model.description
            }
        }
        this.generations.push(gen)
        AIAgentHelper.accumulateUsage(this.totalUsage, output.usage)

        return gen
    }

    get conversation() {
        return this.agentRecords.map(r => AIAgentHelper.extendPrompt(r.prompt, [`${r.agent}: ${r.description}`]))
    }

    get lastPrompt() {
        return _.last(this.agentRecords)?.prompt
    }
}

export class AIAgentSession {
    id: string
    tree: string[]

    constructor(public ctx: AIAgentContext,
        public agent?: IAIAgent,
        public parent?: AIAgentSession) {
            this.id = nanoid()
            this.tree = [...(this.parent?.tree ?? []), this.id]
            ctx.addActiveAgent(agent)
    }

    async generate(
        ...inputPrompts: IAIAgentInputPrompt[]
    ) {
        return await this.ctx.generate(inputPrompts,
            this.agent?.systemInstruction,
            this.agent?.tools,
            this.tree,
            this.agent?.name,
            this.agent?.customConfig
        )
    }

    async runAgent(agent: IAIAgent, requestString?: string) {
        this.addAgentRecord(emptyPrompt(), `request to ${agent.name}: ${requestString ?? 'continue to proceed'}`, [], ["run_agent"])
        return await agent.run(new AIAgentSession(this.ctx, agent, this))
    }
    
    addAgentRecord(prompt: IAIModelDynamicPrompt, description?: string, genIds?: string[], tags?: string[]) {
        const id = nanoid()
        const record = {
            id,
            tree: [...this.tree, id],
            tags: tags ?? this.agent?.outputTags ?? [],
            description,
            agent: this.agent?.name,
            prompt: mkPrompt(prompt),
            generationIds: genIds ?? [],
            time: Date.now()
        }
        this.ctx.agentRecords.push(record)
        return record
    }
}

export interface IAIAgent {
    readonly name: string
    readonly description: string
    readonly shortDescription?: string

    readonly tools?: IAITool[]
    readonly systemInstruction?: string
    readonly customConfig?: IAIModelGenerationRequestCustomConfig
    readonly outputTags?: string[]

    run(sess: AIAgentSession): Promise<IAIAgentResponse>
}