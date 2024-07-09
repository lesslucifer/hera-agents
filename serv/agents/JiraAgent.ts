import { IAIModelDynamicPrompt } from "../models/base";
import { AIAgentContext, IAIAgentResponse } from "./base";
import { SimpleAIAgent } from "./simple-agent";
import { IAITool } from "../tools";
import { ChainingAIAgent } from "./chaining-agent";
import { NaturalResponseAgent } from "./natural-response-agent";
import { PlannerAgent } from "./PlannerAgent";
import { GetJiraIssuesTool } from "../tools/get_jira_issues";
import { GetTicketByDescription } from "../tools/get_similar_issues";
import { ExecutionAgent } from "./ExecutionAgent";
import { CriticAgent } from "./CriticAgent";

export class JiraAgent extends ChainingAIAgent {
    constructor() {
        const tools = [
            new GetJiraIssuesTool(),
            new GetTicketByDescription()
        ]

        super([
            new PlannerAgent(tools),
            new ExecutionAgent(tools)
        ], new NaturalResponseAgent())
        
        this.name = JiraAgent.name
        this.description = "An AI agent specialized in checking JIRA information and performing relevant actions for WFORD (Web & Backend) and MBL6 (Mobile) projects"
        this.shortDescription = "Manages JIRA tasks and provides project insights"
    }

    get outputTags(): string[] {
        return ["jira", "project_management"]
    }
}