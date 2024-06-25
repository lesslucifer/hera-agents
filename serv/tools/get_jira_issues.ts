import { Content } from "@google/generative-ai";
import axios from "axios";
import { ITool } from ".";
import ENV from "../../glob/env";
import _ from "lodash";

interface JiraIssueExtractField {
    name: string
    field?: string
    expand?: string[]
    defaultContent?: any
    f?: (iss: any) => any
}

const IssueExtractFields: _.Dictionary<JiraIssueExtractField> = _.keyBy([
    { name: "ID", field: "id" },
    { name: "Key", field: "key" },
    { name: "Priority", field: "fields.priority.name" },
    { name: "Labels", f: iss => _.get(iss, 'fields.labels')?.join(',') || '' },
    { name: "Type", field: "fields.issuetype.name" },
    { name: "Title", field: "fields.summary" },
    { name: "Description", f: iss => _.get(iss, 'fields.description')?.slice(0, 1500) || '' },
    { name: "Story Points", f: iss => _.get(iss, 'fields.customfield_10033') ?? 0 },
    { name: "Developers", f: getIssueDevelopers, expand: ['changelog'], defaultContent: 'None' },
    { name: "Comments", f: getComments, defaultContent: 'None' },
    // { name: "Assignee", field: 'fields.assignee.displayName' },
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

function getComments(iss: any) {
    const comments: any[] = _.get(iss, 'fields.comment.comments', [])
    return comments.map(cm => `[${cm?.created}]${cm?.author?.displayName}(id=${cm?.author?.accountId}): ${cm?.body}`).join('\n')
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
        const extractFields = this.getFields(fields)
        const expand = extractFields.flatMap(f => f.expand ?? []).join(',')
        let issues = []
        try {
            const jql = Object.entries({
                'jql': `key in (${keys.join(', ')})`,
                ...(expand ? { 'expand': expand } : {}),
                'maxResults': 100,
                'fields': '*all'
            }).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
            const url = `https://workforceoptimizer.jira.com/rest/api/latest/search?${jql}`
            console.log(url)
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
                            issues: issues.map(issue => this.extractIssueContent(issue, extractFields))
                        }
                    }
                }
            ]
        }
    }

    private getFields(fields?: string[]) {
        if (!fields?.length) {
            fields = ['Key', 'Title', 'Description']
        }
        if (!fields.includes('Key')) {
            fields = ['Key', ...fields]
        }
        if (!fields.includes('project')) {
            fields = ['project', ...fields]
        }

        return fields.filter(f => !!IssueExtractFields[f]).map(f => IssueExtractFields[f])
    }
    
    private extractIssueContent(issue: any, fields: JiraIssueExtractField[]) {
        return fields.map(f => {
            const content = (f.f ? f.f(issue) : f.field ? _.get(issue, f.field) : '') || (f.defaultContent ?? '')
            return content && `${f.name}: ${content}`
        }).join('\n')
    }
}