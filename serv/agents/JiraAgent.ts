import { GetJiraIssuesTool } from "../tools/get_jira_issues";
import { GetTicketByDescription } from "../tools/get_similar_issues";
import { ChainingAIAgent } from "./chaining-agent";
import { ExecutionAgent } from "./ExecutionAgent";
import { NaturalResponseAgent } from "./natural-response-agent";
import { PlannerAgent } from "./PlannerAgent";

export class JiraAgent extends ChainingAIAgent {
    constructor() {
        const tools = [
            new GetJiraIssuesTool(),
            new GetTicketByDescription()
        ]

        super([
            new PlannerAgent(tools),
            new ExecutionAgent(tools),
            NaturalResponseAgent.INST
        ], NaturalResponseAgent.INST)
        
        this.name = JiraAgent.name
        this.description = "An AI agent specialized in checking JIRA information and performing relevant actions for WFORD (Web & Backend) and MBL6 (Mobile) projects"
        this.shortDescription = "Manages JIRA tasks and provides project insights"
    }

    get outputTags(): string[] {
        return ["jira", "project_management"]
    }
}