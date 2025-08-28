import { NodeHtmlMarkdown} from "node-html-markdown";
import { readFile } from "fs/promises";
const HTMLtoMD = async (path) => {
    const file = await readFile(path,{encoding:'utf-8'});
    return NodeHtmlMarkdown
        .translate(file)
        .replace(/^\s*#+\s+(.*)$/gm, '**$1**');
}
console.log(await HTMLtoMD('samplehtml.html'));