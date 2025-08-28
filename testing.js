import { readFile, writeFile} from "fs/promises";

const word = "hello \n world";
writeFile('somefile.md',word);