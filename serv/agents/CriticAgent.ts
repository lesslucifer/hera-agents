import _ from "lodash";
import { IAIModelDynamicPrompt, IAIModelPrompt, emptyAIModelUsage } from "../models/base";
import { AIAgentContext, IAIAgent, IAIAgentInputPrompt, IAIAgentResponse } from "./base";
import { SimpleAIAgent } from "./simple-agent";

export class CriticAgent extends SimpleAIAgent {
    private maxIterations: number;
    private timeoutMs: number;
    private targetAgent: IAIAgent;

    constructor(targetAgent: IAIAgent, maxIterations: number = 5, timeoutMs: number = 60000) {
        super(
            CriticAgent.name,
            "An AI agent that critiques the output of another agent to improve its performance",
            "Provides constructive criticism to enhance agent outputs"
        );

        this.targetAgent = targetAgent;
        this.maxIterations = maxIterations;
        this.timeoutMs = timeoutMs;

        this.systemPrompt = `You are a Critic AI Agent, specialized in analyzing and improving the output of other AI agents. Your role is to carefully examine the user query, agent objective, input, and output to identify areas for improvement. Follow these guidelines:
        1. Thoroughly analyze the user's original query and intent.
        2. Review the agent's objective and expected output.
        3. Examine the agent's input and output carefully.
        4. Identify any discrepancies, inaccuracies, or areas where the output falls short of the objective.
        5. Provide specific, constructive criticism on what aspects of the output need improvement.
        6. Suggest potential fixes or enhancements to address the identified issues.
        7. Be thorough but concise in your critique.
        8. If the output is satisfactory and meets all requirements, clearly state "NO_FURTHER_IMPROVEMENTS_NEEDED" at the beginning of your response, followed by an explanation of why the output is satisfactory.

        Your critique should be actionable and aimed at helping the agent produce better results in subsequent iterations.`;
    }

    async run(ctx: AIAgentContext): Promise<IAIAgentResponse> {
        const clonedContext = ctx.clone()
        clonedContext.totalUsage = emptyAIModelUsage()

        const output = await this.runInFakeContext(clonedContext)
        const lastAgentRecord = _.findLast(clonedContext.history, r => r.agentName === this.targetAgent.name)

        ctx.addAgentRecord(this.targetAgent.name, lastAgentRecord.tags, lastAgentRecord.inputPrompts, output, clonedContext.totalUsage)
        return output
    }

    private async runInFakeContext(ctx: AIAgentContext) {
        const startTime = Date.now();
        let currentOutput: IAIAgentResponse | null = null;
        let iteration = 0;

        while (iteration < this.maxIterations && Date.now() - startTime < this.timeoutMs) {
            // Run the target agent
            const agentOutput = await this.targetAgent.run(ctx);
            currentOutput = agentOutput

            // Prepare the critique prompt
            const critiqueParts: IAIModelDynamicPrompt[] = [
                { role: 'user', parts: [{ text: `Agent objective: ${this.targetAgent.description}` }] },
                { role: 'user', parts: [{ text: `Agent output:\n${JSON.stringify(agentOutput, null, 2)}` }] },
                { role: 'user', parts: [{ text: 'Please provide a critique of the agent\'s output. Identify any issues and suggest improvements. If the output is satisfactory, start your response with "NO_FURTHER_IMPROVEMENTS_NEEDED" and explain why.' }] }
            ];

            // Generate critique
            const critiqueOutput = await ctx.execute(critiqueParts, this.systemPrompt);
            const critique = critiqueOutput.prompt.parts[0].text;
            ctx.addAgentRecord(this.name, ["feedback"], critiqueParts, critiqueOutput.prompt, critiqueOutput.usage);

            // Check if the output is satisfactory
            if (critique.startsWith("NO_FURTHER_IMPROVEMENTS_NEEDED")) {
                break
            }
            
            // Prepare the agent for the next iteration
            ctx.addUserPrompt({ role: 'user', parts: [{ text: `Please improve your output based on this critique: ${critique}` }] });

            iteration++;
        }

        // If we've reached the maximum iterations or timeout, return the last output
        return currentOutput || { role: 'model', parts: [{ text: "Failed to generate a satisfactory output within the given constraints." }] };
    }
}