import { IAIAgentDeclaration, IAIAgentQueryRecord, IAIOperationRecord } from "../serv/agents/base"
import { IAIModelPrompt, IAIModelUsage } from "../serv/models/base"

export interface IConversation {
    question: string
    activeAgents: IAIAgentDeclaration[]
    queryRecords: IAIAgentQueryRecord[]
    operationRecords: IAIOperationRecord[]
    answer: IAIModelPrompt
    usage?: IAIModelUsage
}