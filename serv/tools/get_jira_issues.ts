import { Content } from "@google/generative-ai";
import axios from "axios";
import { ITool } from ".";
import ENV from "../../glob/env";

export class GetJiraIssuesTool implements ITool {
    readonly name: string = GetJiraIssuesTool.name;
    readonly description = {
        "name": "GetJiraIssuesTool",
        "description": "Getting batch JIRA issues from ticket keys (MAX: 100)",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "ticketKeys": {
                    "type": "ARRAY",
                    "items": {
                        "type": "STRING"
                    }
                }
            },
            "required": [
                "ticketKeys"
            ]
        }
    }

    async apply(tickets: string[]): Promise<Content> {
        const jql = Object.entries({
            'jql': `key in (${tickets.join(', ')})`,
            'maxResults': 100,
        }).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
        const url = `https://workforceoptimizer.jira.com/rest/api/latest/search?${jql}`
        const resp = await axios.get(url, {
            headers: {
                'Authorization': ENV.JIRA_KEY
            }
        })

        return {
            role: "function",
            parts: [
                {
                    functionResponse: {
                        name: this.name,
                        response: {
                            issues: JSON.stringify(resp.data)
                        }
                    }
                }
            ]
        }
    }

}