import * as YAML from 'json-to-pretty-yaml';
import { emptyPrompt, IAIModelDynamicPrompt, IAIModelPrompt, mkPrompt } from "../models/base";
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

        this.systemInstruction = `You are a Critic AI Agent, specialized in analyzing and improving the output of other AI agents. Your role is to carefully examine the user query, agent objective, input, and output to identify areas for improvement. Follow these guidelines:
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

    get outputTags(): string[] {
        return ["critique", "feedback"];
    }

    async run(inputs: IAIAgentInputPrompt[], ctx: AIAgentContext): Promise<IAIAgentResponse> {
        const startTime = Date.now();
        let currentOutput: IAIAgentResponse | null = null;
        let iteration = 0;
        let previousOutputs: IAIAgentResponse[] = [];
        let previousCritiques: string[] = [];

        while (iteration < this.maxIterations && Date.now() - startTime < this.timeoutMs) {
            // Prepare input for the target agent
            const targetAgentInputs = [
                ...inputs,
                ...previousOutputs.map((output, index) => 
                    mkPrompt(`Previous output (Iteration ${index + 1}):\n${YAML.stringify(output)}`)
                ),
                ...previousCritiques.map((critique, index) => 
                    mkPrompt(`Previous critique (Iteration ${index + 1}):\n${critique}`)
                ),
                ...(iteration > 0 ? [mkPrompt("Please improve the output based on previous critiques and avoid repeating past issues.")] : [])
            ];

            // Run the target agent
            currentOutput = await ctx.runAgent(this.targetAgent, targetAgentInputs, `Iteration ${iteration + 1}`);

            // Prepare the critique prompt
            const critiquePrompt: IAIModelPrompt = {
                role: 'user',
                parts: [
                    { text: `Agent objective: ${this.targetAgent.description}` },
                    { text: `Current output (Iteration ${iteration + 1}):\n${YAML.stringify(currentOutput)}` },
                    ...previousOutputs.map((output, index) => 
                        ({ text: `Previous output (Iteration ${index + 1}):\n${YAML.stringify(output)}` })
                    ),
                    ...previousCritiques.map((critique, index) => 
                        ({ text: `Previous critique (Iteration ${index + 1}):\n${critique}` })
                    ),
                    { text: `Please provide a critique of the agent's current output. Identify any remaining issues, improvements made, and suggest further enhancements. If the output is satisfactory and significantly improved from previous iterations, start your response with "NO_FURTHER_IMPROVEMENTS_NEEDED" and explain why.` },
                ]
            };

            // Generate critique
            const critiqueResult = await ctx.query([critiquePrompt]);
            const critique = critiqueResult.outputPrompt.parts[0].text;
            await ctx.addOpRecord(critiqueResult.outputPrompt, `Critic feedback - Iteration ${iteration + 1}`, [critiqueResult.id]);

            // Check if the output is satisfactory
            if (critique.startsWith("NO_FURTHER_IMPROVEMENTS_NEEDED")) {
                break;
            }

            // Store current output and critique for the next iteration
            previousOutputs.push(currentOutput);
            previousCritiques.push(critique);

            iteration++;
        }

        if (!currentOutput) {
            throw new Error("Failed to generate a satisfactory output within the given constraints.");
        }

        // Add a final operation record for the successful output
        await ctx.addOpRecord(currentOutput, `Final improved output - Iteration ${iteration + 1}`, [], ["final_output"]);

        return currentOutput;
    }
}