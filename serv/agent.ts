import * as YAML from 'json-to-pretty-yaml';
import ENV from "../glob/env";
import { Conversation } from "../models";
import { IAIModel, IAIModelPrompt } from "./models/base";
import { GeminiModel } from "./models/gemini";
import { IAITool } from "./tools";
import { GetJiraIssuesTool } from "./tools/get_jira_issues";
import { GetTicketByDescription } from "./tools/get_similar_issues";
import { AIAgentContext, IAIAgent } from './agents/base';
import { ManagerAIAgent } from './agents/manager-agent';
import { JiraAgent } from './agents/JiraAgent';
import { FactualKnowledgeAgent } from './agents/FactualKnowledgeAgent';
import { SummaryAIAgent } from './agents/summary-agent';

class AIAgentService {
    mainAgent: IAIAgent

    constructor() {
        this.mainAgent = new ManagerAIAgent([
            new JiraAgent(),
            new FactualKnowledgeAgent(),
            new SummaryAIAgent()
        ])
    }

    async ask(question: string) {
        const ctx = new AIAgentContext()
        ctx.addUserPrompt(`This is the user Query: ${question}`)
        const res = await this.mainAgent.run(ctx)
        const ins = await Conversation.insertOne({
            question: question,
            history: ctx.history,
            answer: res,
            usage: ctx.totalUsage,
        })
        return {
            id: ins.insertedId,
            ...res
        }
    }
}

export const Agent = new AIAgentService()