import Anthropic from '@anthropic-ai/sdk';
import {
    MessageCreateParams,
    MessageParam,
    Message,
    ContentBlock,
    TextBlock,
    ToolUseBlock,
    TextBlockParam,
    ImageBlockParam,
    ToolResultBlockParam,
    ToolUseBlockParam,
    Tool
} from '@anthropic-ai/sdk/resources/messages';
import { IAIModel, IAIModelGenerationRequest, IAIModelOutputPrompt, IAIModelPrompt, IAIModelPromptPart, IAIToolDeclaration, IAIModelPromptRole } from './base';
import _ from 'lodash';
import * as YAML from 'json-to-pretty-yaml';

export class ClaudeModel implements IAIModel {
    private anthropic: Anthropic;
    private model: string;

    constructor(apiKey: string, model: string = 'claude-3-opus-20240229') {
        this.anthropic = new Anthropic({ apiKey });
        this.model = model;
    }

    private mapRoleToAnthropic(role: IAIModelPromptRole): MessageParam['role'] {
        switch (role) {
            case 'user':
                return 'user';
            case 'model':
                return 'assistant';
            case 'function':
                console.warn('Function role is not directly supported in Claude API. Mapping to user.');
                return 'user';
            default:
                console.warn(`Unknown role "${role}" mapped to "user"`);
                return 'user';
        }
    }

    private mapRoleFromAnthropic(role: Message['role']): IAIModelPromptRole {
        switch (role) {
            case 'assistant':
                return 'model';
            default:
                console.warn(`Unknown Claude role "${role}" mapped to "user"`);
                return 'user';
        }
    }

    private convertPromptToAnthropicFormat(prompt: IAIModelPrompt): MessageParam {
        const role = this.mapRoleToAnthropic(prompt.role);
        const content = prompt.parts.map(this.convertPartToAnthropicFormat).join('\n');

        return { role, content };
    }

    private convertPartToAnthropicFormat(part: IAIModelPromptPart): TextBlockParam | ImageBlockParam | ToolResultBlockParam | ToolUseBlockParam {
        if (part.text) {
            return { type: 'text', text: part.text };
        }
        if (part.base64 && part.mimeType) {
            return {
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: part.mimeType as any,
                    data: part.base64
                }
            };
        }
        if (part.functionName && part.functionArgs) {
            return {
                type: 'tool_use',
                id: part.id?.toString() || `tool_${Date.now()}`,
                name: part.functionName,
                input: part.functionArgs
            };
        }
        if (part.functionName && part.functionResponse !== undefined) {
            return {
                type: 'tool_result',
                tool_use_id: part.id?.toString() || part.functionName,
                content: _.isString(part.functionResponse) ? part.functionResponse : YAML.stringify(part.functionResponse)
            };
        }
        if (part.fileUri) {
            console.warn('File URIs are not directly supported in Claude API. Converting to text description.');
            return { type: 'text', text: `[File: ${part.fileUri}]` };
        }
        throw new Error('Invalid part format');
    }

    private convertAnthropicResponseToAIModelOutput(message: Message): IAIModelOutputPrompt {
        const parts: IAIModelPromptPart[] = this.convertContentBlocksToPromptParts(message.content);

        return {
            role: this.mapRoleFromAnthropic(message.role),
            parts,
            usage: message.usage ? {
                inputToken: message.usage.input_tokens,
                outputToken: message.usage.output_tokens
            } : undefined
        };
    }

    private convertContentBlocksToPromptParts(content: ContentBlock[]): IAIModelPromptPart[] {
        return content.map(block => this.convertContentBlockToPromptPart(block));
    }

    private convertContentBlockToPromptPart(block: ContentBlock): IAIModelPromptPart {
        switch (block.type) {
            case 'text':
                return { text: (block as TextBlock).text };
            case 'tool_use':
                const toolUseBlock = block as ToolUseBlock;
                return {
                    id: toolUseBlock.id,
                    functionName: toolUseBlock.name,
                    functionArgs: toolUseBlock.input as object
                };
            default:
                console.warn(`Unknown content type: ${(block as any).type}`);
                return { text: JSON.stringify(block) };
        }
    }

    async generate(req: IAIModelGenerationRequest): Promise<IAIModelOutputPrompt> {
        const messages = req.prompts.map(prompt => this.convertPromptToAnthropicFormat(prompt as IAIModelPrompt));

        const anthropicRequest: MessageCreateParams = {
            model: this.model,
            messages,
            system: req.sysInstruction,
            max_tokens: req.customConfig?.maxOutputTokens,
            temperature: req.customConfig?.temperature,
            top_p: req.customConfig?.topP,
            stop_sequences: req.customConfig?.stopSequences,
        };

        if (req.tools) {
            anthropicRequest.tools = this.convertToolsToAnthropicFormat(req.tools);
        }

        try {
            const result = await this.anthropic.messages.create(anthropicRequest);
            return this.convertAnthropicResponseToAIModelOutput(result);
        } catch (error) {
            console.error('Error generating content:', error);
            throw error;
        }
    }

    private convertToolsToAnthropicFormat(tools: IAIToolDeclaration[]): Tool[] {
        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.parameters as any // Anthropic expects a JSONSchema object
        }));
    }
}