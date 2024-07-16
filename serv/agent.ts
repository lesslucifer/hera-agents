import { Chat } from "../models";
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

    async ask(chatId: string, question: string) {
        const sess = new AIAgentSession(chatId)
        const res = await sess.runAgent(this.mainAgent, [`This is the user query: ${question}`])
        return await sess.persistToChatMessage(res)
    }
}

export const Agent = new AIAgentService()