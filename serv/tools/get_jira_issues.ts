import { Content } from "@google/generative-ai";
import axios from "axios";
import { ITool } from ".";
import ENV from "../../glob/env";
import _ from "lodash";

interface JiraIssueExtractField {
    name: string
    field?: string
    f?: (iss: any) => any
}

const IssueExtractFields: _.Dictionary<JiraIssueExtractField> = _.keyBy([
    { name: "ID", field: "id" },
    { name: "Priority", field: "fields.priority.name" },
    { name: "Labels", f: iss => _.get(iss, 'fields.labels')?.join(',') || '' },
    { name: "Type", field: "fields.issuetype.name" },
    { name: "Title", field: "fields.summary" },
    { name: "Description", f: iss => _.get(iss, 'fields.description')?.slice(0, 1500) || '' },
    { name: "Story Points", f: iss => _.get(iss, 'fields.customfield_10033') ?? 0 },
    { name: "Developers", f: getIssueDevelopers },
    { name: "project", field: 'fields.project.key' }
], f => f.name)

function getIssueDevelopers(iss: any) {
    const histories = _.get(iss, 'changelog.histories')
    const developers = {}
    for (const change of histories) {
        const items = change?.items ?? []
        for (const item of items) {
            if (item.field !== "status") continue
            const status = item?.toString?.toLowerCase() ?? ''
            if (status.includes('code review') || status.includes('for deployment')) {
                developers[change?.author?.accountId] = change?.author?.displayName
            }
        }
    }

    return Object.entries(developers).map(([id, name]) => `${name}(id=${id})`).join(', ')
}

export class GetJiraIssuesTool implements ITool {
    readonly name: string = "GetTicketContent"
    readonly description = {
        "name": this.name,
        "description": "Get batch content of a ticket by keys (MAX: 100)",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "keys": {
                    "type": "ARRAY",
                    "description": "list of the ticket keys",
                    "items": {
                        "type": "STRING",
                        "description": "key of the ticket"
                    }
                },
                "fields": {
                    "type": "ARRAY",
                    "description": "list of field to extract, optional",
                    "items": {
                        "type": "STRING",
                        "format": "enum",
                        "enum": Object.keys(IssueExtractFields)
                    }
                }
            },
            "required": ["keys"]
        }
    }

    async apply({ keys, fields }: { keys: string[], fields: string[] }): Promise<Content> {
        let issues = []
        try {
            const jql = Object.entries({
                'jql': `key in (${keys.join(', ')})`,
                'maxResults': 100,
            }).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
            const url = `https://workforceoptimizer.jira.com/rest/api/latest/search?${jql}`
            const resp = await axios.get(url, {
                headers: {
                    'Authorization': ENV.JIRA_KEY
                }
            })
            issues = resp.data.issues
        }
        catch (err) {
            
        }

        return {
            role: "function",
            parts: [
                {
                    functionResponse: {
                        name: this.name,
                        response: {
                            issues: issues.map(issue => this.extractIssueContent(issue, fields))
                        }
                    }
                }
            ]
        }
    }
    
    private extractIssueContent(issue: any, fields?: string[]) {
        if (!fields?.length) {
            fields = ['Title', 'Description']
        }
        return [`Key: ${_.get(issue, 'key')}`, ...fields.filter(f => !!IssueExtractFields[f]).map(f => IssueExtractFields[f]).map(f => {
            const content = f.f ? f.f(issue) : f.field ? _.get(issue, f.field) : ''
            return content && `${f.name}: ${content}`
        })].join('\n')
    }
}