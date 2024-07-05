import _ from "lodash";
import { IAIModelDynamicPrompt, IAIModelOutput, IAIModelPrompt, IAIModelUsage, emptyAIModelUsage } from "../models/base";
import { AIAgentContext, IAIAgent, IAIAgentInputPrompt, IAIAgentRecord, IAIAgentResponse } from "./base";
import { SimpleAIAgent } from "./simple-agent";
import { IAITool } from "../tools";
import { PlanBreakdownAgent } from "./PlanBreakdownAgent";

interface Step {
    index: number;
    dependencies: number[];
    description: string;
}

export class ExecutionAgent extends SimpleAIAgent {
    private maxIterations: number;
    private timeoutMs: number;
    private tools: IAITool[];

    constructor(tools: IAITool[], maxIterations: number = 10, timeoutMs: number = 300000) {
        super(
            ExecutionAgent.name,
            "An AI agent that executes plans created by the Planner Agent, considering execution history and handling errors",
            "Executes optimized plans and provides feedback on execution progress and issues"
        );

        this.tools = tools;
        this.maxIterations = maxIterations;
        this.timeoutMs = timeoutMs;

        this.systemPrompt = `You are an Execution AI Agent responsible for executing plans created by a Planner Agent. Your role is to:
        1. Analyze the given plan and execution history.
        2. Determine the next step(s) to execute based on dependencies and what has been done.
        3. Execute steps by calling appropriate tools when necessary.
        4. Provide clear feedback on execution progress, issues encountered, or completion of the plan.
        5. If there's any confusion or missing information, stop and provide feedback instead of continuing.
        6. If a tool returns an error, analyze it and provide a report with relevant feedback for improvement.
        7. Double-check parameters before calling tools, and if information is missing or unsuitable, attempt to figure it out based on context.
        8. Optimize execution by running independent steps in parallel when possible.
        9. Try to make use the information retreived in the history, don't repeat yourself

        Your output should be one of the following:
        1. A function call to a tool.
        2. A status update or request for clarification.

        Always provide clear, concise updates on the execution progress.`;
    }

    get outputTags(): string[] {
        return ["execution"]
    }

    private parseSteps(plan: string): Step[] {
        const stepRegex = /\[(\d+)\]\[([^\]]*)\]:\s*(.*)/;
        return plan.split('\n')
            .map((line, i) => {
                const match = line.match(stepRegex);
                if (match) {
                    const [, index, dependencies, description] = match;
                    return {
                        index: parseInt(index),
                        dependencies: dependencies ? dependencies.split(',').map(d => parseInt(d.trim())) : [],
                        description: description.trim(),
                    };
                }
                else {
                    return {
                        index: i + 1,
                        dependencies: _.range(1, i + 1),
                        description: line,
                    }
                }
            })
            .filter((step): step is Step => step !== null);
    }

    async run(ctx: AIAgentContext): Promise<IAIAgentResponse> {
        const startTime = Date.now();
        const history: IAIModelPrompt[] = [];

        const breakdownPlan = await PlanBreakdownAgent.INST.run(ctx)
        const plan = breakdownPlan.parts[0].text

        const steps = this.parseSteps(plan);
        if (steps.length > this.maxIterations) throw new Error(`Cannot proceed plan! Too many steps`)

        history.push({ role: 'user', parts: [{ text: `Full breakdown plan: ${plan}` }] });

        const stepRecords: _.Dictionary<{
            inputPrompts: IAIAgentInputPrompt[],
            outputPrompt: IAIModelPrompt,
            usage: IAIModelUsage
        }[]> = {}

        console.log(`Plan`, plan)
        for (const step of steps) {
            console.log(`Run step`, step.index, step.description)
            if (Date.now() - startTime > this.timeoutMs) {
                throw new Error("Execution timed out. Here's the current status: " + steps.map(step => `[Step ${step.index}] ${step.description}: ${!!stepRecords[step.index] ? 'Completed' : 'Not completed'}`).join(', '))
            }

            const incompletedDeps = step.dependencies.filter(dep => dep >= steps.length || !stepRecords[dep])
            if (incompletedDeps.length) {
                throw new Error(`Cannot execute step ${step.index}: ${step.description}! Not all of its dependencies are completed; ${incompletedDeps.join(',')}`)
            }

            const executionPrompts: IAIAgentInputPrompt[] = [
                ...history,
                ...step.dependencies.flatMap(dep => (stepRecords[dep] ?? []).map(r => r.outputPrompt)),
                `Please execute the following step: ${step.index}: ${step.description}`
            ]
            const output = await ctx.execute(executionPrompts, this.systemPrompt, this.tools);
            stepRecords[step.index] = [{
                inputPrompts: executionPrompts,
                outputPrompt: output.prompt,
                usage: output.usage
            }]

            for (const part of output.prompt.parts) {
                if (part.functionName) {
                    const tool = this.tools.find(t => t.name === part.functionName);
                    if (!tool) {
                        throw new Error(`Tool "${part.functionName}" not found.`);
                    }

                    const toolResult = await tool.apply(part.functionArgs);
                    stepRecords[step.index].push({
                        inputPrompts: [],
                        outputPrompt: {
                            role: 'function', parts: [{ functionName: part.functionName, functionResponse: _.first(toolResult.parts).functionResponse }]
                        },
                        usage: emptyAIModelUsage()
                    });
                }
            }
        }

        steps.forEach(step => {
            const records = stepRecords[step.index] ?? []
            records.forEach(r => {
                ctx.addAgentRecord(this.name, this.outputTags, r.inputPrompts, r.outputPrompt, r.usage)
            })
        })

        return ctx.lastOutputPrompt
    }
}