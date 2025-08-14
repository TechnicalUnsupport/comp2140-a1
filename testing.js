// generate an object containing all subdirectories and files in a directory
import {lstatSync, readdirSync} from 'fs';

const direx = {
    name:"dir1",
    type:"dir",
    children:[
        {name: "file1",type:"file"},
        {name: "file2",type:"file"},
        {name:"subdir1",type:"dir",children:[
            {name: "subfile1",type:"file"}
        ]}
    ]
}

const rootDir = {
    name:"root",
    type:"dir",
    children:[]
}


// obj -> fn() -> new obj

const isDir = path => lstatSync(path).isDirectory();

const printTree = path => {
    readdirSync(path).forEach(file => {
        if (isDir(`${path}/${file}`)){
            console.log(file);
            printTree(`${path}/${file}`);
        } else {
            console.log(`-> ${file}`);
        }
    });   
}
// 1. start empty
// 2. add first child 
// 3. is dir? -> 2. -



const generateTree = path =>{
    const files = readdirSync(path);

    const helperfn = (p,f) => 
        (isDir(p)) ? 
        {name:f,type:'dir',children:generateTree(p)} : 
        {name:f,type:'file'};
    return files.map(file => helperfn(`${path}/${file}`,file));
}



const p = 'testout';
const pc = a =>{
    a[0].children.forEach(f=>console.log(f));
}

//console.log(generateTree(p)[0].children[0]);
pc(generateTree(p));