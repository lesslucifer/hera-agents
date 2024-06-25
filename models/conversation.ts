import { Content } from "@google/generative-ai"

export interface IConversation {
    question: string
    history: Content[]
    answer: Content
}