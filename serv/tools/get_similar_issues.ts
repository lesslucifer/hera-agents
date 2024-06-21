import axios from "axios";
import { ITool } from ".";
import ENV from "../../glob/env";
import hera from "../../utils/hera";
import _ from "lodash";
import { Content, GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";
import { QdrantClient } from "@qdrant/qdrant-js";

export class GetSimilarIssues implements ITool {
    qdrant = new QdrantClient({ host: '127.0.0.1', port: 6333 });
    _embeddingModel: GenerativeModel

    get embeddingModel() {
        return this._embeddingModel ?? (
            this._embeddingModel = new GoogleGenerativeAI(ENV.GEMINI_KEY).getGenerativeModel({
                model: "text-embedding-004"
            }, { apiVersion: "v1beta" })
        )
    }

    readonly name: string = GetSimilarIssues.name;
    readonly description = {
        "name": GetSimilarIssues.name,
        "description": "Getting the key of similar JIRA issues from a text content within a project",
        "parameters": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "The content of the query"
                },
                "project": {
                    "type": "string",
                    "description": "The key of the project"
                }
            },
            "required": ["content", "project"]
        }
    }

    async apply(content: string, project: string): Promise<Content> {
        const { embedding } = await this.embeddingModel.embedContent(content)

        const results = await this.qdrant.search(project, {
            vector: embedding.values,
            limit: 10
        })

        return {
            role: "function",
            parts: [
                {
                    functionResponse: {
                        name: this.name,
                        response: {
                            issueKeys: results.map(r => r.payload.key)
                        }
                    }
                }
            ]
        }
    }

}