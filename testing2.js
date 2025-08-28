// modules
import { dir } from 'console';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {existsSync,
        lstatSync, 
        mkdirSync, 
        readdirSync, 
        readFileSync, mkdir} from 'fs';
import * as tar from 'tar';


// helpers

/** delete me later
 * 1. open file and store as xml string
 * -> ensure can open file
 * 2. parse string via xml parser 
 * -> validate first
 */
// parse XML:dd

const dirExistsCheck = path => {
    if (!existsSync(path)) {
        console.log(`file/directory at location ${path} does not exist`);
        process.exit(1); 
    }
    return true;
}

const parseXML = path =>{
    const XMLData = readFileSync(path,'utf-8');

    const options = {
        allowBooleanAttributes: true,
        ignoreAttributes:false
    }

    const isValidXML = XMLValidator.validate(XMLData);

    if (!isValidXML) {
        console.log(`file at location ${path} does not contain valid xml`);
        process.exit(1);
    }
    
    const parser = new XMLParser(options);
    return parser.parse(XMLData);
}


// from: path containing archive
// to:   path to extract contents to
const extractTar = (from,to) =>{
    tar.extract({
        f:from,
        cwd:to
    });
}

const isDir = path => lstatSync(path).isDirectory();

const createFileEntry = (path,flnm) => {
    const flext = flnm.substring(flnm.indexOf('.'));
    // generic layout of a file object
    const subEntry = {
        name:flnm,
        type:'file',
        extension:flext
    };

    return (flext === '.xml') ? 
        {...subEntry,contents:parseXML(path)} : // if the file is an xml
        subEntry;                               // not an xml file
}

// ~~~ !!! could be a problematic function  
// creates a JSON containing the file structure of a given directory
const generateFileTree = (path) =>{
    const files = readdirSync(path);

    const genNext = (p,f) => 
        (isDir(p)) ? 
            {name:f,type:'dir',children:generateFileTree(p)} :
            createFileEntry(p,f);
    
    return files.map(file => genNext(`${path}/${file}`,file));
}

// spits out the name of the file without extension or parent directories
const sanitizePath = path =>{
    const firstCut = path.lastIndexOf('/');
    const lastCut = path.indexOf('.');

    return path.substring(firstCut+1,lastCut);
}

const processCoursesSync = (pathIn,pathOut='tempdir') =>{
    if(!isDir(pathIn)){ // pathIn is a file
        const subDirName = sanitizePath(pathIn);      // filename
        const subPathOut = `${pathOut}/${subDirName}`;// for readability
        if (!existsSync(subPathOut)){
           mkdirSync(subPathOut);
        }

        extractTar(pathIn,subPathOut);
    } else {
        const pathInContents = readdirSync(pathIn);
        pathInContents.forEach(item => processCoursesSync(`${pathIn}/${item}`,pathOut));
    }
}

/**
 * topdir
 * -> subdir
 * --> file1
 * --> file2
 * --> ssubdir
 * ---> ...
 * -> subdir2
 */
// ft = json
const drawFileTree = ft => {
    const subfn = f => { 
        if (f.type === 'dir'){
            console.log(`->${f.name}\n-`)
            drawFileTree(f.children);
        } else {
            console.log(`->${f.name}`)
        }
    }   

    ft.forEach(f=>subfn(f));
}

const fn = async (x) => {
    await mkdir('tempdir');
    await processCoursesSync(x);
    const fileTree = await generateFileTree('tempdir');
    console.log(fileTree[0].children[0].children);
}

function main(){
    const args = process.argv.slice(2);

    const inputCourses = args[0];   // in the form of an xml file
    const outputCourses = args[1];  // in the form of a directory

    // check that both of these exist
    dirExistsCheck(inputCourses);
    dirExistsCheck(outputCourses);
    
    if (!existsSync('tempdir')){
        mkdirSync('tempdir');
    }
    //processCoursesSync(inputCourses);

    fn(inputCourses);
}
// dirin => temp => dirout
// dirin/exmp.tar.gz => temp/exmp/... => dirout/exmp/exmp.md
main();
//main();