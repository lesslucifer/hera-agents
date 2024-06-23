import { Content, GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";
import { ITool } from "./tools";
import { GetJiraIssuesTool } from "./tools/get_jira_issues";
import ENV from "../glob/env";
import { GetTicketByDescription } from "./tools/get_similar_issues";

class AIAgentService {
    _gemini: GenerativeModel

    get gemini() {
        return this._gemini ?? (
            this._gemini = new GoogleGenerativeAI(ENV.GEMINI_KEY).getGenerativeModel({
                model: "gemini-1.5-pro-latest",
                tools: [{ functionDeclarations: this.tools.map(t => t.description) }]
            }, { apiVersion: "v1beta" })
        )
    }

    tools: ITool[] = [
        new GetTicketByDescription(),
        new GetJiraIssuesTool(),
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
                    console.log(part.functionCall)
                    const tool = this.tools.find(t => t.name === part.functionCall?.name)
                    const toolContent = await tool.apply(part.functionCall.args)
                    history.push(toolContent)
                }
            }

            if (!hasFunction) {
                const answer = content.parts.map(p => p.text).join('\n')
                console.log(`Final answer`, answer.slice(0, 200))
                return answer
            }
        }
    }

    async planningAgent(question: string, history: Content[]) {
        const systemPrompt = `You are an AI agent specialized to summarizing data and trigger tools to answer user question.
            Your job is making decision based on the user question and information provided by tools:
            - If you don't have enough information to answer the question: You can use the tool to get more information
            - If already have enough information: You generate the final answer for the input question
            - You should not have over 5 function call iteration. You can stop and give the answer if reaching the limit

            Your final answer must meet following requirements:
            1. It directly answers the user question
            2. It must based on the facts / information provided by the user and the tools
            3. You should provide the citation key if possible`

        const contents = [
            {
                parts: [
                    {
                        text: `This is the user question: ${question}`,
                    }
                ],
                role: "user"
            },
            ...history
        ]

        const result = await this.gemini.generateContent({
            contents,
            systemInstruction: systemPrompt,
        })
        console.log(contents.map(c => JSON.stringify(c).slice(0, 200)))
        console.log(result.response.usageMetadata)
        return result?.response?.candidates[0].content
    }
}

export const Agent = new AIAgentService()