import { XMLParser } from 'fast-xml-parser';
import {mkdir,lstat,stat,readdir, readFile, writeFile} from 'fs/promises';
import * as tar from 'tar';
import { NodeHtmlMarkdown } from 'node-html-markdown';

// helpers
const isDir = async (p) => (await lstat(p)).isDirectory();
const getFileName = p => p.replace(/.*\/|\..*\S/g,'');


const extractTar = async (from,to) => tar.x({f:from,cwd:to});

const processCourses = async (pathIn,pathOut='tempdir') => {
    if (await isDir(pathIn)){
        const pathInContents =  await readdir(pathIn);
        await Promise.all(pathInContents.map(f=>processCourses(`${pathIn}/${f}`,pathOut)));
        return;
    }
    const subDirName = getFileName(pathIn);
    const subPathOut = `${pathOut}/${subDirName}`;
    await mkdir(subPathOut,{recursive:true}); 
    await extractTar(pathIn,subPathOut);        
}

const parseXML = async (path) => {
    const XMLData = await readFile(path);
    const options = {
        allowBooleanAttributes:true,
        ignoreAttributes:false
    }

    const parser = new XMLParser(options);
    return await parser.parse(XMLData);
}


const generateFileTree = async (path) => {
    const files = await readdir(path);

    const genNext = async (p,f) => 
        (await isDir(p)) ? 
            {name:f,type:'dir',path:p,children:await generateFileTree(p)} :
            {name:f,type:'file',path:p,
                ...(f.endsWith('.xml')) && {contents:await parseXML(p)}}

    return Promise.all(files.map(f=>genNext(`${path}/${f}`,f)));
}

// look at the structure:
// course ->
// chapter/s ->
// sequential/s ->
// vertical/s ->
// content: ie. html, video, pictures, problems
// instead of banging my head against the wall and considering alcoholism,
// lets make a function for each!
const HTMLtoMD = async (path) => {
    const fileContents = await readFile(path,{encoding:'utf-8'});
    return NodeHtmlMarkdown
        .translate(fileContents)
        .replace(/^\s*#+\s+(.*)$/gm, '**$1**'); // turns headers into bold
}

const parseChoiceQuiz = (json, singlechoice=true,mcqstr='checkboxgroup') => {
    const choices = (singlechoice) ? 
        json.optioninput.option :
        json[mcqstr].choice;

    const question = json.p + json.label;
    
    const mdPre = op => (op.toLowerCase() === 'true') ?
        ((singlechoice) ? '[(x)]' : '[[x]]'):
        ((singlechoice) ? '[( )]' : '[[ ]]');

    const mdStr = choices
    .map(option=>`- ${mdPre(option['@_correct'])} ${option['#text']}`)
    .join('\n');
    return `${question}\n${mdStr}`;
}

const parseTextQuiz = (json) =>{
    const question = json.p + json.label;
    return `${question}\n\n     [[${json['@_answer']}]]`;
}

const problemToMD = async (path) => {
    const problemContent = await parseXML(path);
    const problemJson = problemContent.problem;
    if ('choiceresponse' in problemJson) return parseChoiceQuiz(problemJson.choiceresponse,false);
    if ('optionresponse' in problemJson) return parseChoiceQuiz(problemJson.optionresponse);
    if ('multiplechoiceresponse' in problemJson) return parseChoiceQuiz(problemJson.multiplechoiceresponse,false,'choicegroup');
    if ('numericalresponse' in problemJson) return parseTextQuiz(problemJson.numericalresponse);
    if ('stringresponse' in problemJson) return parseTextQuiz(problemJson.stringresponse);
}

const createLiaScriptFile = async (fileTree,outPath) => {
    const courseFile = fileTree.find(f=>f.type === 'file').contents;
    const courseName = courseFile['course']['@_course'];
    await mkdir(`${outPath}/${courseName}`,{recursive: true});

    const genOLXObj = depth => fileTree
        .filter(f=>f.name === depth)[0]
        .children
        .map(obj=>{
            return {
                uuid:obj.name,
                details:obj.contents[depth]
            }
        })

    const parseAtDepth = (nextDepth,mdPre,objArr) =>{
        return objArr
            .filter(o=>o.details[nextDepth] !== undefined)
            .map(f=>{
                const mdStr = f.details['@_display_name'];
                return {
                    uuid:getFileName(f.uuid),
                    mdStr:`${mdPre} ${mdStr}`,
                    [nextDepth]:f.details[nextDepth],
                    nextDepth:nextDepth
                }
            })
    }

    const parseVerticals = async (vertArr) =>{
        /**
         * eg.
         *  uuid: 109283012aksjdh2.xml,
         *  details: {
         *      type:{@_url_name: 9qqoweu012},
         *     '@_display_name': some name
         * 
         * }
         */
        const parseItem = async (item) => {
            const processItem = async (denom,ext,parseFn) => {
                const pth = fileTree.find(f=>f.name == denom).path + '\\';
                if (Array.isArray(item.details[denom])) return Promise.all(
                    item.details[denom]
                    .map(obj=>obj['@_url_name'] + ext)
                    .map(async itemPath => await parseFn(pth+itemPath))
                );
                const fName = item.details[denom]['@_url_name'] + ext;
                return await parseFn(pth + fName);
            }

            if ('html' in item.details) {
                return {
                    uuid:item.uuid,
                    mdStr:await processItem('html','.html',HTMLtoMD),
                    nextDepth:null
                };
            } else if('problem' in item.details) {
                return {
                    uuid:item.uuid,
                    mdStr:await processItem('problem','.xml',problemToMD),
                    nextDepth:null
                }
            } else if ('video' in item.details) {
                return {
                    uuid:item.uuid,
                    mdStr:await processItem('video','.xml',parseXML),
                    nextDepth:null
                }
            }
        }
        
        return Promise.all(vertArr.map(async (obj)=>await parseItem(obj)));
    }
    const courseObj = genOLXObj('course');
    const parsedCourse = parseAtDepth('chapter','#',courseObj);
    
    const chapterArr = genOLXObj('chapter');
    const parsedChapters = parseAtDepth('sequential','##',chapterArr);

    const sequentialArr = genOLXObj('sequential');
    const parsedSequentials = parseAtDepth('vertical','###',sequentialArr);

    const verticalArr = genOLXObj('vertical');
    const parsedVerticals =await parseVerticals(verticalArr);

    // next: create a function to deal with problems
    // and videos (and other potential vertical content)
    // stitch everything together
    // write jest crap
    const courseStruct = {
        'course':parsedCourse,
        'chapter':parsedChapters,
        'sequential':parsedSequentials,
        'vertical':parsedVerticals
    }
    const stitchItUp = (obj,currMdStr,nextDepth) => {
        if (nextDepth === null) return currMdStr;
        const nextObj = courseStruct[nextDepth];
        return nextObj.map(o=>{
            return stitchItUp(o,currMdStr+o.mdStr,o.nextDepth)
        }).join('\n');

    }
    return stitchItUp(parsedCourse[0],'','chapter');
}


async function main(){
    const args = process.argv.slice(2);

    const inputCourses = args[0];   // in the form of an xml file/ dir
    const outputCourses = args[1];  // in the form of a directory

    // for now we assume the user has a brain
    await mkdir('tempdir',{recursive:true});
    
    await processCourses(inputCourses);
    const fileTree = await generateFileTree('tempdir');
    const mdString = await createLiaScriptFile(fileTree[0].children[0].children,outputCourses);

    writeFile('somefile.md',mdString);

}

main();