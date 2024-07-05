import { Content } from "@google/generative-ai"
import { IAIModelPrompt, IAIModelUsage } from "../serv/models/base"
import { IAIAgentRecord } from "../serv/agents/base"

export interface IConversation {
    question: string
    history: IAIAgentRecord[]
    answer: IAIModelPrompt
    usage?: IAIModelUsage
}