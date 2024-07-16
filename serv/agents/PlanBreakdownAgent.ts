import _ from "lodash";
import { IAIModelDynamicPrompt, IAIModelPrompt, mkPrompt } from "../models/base";
import { AIAgentContext, IAIAgent, IAIAgentInputPrompt, IAIAgentResponse } from "./base";
import { SimpleAIAgent } from "./simple-agent";
import { platform } from "os";

export class PlanBreakdownAgent extends SimpleAIAgent {
    static readonly INST = new PlanBreakdownAgent()

    constructor() {
        super(
            PlanBreakdownAgent.name,
            "An AI agent that analyzes plans from other agents, breaks them down into detailed steps, and applies topological sorting for optimal execution order",
            "Optimizes plans for parallel execution"
        );

        this.systemInstruction = `You are a Plan Breakdown Agent, specialized in analyzing and optimizing plans created by other agents. Your tasks are:

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
        return ["plan_breakdown"]
    }

    async run(inputs: IAIAgentInputPrompt[], ctx: AIAgentContext): Promise<IAIAgentResponse> {
        const breakdownPrompt: IAIModelPrompt = {
            role: 'user',
            parts: [
                { text: "\n\nPlease analyze the given plan, break it down into detailed steps, identify dependencies, and apply topological sorting. Output the result in the required format: [STEP_INDEX][DEPENDENCIES]: <step description>" }
            ]
        };

        const result = await ctx.query([...inputs, breakdownPrompt]);
        
        // Validate the output format
        const steps = result.outputPrompt.parts[0].text.split('\n');
        const validSteps = steps.filter(step => /^\[\d+\]\[[^\]]*\]:/.test(step));

        if (!validSteps.length) {
            const errorMessage = "The output format is incorrect. Please ensure each step follows the format: [STEP_INDEX][DEPENDENCIES]: <step description>";
            throw new Error(errorMessage);
        }

        const finalOutput = validSteps.join('\n');
        await ctx.addOpRecord(mkPrompt(finalOutput), "Plan breakdown and optimization", [result.id], this.outputTags);

        return mkPrompt(finalOutput);
    }
}