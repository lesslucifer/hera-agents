import { Conversation } from "../models";
import { AIAgentSession, IAIAgent } from './agents/base';
import { FactualKnowledgeAgent } from './agents/FactualKnowledgeAgent';
import { JiraAgent } from './agents/JiraAgent';
import { ManagerAIAgent } from './agents/manager-agent';
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
        const sess = new AIAgentSession()
        const res = await sess.runAgent(this.mainAgent, [`This is the user query: ${question}`])

        const ins = await Conversation.insertOne({
            question: question,
            activeAgents: sess.activeAgents.map(agent => ({
                name: agent.name,
                description: agent.description,
                shortDescription: agent.shortDescription
            })),
            queryRecords: [...sess.QueryHistory],
            operationRecords: [...sess.OperationRecords],
            answer: res,
            usage: sess.totalUsage,
        })
        return {
            id: ins.insertedId,
            ...res
        }
    }
}

export const Agent = new AIAgentService()