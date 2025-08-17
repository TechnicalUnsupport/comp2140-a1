// modules
import { dir } from 'console';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {existsSync, lstatSync, mkdirSync, readdirSync, readFileSync} from 'fs';
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
    }

    const isValidXML = XMLValidator.validate(XMLData);

    if (!isValidXML) {
        console.log(`file at location ${path} does not contain valid xml`);
        process.exit(1);
    }
    
    const parser = new XMLParser();
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

const createFileEntry = (path,flnm) => 
    (flnm.endsWith('.xml')) ? 
        {name:flnm,type:'file',contents:parseXML(path)} :
        {name:flnm,type:'file'}

// ~~~ !!! could be a problematic function  
// creates a JSON containing the file structure of a given directory
const generateFileTree = path =>{
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

const processCourses = (pathIn,pathOut='tempdir') =>{
    if(!isDir(pathIn)){ // recursive step
        const subDirName = sanitizePath(pathIn);      // filename
        const subPathOut = `${pathOut}/${subDirName}`;// for readability
        if (!existsSync(subPathOut)){
            mkdirSync(subPathOut);
        }

        extractTar(pathIn,subPathOut);
    } else {
        const pathInContents = readdirSync(pathIn);
        pathInContents.forEach(item => processCourses(`${pathIn}/${item}`,pathOut));
    }
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
    processCourses(inputCourses);

    const fileTree = generateFileTree('tempdir');
    console.table(fileTree[0].children[0].children[2].children[1].contents);

}

// dirin => temp => dirout
// dirin/exmp.tar.gz => temp/exmp/... => dirout/exmp/exmp.md
main();