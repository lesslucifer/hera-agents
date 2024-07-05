import _ from "lodash";
import { IAIModelDynamicPrompt } from "../models/base";
import { AIAgentContext, IAIAgentResponse } from "./base";
import { SimpleAIAgent } from "./simple-agent";

export class PlanBreakdownAgent extends SimpleAIAgent {
    static readonly INST = new PlanBreakdownAgent()

    constructor() {
        super(
            PlanBreakdownAgent.name,
            "An AI agent that analyzes plans from other agents, breaks them down into detailed steps, and applies topological sorting for optimal execution order",
            "Optimizes plans for parallel execution"
        );

        this.systemPrompt = `You are a Plan Breakdown Agent, specialized in analyzing and optimizing plans created by other agents. Your tasks are:

        1. Carefully analyze the given plan.
        2. Break down the plan into detailed, actionable steps.
        3. Identify dependencies between steps.
        4. Apply topological sorting to order steps for potential parallel execution.
        5. You MUST output the steps in this format (keep the brackets strictly, it's important for parsing): [STEP_IDX][DEPENDENCIES]: <step description in ONE LINE ONLY>

        Guidelines:
        - Ensure each step is clear, concise, and actionable.
        - List dependencies for each step. Use [] if there are no dependencies.
        - Maintain the logical flow of the original plan while optimizing for parallel execution.
        - If a step depends on multiple previous steps, list all dependencies separated by commas.
        - Ensure that the step index starts at 1 and increments for each step.

        Your output should be a well-structured, optimized version of the original plan that an Execution Agent can follow efficiently.`;
    }

    get outputTags(): string[] {
        return ["plan"]
    }

    async userPrompt(ctx: AIAgentContext): Promise<IAIModelDynamicPrompt[]> {
        // Find the last plan from the PlannerAgent
        const lastPlanRecord = _.findLast(ctx.history, r => r.tags?.includes("plan"));
        if (!lastPlanRecord) {
            return [{ role: 'model', parts: [{ text: "No plan found. Please run the PlannerAgent first." }] }];
        }

        const plan = lastPlanRecord.outputPrompt.parts[0].text;
        return [
            {
                role: 'user',
                parts: [
                    { text: "Here's the plan to break down and optimize:\n\n" + plan },
                    { text: "\n\nPlease analyze this plan, break it down into detailed steps, identify dependencies, and apply topological sorting. Output the result in the required format: [STEP_INDEX][DEPENDENCIES]: <step description>" }
                ]
            }
        ];
    }

    async run(ctx: AIAgentContext): Promise<IAIAgentResponse> {
        const output = await super.run(ctx);
        
        // Validate the output format
        const steps = output.parts.map(p => p.text ?? '').join('\n').split('\n');
        const validSteps = steps.filter(step => /^\[\d+\]\[[^\]]*\]:/.test(step));

        if (!validSteps.length) {
            const errorMessage = "The output format is incorrect. Please ensure each step follows the format: [STEP_INDEX][DEPENDENCIES]: <step description>";
            throw new Error(errorMessage);
        }

        return { role: 'model', parts: [{ text: validSteps.join('\n') }] };
    }
}