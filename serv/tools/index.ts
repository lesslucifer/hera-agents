import { IAIModelPrompt, IAIToolDeclaration } from "../models/base"

export interface IAITool<Arg extends object = object> extends IAIToolDeclaration {
    apply(arg: Arg): Promise<any>
}