import { IAITool } from "../tools";
import { GetJiraIssuesTool } from "../tools/get_jira_issues";
import { GetTicketByDescription } from "../tools/get_similar_issues";
import { IAIAgentInputPrompt, AIAgentContext, IAIAgentResponse } from "./base";
import { ChainingAIAgent } from "./chaining-agent";
import { ExecutionAgent } from "./ExecutionAgent";
import { NaturalResponseAgent } from "./NaturalResponseAgent";
import { PlannerAgent } from "./PlannerAgent";
import { SimpleAIAgent } from "./simple-agent";

export class JiraAgent extends SimpleAIAgent {
    tools: IAITool[]
    plannerAgent: PlannerAgent
    executionAgent: ExecutionAgent
    naturalResponseAgent = NaturalResponseAgent.INST

    constructor() {
        super(JiraAgent.name,
            "An AI agent specialized in checking JIRA information and performing relevant actions for WFORD (Web & Backend) and MBL6 (Mobile) projects",
            "Manages JIRA tasks and provides project insights"
        )

        this.tools = [
            new GetJiraIssuesTool(),
            new GetTicketByDescription()
        ]

        this.plannerAgent = new PlannerAgent(this.tools)
        this.executionAgent = new ExecutionAgent(this.tools)
    }

    get outputTags(): string[] {
        return ["jira", "project_management"]
    }

    async run(inputs: IAIAgentInputPrompt[], ctx: AIAgentContext): Promise<IAIAgentResponse> {
        const plan = await ctx.runAgent(this.plannerAgent, inputs, "generate a plan to resolve the user's query / problems")
        const execOutput = await ctx.runAgent(this.executionAgent, [plan], "execute the plan")
        const output = await ctx.runAgent(this.naturalResponseAgent, [...inputs, execOutput], "rewrite the output from the execution agent to address the original request")
        return output
    }
}