import * as YAML from 'json-to-pretty-yaml';
import _ from "lodash";
import { IAIModelDynamicPrompt, IAIModelPrompt, IAIModelPromptPart, mkPrompt } from "../models/base";
import { AIAgentContext, IAIAgent, IAIAgentInputPrompt, IAIAgentResponse } from "./base";
import { SimpleAIAgent } from "./simple-agent";
import { IAITool } from "../tools";
import { PlanBreakdownAgent } from "./PlanBreakdownAgent";

interface Step {
    index: number;
    dependencies: number[];
    description: string;
    completed: boolean;
}

export class ExecutionAgent extends SimpleAIAgent {
    private maxIterations: number;
    private timeoutMs: number;
    public tools: IAITool[];

    constructor(tools: IAITool[], maxIterations: number = 10, timeoutMs: number = 300000) {
        super(
            ExecutionAgent.name,
            "An AI agent that executes plans created by the Planner Agent, optimizing for parallel execution when possible",
            "Executes optimized plans in parallel and provides feedback on execution progress and issues"
        );

        this.tools = tools;
        this.maxIterations = maxIterations;
        this.timeoutMs = timeoutMs;

        this.systemInstruction = `You are an Execution AI Agent responsible for executing plans created by a Planner Agent. Your role is to:
        1. Analyze the given plan and execution history.
        2. Determine all steps that have done and can be executed based on the execution history.
        3. Execute multiple steps in parallel when possible.
        4. Use function calls when necessary to complete steps.
        5. Provide clear feedback on execution progress or issues encountered.
        6. If there's any confusion or missing information, stop and provide feedback instead of continuing.
        7. If a function call returns an error, analyze it and provide a report with relevant feedback for improvement.
        8. Try to make use of the information retrieved in the history, don't repeat yourself.
        9. The final output MUST start with the "_COMPLETED_" indicator so we can stop the execution

        Your output should include:
        1. Clear, concise updates on the execution progress.
        2. Any necessary function calls for completing steps.
        3. Analysis of function call results when provided.`;
    }

    get outputTags(): string[] {
        return ["execution"];
    }

    // private parseSteps(plan: string): Step[] {
    //     const stepRegex = /\[(\d+)\]\[([^\]]*)\]:\s*(.*)/;
    //     return plan.split('\n')
    //         .map((line) => {
    //             const match = line.match(stepRegex);
    //             if (match) {
    //                 const [, index, dependencies, description] = match;
    //                 return {
    //                     index: parseInt(index),
    //                     dependencies: dependencies ? dependencies.split(',').map(d => parseInt(d.trim())) : [],
    //                     description: description.trim(),
    //                     completed: false,
    //                 };
    //             }
    //             return null;
    //         })
    //         .filter((step): step is Step => step !== null);
    // }

    // private getExecutableSteps(steps: Step[]): Step[] {
    //     return steps.filter(step =>
    //         !step.completed &&
    //         step.dependencies.every(depIndex => steps.find(s => s.index === depIndex)?.completed)
    //     );
    // }

    async run(inputs: IAIAgentInputPrompt[], ctx: AIAgentContext): Promise<IAIAgentResponse> {
        const startTime = Date.now();

        // Get the plan from PlanBreakdownAgent
        // const breakdownPlan = await ctx.runAgent(PlanBreakdownAgent.INST, inputs, "Generate plan breakdown");
        // const plan = breakdownPlan.parts[0].text;

        // const steps = this.parseSteps(plan);
        // if (steps.length > this.maxIterations) {
        //     throw new Error(`Cannot proceed with plan! Too many steps (${steps.length})`);
        // }

        let iteration = 0;
        let lastOutput: IAIModelPrompt | null = null;

        const executionPrompts: IAIModelPrompt[] = inputs.map(p => mkPrompt(p));

        while (iteration < this.maxIterations) {
            if (Date.now() - startTime > this.timeoutMs) {
                throw new Error(`Execution timed out. We have done ${iteration + 1} iteration`);
            }

            if (!_.last(_.last(executionPrompts)?.parts)?.functionResponse) {
                executionPrompts.push(mkPrompt(`Please continue to execute the plan`))
            }

            const result = await ctx.query(executionPrompts);
            lastOutput = result.outputPrompt

            // Add operation record for the model's response
            ctx.addOpRecord(result.outputPrompt, `Model response - Iteration ${iteration + 1}`, [result.id]);

            // Process function calls and update step status
            let isCompleted = false
            const functionResponseParts: IAIModelPromptPart[] = []
            for (const part of result.outputPrompt.parts) {
                if (part.functionName && part.functionArgs) {
                    const tool = this.tools.find(t => t.name === part.functionName);
                    if (tool) {
                        const toolResult = await tool.apply(part.functionArgs);
                        functionResponseParts.push({
                            functionName: part.functionName,
                            functionResponse: toolResult
                        })
                        // Add operation record for the function call
                        ctx.addOpRecord(
                            mkPrompt(YAML.stringify(toolResult)),
                            `Function call: ${part.functionName} - Iteration ${iteration + 1}`
                        );
                    } else {
                        throw new Error(`Tool "${part.functionName}" not found.`);
                    }
                }
                else if (part.text) {
                    if (part.text.includes("_COMPLETED_")) {
                        isCompleted = true
                    }
                }
            }

            if (isCompleted) {
                break
            }

            executionPrompts.push(result.outputPrompt)
            if (functionResponseParts.length > 0) {
                executionPrompts.push({
                    role: 'function',
                    parts: functionResponseParts
                })
            }

            iteration++;
        }

        if (!lastOutput) {
            throw new Error("Execution completed but no output was generated.");
        }

        // Add final operation record
        ctx.addOpRecord(lastOutput, `Execution complete`, [], ["execution_complete"]);

        return lastOutput;
    }
}