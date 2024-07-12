import { IAIModelDynamicPrompt, IAIModelPrompt, mkPrompt } from "../models/base";
import { AIAgentSession, IAIAgent, IAIAgentResponse } from "./base";
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

    async run(sess: AIAgentSession): Promise<IAIAgentResponse> {
        const startTime = Date.now();
        let currentOutput: IAIAgentResponse | null = null;
        let iteration = 0;

        while (iteration < this.maxIterations && Date.now() - startTime < this.timeoutMs) {
            // Run the target agent
            currentOutput = await sess.runAgent(this.targetAgent);

            // Prepare the critique prompt
            const critisPrompt: IAIModelPrompt = {
                role: 'user',
                parts: [
                    { text: `Agent objective: ${this.targetAgent.description}` },
                    { text: `Agent output:\n${JSON.stringify(currentOutput, null, 2)}}` },
                    { text: `Please provide a critique of the agent\'s output. Identify any issues and suggest improvements. If the output is satisfactory, start your response with "NO_FURTHER_IMPROVEMENTS_NEEDED" and explain why.` },
                ]
            }

            // Generate critique
            const critiqueOutput = await sess.generate(critisPrompt);
            const critique = critiqueOutput.outputPrompt.parts[0].text;
            sess.addAgentRecord(critiqueOutput.outputPrompt, "Critic feedback", [critiqueOutput.id], ["feedback"]);

            // Check if the output is satisfactory
            if (critique.startsWith("NO_FURTHER_IMPROVEMENTS_NEEDED")) {
                break;
            }

            iteration++;
        }

        if (!currentOutput) throw new Error("Failed to generate a satisfactory output within the given constraints.")
        return currentOutput
    }
}