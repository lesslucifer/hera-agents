import { IAIAgentDeclaration } from "../serv/agents/base"
import { IAIModelPrompt, IAIModelUsage } from "../serv/models/base"

export interface IChat {
    id: string
    totalUsage: IAIModelUsage
}

export interface IChatMessage {
    chatId: string
    id: string
    content: IAIModelPrompt
    time: number

    activeAgents?: IAIAgentDeclaration[]
    usage?: IAIModelUsage
}