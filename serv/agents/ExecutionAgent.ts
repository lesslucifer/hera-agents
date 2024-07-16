import * as YAML from 'json-to-pretty-yaml';
import _ from "lodash";
import { IAIModelDynamicPrompt, IAIModelGenerationRequestCustomConfig, IAIModelPrompt, IAIModelPromptPart, mkPrompt } from "../models/base";
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
        2. Determine the steps that already accomplished and what you should do next to complete the plan.
        3. Use function / tool calls when necessary to complete steps.
        4. If there's any confusion or missing information, stop and provide feedback instead of continuing.
        5. Try to make use of the information retrieved in the history, DO NOT trigger the same functions / tools that have been done.
        6. The final output MUST start with the "_COMPLETED_" indicator so we can stop the execution`;
    }

    get outputTags(): string[] {
        return ["execution"];
    }

    get customQueryConfig(): IAIModelGenerationRequestCustomConfig {
        return {
            maxOutputTokens: 1000
        }
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

            if (iteration === 0) {
                executionPrompts.push(mkPrompt(`Please execute the plan`))
            }
            else if (_.last(_.last(executionPrompts)?.parts)?.functionResponse){
                executionPrompts.push(mkPrompt(`Function ${_.last(_.last(executionPrompts)?.parts)?.functionName} has run successfully. Please continue to execute the plan`))
            }
            else {
                executionPrompts.push(mkPrompt(`Please continue to execute the plan`))
            }

            const result = await ctx.query(executionPrompts);
            lastOutput = result.outputPrompt

            // Add operation record for the model's response
            await ctx.addOpRecord(result.outputPrompt, `Model response - Iteration ${iteration + 1}`, [result.id]);

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
                        await ctx.addOpRecord(
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
        await ctx.addOpRecord(lastOutput, `Execution complete`, [], ["execution_complete"]);

        return lastOutput;
    }
}