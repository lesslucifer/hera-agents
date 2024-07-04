import { Content } from "@google/generative-ai"
import { IAIModelPrompt } from "../serv/models/base"

export interface IConversation {
    question: string
    history: IAIModelPrompt[]
    answer: IAIModelPrompt
}