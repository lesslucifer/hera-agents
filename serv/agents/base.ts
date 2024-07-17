import _ from "lodash"
import { nanoid } from "nanoid"
import ENV from "../../glob/env"
import { IAIModel, IAIModelDynamicPrompt, IAIModelGenerationRequestCustomConfig, IAIModelPrompt, IAIModelUsage, IAIToolDeclaration, emptyAIModelUsage, emptyPrompt, mkPrompt } from "../models/base"
import { GeminiModel } from "../models/gemini"
import { IAITool } from "../tools"
import { AIAgentHelper } from "./helper"
import * as YAML from 'json-to-pretty-yaml';
import { AgentQuery, Chat, ChatMessage, OpRecord } from "../../models"
import { IChatMessage } from "../../models/chat"

export type IAIAgentResponse = IAIModelPrompt

export type IAIAgentInputPrompt = IAIModelDynamicPrompt // TODO: input prompt path

export interface IAIAgentQueryRecord {
    id: string
    tree: string[]

    trigger?: string

    inputPrompts: IAIAgentInputPrompt[]
    outputPrompt: IAIModelPrompt

    usage: IAIModelUsage
    embeeding?: number[]

    metadata?: {
        model?: string,
        requestTime?: number,
        outputTime?: number,
        duration?: number
    }
}

export interface IAIOperationRecord {
    id: string
    tree: string[]

    tags: string[]

    description?: string
    agent?: string

    prompt: IAIModelPrompt

    embeeding?: number[]
    queryIds: string[]

    time: number
}

export interface IAIAgentContextGenerateOptions {
    sysInstruction?: string,
    tools?: IAIToolDeclaration[]
    tree?: string[]
    trigger?: string
    customConfig?: IAIModelGenerationRequestCustomConfig
    parentTree?: string[]
}

export class AIAgentSession {
    readonly chatId: string
    readonly id: string
    readonly model: IAIModel
    readonly activeAgents: Exact<IAIAgentDeclaration>[] = []
    readonly totalUsage: IAIModelUsage = emptyAIModelUsage()
    private conversationMessages: IChatMessage[]

    constructor(chatId: string) {
        this.chatId = chatId
        this.id = nanoid()
        this.model = new GeminiModel(ENV.GEMINI_KEY, 'gemini-1.5-flash-latest')
    }

    addActiveAgent(agent: IAIAgent) {
        if (!agent) return

        const dupAgent = this.activeAgents.find(ag => ag.name === agent.name)
        if (dupAgent && dupAgent !== agent) {
            throw new Error(`FATAL: Duplicated agent! There are two agent with name: ${agent.name}`)
        }

        if (!dupAgent) {
            this.activeAgents.push({
                name: agent.name,
                description: agent.description,
                shortDescription: agent.shortDescription
            })
        }
    }

    async addOperationRecord(prompt: IAIModelPrompt,
        parentTree?: string[],
        agentName?: string,
        description?: string,
        queryIds?: string[],
        tags?: string[],
        time?: number) {
        const id = nanoid()
        const record: IAIOperationRecord = {
            id,
            tree: [...(parentTree ?? []), id],
            tags: tags ?? [],
            description,
            agent: agentName,
            prompt: prompt,
            queryIds: queryIds ?? [],
            time: time ?? Date.now()
        }

        await OpRecord.insertOne(record)
        return record
    }

    async conversationMessagePrompts(): Promise<IAIModelPrompt[]> {
        if (!this.conversationMessages) {
            this.conversationMessages = await ChatMessage.find({ chatId: this.chatId }).toArray()
        }

        if (!this.conversationMessages?.length) return []

        return [
            mkPrompt(`Next is THE PREVIOUS CONVERSATION between user and the system`),
            ...this.conversationMessages.map(msg => msg.content),
            mkPrompt(`END OF THE PREVIOUS CONVERSATION. Next will be information of the current process`),
        ]
    }

    async generate(
        inputPrompts: IAIAgentInputPrompt[],
        opts?: IAIAgentContextGenerateOptions
    ) {
        const reqTime = Date.now()

        const conversationPrompts = [...await this.conversationMessagePrompts(), ...inputPrompts]

        console.log(`[Query]`, opts?.trigger, conversationPrompts.map(p => YAML.stringify(p)).join('\n---------\n'))
        const output = await this.model.generate({
            prompts: conversationPrompts,
            sysInstruction: opts?.sysInstruction,
            tools: opts?.tools,
            customConfig: opts?.customConfig
        })

        const genId = nanoid()
        const outputTime = Date.now()
        const queryRecord: IAIAgentQueryRecord = {
            id: genId,
            tree: [...(opts.parentTree ?? []), genId],
            trigger: opts?.trigger ?? '',

            inputPrompts: [...conversationPrompts],
            outputPrompt: { role: output.prompt.role, parts: AIAgentHelper.uniqJsonDeep(output.prompt.parts) },
            usage: output.usage,

            metadata: {
                model: this.model.description,
                requestTime: reqTime,
                outputTime: outputTime,
                duration: outputTime - reqTime
            }
        }

        await AgentQuery.insertOne(queryRecord)
        AIAgentHelper.accumulateUsage(this.totalUsage, output.usage)

        return queryRecord
    }

    newContext(agent: IAIAgent, parent?: AIAgentContext) {
        return new AIAgentContext(this, agent, parent)
    }

    runAgent(agent: IAIAgent, inputs: IAIAgentInputPrompt[]) {
        return agent.run(inputs, this.newContext(agent))
    }

    async persistToChatMessage(content: IAIModelPrompt) {
        const res = await ChatMessage.updateOne({ id: this.id }, {
            $set: {
                chatId: this.chatId,
                id: this.id,
                content,
                time: Date.now(),
                activeAgents: this.activeAgents,
                usage: this.totalUsage,
            }
        }, { upsert: true })

        return await ChatMessage.findOne({ id: this.id })
    }
}

export class AIAgentContext {
    id: string
    tree: string[]

    constructor(public sess: AIAgentSession,
        public agent?: IAIAgent,
        public parent?: AIAgentContext) {
        this.id = nanoid()
        this.tree = [...(this.parent?.tree ?? [sess.id]), this.id]
        sess.addActiveAgent(agent)
    }

    async query(inputPrompts: IAIAgentInputPrompt[]) {
        return await this.sess.generate(inputPrompts, {
            trigger: this?.agent?.name,
            sysInstruction: this.agent?.systemInstruction,
            tools: this.agent?.tools,
            customConfig: this.agent?.customQueryConfig,
            parentTree: this.tree
        })
    }

    async runAgent(agent: IAIAgent, input?: IAIAgentInputPrompt[], runDesc?: string) {
        this.addOpRecord(emptyPrompt(), `request to ${agent.name}: ${runDesc ?? 'continue to proceed'}`, [], ["run_agent"])
        return await agent.run(input ?? [], new AIAgentContext(this.sess, agent, this))
    }

    addOpRecord(prompt: IAIModelDynamicPrompt, description?: string, queryIds?: string[], tags?: string[]) {
        return this.sess.addOperationRecord(mkPrompt(prompt), this.tree, this.agent.name, description, queryIds, tags ?? this.agent.outputTags)
    }
}

export interface IAIAgentDeclaration {
    readonly name: string
    readonly description: string
    readonly shortDescription?: string
}

export interface IAIAgent extends IAIAgentDeclaration {
    readonly tools?: IAITool[]
    readonly systemInstruction?: string
    readonly customQueryConfig?: IAIModelGenerationRequestCustomConfig
    readonly outputTags?: string[]

    run(inputs: IAIAgentInputPrompt[], ctx: AIAgentContext): Promise<IAIAgentResponse>
}