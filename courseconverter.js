import { XMLParser } from 'fast-xml-parser';
import {mkdir,lstat,stat,readdir, readFile} from 'fs/promises';
import * as tar from 'tar';
import { NodeHtmlMarkdown, NodeHtmlMarkdownOptions } from 'node-html-markdown';

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
            {name:f,type:'dir',children:await generateFileTree(p)} :
            {name:f,type:'file',
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
                    [nextDepth]:f.details[nextDepth]
                }
            })
    }

    const courseObj = genOLXObj('course');
    const parsedCourse = parseAtDepth('chapter','#',courseObj);
    
    const chapterArr = genOLXObj('chapter');
    const parsedChapters = parseAtDepth('sequential','##',chapterArr);

    const sequentialArr = genOLXObj('sequential');
    const parsedSequentials = parseAtDepth('vertical','###',sequentialArr);

    const verticalArr = genOLXObj('vertical');
    const parsedHtmls = parseAtDepth('html','',verticalArr);
    const parsedProblems = parseAtDepth('problem','',verticalArr);
    const parsedVideos = parseAtDepth('video','',verticalArr);
    console.log(parsedHtmls);


    // next: create a function to deal with problems
    // and videos (and other potential vertical content)
    // stitch everything together
    // write jest crap

    
}


async function main(){
    const args = process.argv.slice(2);

    const inputCourses = args[0];   // in the form of an xml file/ dir
    const outputCourses = args[1];  // in the form of a directory

    // for now we assume the user has a brain
    await mkdir('tempdir',{recursive:true});
    
    await processCourses(inputCourses);
    const fileTree = await generateFileTree('tempdir');
    await createLiaScriptFile(fileTree[0].children[0].children,outputCourses);

}

main();