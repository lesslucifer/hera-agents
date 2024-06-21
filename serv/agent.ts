import { Content, GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";
import { ITool } from "./tools";
import { GetJiraIssuesTool } from "./tools/get_jira_issues";
import ENV from "../glob/env";
import { GetSimilarIssues } from "./tools/get_similar_issues";

class AIAgentService {
    _gemini: GenerativeModel

    get gemini() {
        return this._gemini ?? (
            this._gemini = new GoogleGenerativeAI(ENV.GEMINI_KEY).getGenerativeModel({
                model: "gemini-1.5-flash-latest",
                tools: this.tools.map(t => ({ functionDeclarations: [t.description] }))
            }, { apiVersion: "v1beta" })
        )
    }

    tools: ITool[] = [
        new GetJiraIssuesTool(),
        new GetSimilarIssues()
    ]

    async ask(question: string) {
        const history = []
        while (true) {
            const content = await this.planningAgent(question, history)
            history.push(content)

            let hasFunction = false
            for (const part of content.parts) {
                if (part.functionCall?.name) {
                    hasFunction = true
                    const tool = this.tools.find(t => t.name === part.functionCall?.name)
                    const toolContent = await tool.apply(...Object.values(part.functionCall.args))
                    history.push(toolContent)
                }
            }

            if (!hasFunction) {
                return content.parts.map(p => p.text).join('\n')
            }
        }
    }

    async planningAgent(question: string, history: Content[]) {
        const systemPrompt = `You are an AI agent specialized to summarizing data and trigger tools to answer user question.
            Your job is making decision based on the user question and information provided by tools:
            - If you don't have enough information to answer the question: You can tell the user which tool to trigger to get the information you need
            - If already have enough information: You generate the final answer for the input question

            Your final answer must meet following requirements:
            1. It directly answers the user question
            2. It must based on the facts / information provided in the main and the relevant tickets
            3. You should provide the citation key if possible`

        const contents = [
            ...history,
            {
                parts: [
                    {
                        text: `This is the user question: ${question}`,
                    }
                ],
                role: "user"
            }
        ]

        console.log(JSON.stringify(contents, null, 2))
        const result = await this.gemini.generateContent({
            contents,
            systemInstruction: systemPrompt
        })
        return result?.response?.candidates[0].content
    }
}

export const Agent = new AIAgentService()