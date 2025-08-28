import {mkdir,stat} from 'fs/promises';

const isDir = async (p) =>(await stat(p)).isDirectory();

const path = 'planning.rtf';
if (await isDir(path)){
    console.log('it is');
} else {
    console.log('it isnt');
}

const createLiaScriptFile = async (fileTree,outPath) =>
    // looking for? 
    // start with course.xml
    // assume we recieve a single course 
    const isAtt = f => f.startsWith('@_');
    const courseFile = await fileTree
        .children
        .find(f=>f.type === 'file' && f.name === 'course.xml')
        .contents;
    const wtg = Object.keys(courseFile)[0];
    const wtgu = courseFile[wtg]['@_url_name'];

    const chapters = fileTree.children
        .find(f=>f.name === wtg)
        .children
        .find(f=>f.name === `${wtgu}.xml`)
        .contents
        .course
        .chapter;
    

    console.log(chapters)

}
  