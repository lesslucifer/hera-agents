import _ from "lodash";
import { IAIModelDynamicPrompt, IAIModelPrompt, emptyAIModelUsage } from "../models/base";
import { AIAgentContext, IAIAgent, IAIAgentResponse } from "./base";
import { SimpleAIAgent } from "./simple-agent";
import { IAITool } from "../tools";
import { PlannerAgent } from "./PlannerAgent";

export class ExecutionAgent extends SimpleAIAgent {
    private maxIterations: number;
    private timeoutMs: number;
    private tools: IAITool[];

    constructor(tools: IAITool[], maxIterations: number = 10, timeoutMs: number = 300000) {
        super(
            ExecutionAgent.name,
            "An AI agent that executes plans created by the Planner Agent, considering execution history and handling errors",
            "Executes plans and provides feedback on execution progress and issues"
        );

        this.tools = tools;
        this.maxIterations = maxIterations;
        this.timeoutMs = timeoutMs;

        this.systemPrompt = `You are an Execution AI Agent responsible for executing plans created by a Planner Agent. Your role is to:
        1. Analyze the given plan and execution history.
        2. Determine the next step to execute based on what has been done and what needs to be done.
        3. Execute steps by calling appropriate tools when necessary.
        4. Provide clear feedback on execution progress, issues encountered, or completion of the plan.
        5. If there's any confusion or missing information, stop and provide feedback instead of continuing.
        6. If a tool returns an error, analyze it and provide a report with relevant feedback for improvement.
        7. Double-check parameters before calling tools, and if information is missing or unsuitable, attempt to figure it out based on context.
        8. Optimize execution based on the plan and available tools.

        Your output should be one of the following:
        1. A function call to a tool.
        2. A status update or request for clarification.
        3. A final result or completion message (In this case, the output message must starts with the keyword: PLAN_EXECUTION_COMPLETED).

        Always provide clear, concise updates on the execution progress.`;
    }

    get outputTags(): string[] {
        return ["execution"]
    }

    async run(ctx: AIAgentContext): Promise<IAIAgentResponse> {
        const startTime = Date.now();
        let iteration = 0;
        const history: IAIModelPrompt[] = [];

        // Find the last plan from the PlannerAgent
        const lastPlanRecord = _.findLast(ctx.history, r => r.tags?.includes("plan"));
        if (!lastPlanRecord) {
            return { role: 'model', parts: [{ text: "No plan found. Please run the PlannerAgent first." }] };
        }

        const plan = lastPlanRecord.outputPrompt.parts[0].text;
        history.push({ role: 'user', parts: [{ text: `Plan to execute: ${plan}` }] });

        while (iteration < this.maxIterations && Date.now() - startTime < this.timeoutMs) {
            const executionPrompt: IAIModelDynamicPrompt[] = [
                ...history,
                { role: 'user', parts: [{ text: "Please execute the next step of the plan or provide a status update." }] }
            ];

            const output = await ctx.execute(executionPrompt, this.systemPrompt, this.tools);
            history.push(output.prompt);

            for (const part of output.prompt.parts) {
                if (part.functionName) {
                    // Execute tool
                    const tool = this.tools.find(t => t.name === part.functionName);
                    if (!tool) {
                        history.push({ role: 'model', parts: [{ text: `Error: Tool "${part.functionName}" not found.` }] });
                        continue;
                    }

                    try {
                        const toolResult = await tool.apply(part.functionArgs);
                        history.push({ role: 'function', parts: [{ text: `Tool "${part.functionName}" result: ${JSON.stringify(toolResult)}` }] });
                    } catch (error) {
                        history.push({ role: 'model', parts: [{ text: `Error executing tool "${part.functionName}": ${error.message}` }] });
                    }
                } else if (part.text) {
                    // Check if this is a final result or completion message
                    if (part.text.toLowerCase().includes("PLAN_EXECUTION_COMPLETED")) {
                        ctx.addAgentRecord(this.name, this.outputTags, executionPrompt, output.prompt, output.usage);
                        return output.prompt;
                    }
                }
            }

            iteration++;
        }

        // If we've reached the maximum iterations or timeout
        const timeoutMessage: IAIModelPrompt = { role: 'model', parts: [{ text: "Execution timed out or reached maximum iterations. Here's the current status: " + history[history.length - 1].parts[0].text }] };
        ctx.addAgentRecord(this.name, ["error"], history, timeoutMessage, emptyAIModelUsage());
        return timeoutMessage;
    }
}