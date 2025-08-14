import {mkdirSync} from 'fs';


const processCourses = (pathIn,pathOut='tempdir') =>{

    // if pathIn is a file
    if(pathIn.endsWith('.tar.gz')){
        const subDirName = sanitizePath(pathIn);      // filename
        const subPathOut = `${pathOut}/${subDirName}`;// for readability
        (existsSync(subPathOut)) ? console.log('hmm') : mkdirSync(subPathOut);                        // create the subdirectory

        extractTar(pathIn,subPathOut);
        return generateFileTree(subPathOut);
    }

    // if pathIn is a directory containing files
    const pathInContents = readdirSync(pathIn);
    return pathInContents.map(item => processCourses(`${pathIn}/${item}`,pathOut));
}

