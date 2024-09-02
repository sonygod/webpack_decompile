const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv)).options({
  inputfile: {
    describe: 'The path to the input JavaScript file',
    type: 'string',
    demandOption: true
  },
  save_folder: {
    describe: 'The folder to save output files',
    type: 'string',
    demandOption: true
  }
}).argv;

// 读取并解析 JavaScript 文件
const inputFilePath = path.join(__dirname, argv.inputfile);
let code, ast;
try {
  code = fs.readFileSync(inputFilePath, 'utf-8');
  ast = parse(code, { sourceType: 'module', allowImportExportEverywhere: true, tokens: true });
} catch (error) {
  console.error(`Error reading or parsing file ${inputFilePath}: ${error.message}`);
  process.exit(1);
}

// 文件名合法化
function sanitizeFilename(name) {
  return name.replace(/[\/\\:*?"<>|]/g, '_');
}

// 移除多余空行
function removeExtraEmptyLines(code) {
  return code.split('\n').filter(line => line.trim() !== '').join('\n');
}

// 保存模块代码的对象
const modules = {};

// 遍历 AST，提取模块
traverse(ast, {
  ObjectProperty(path) {
    if (path.parentPath.parent.type === 'ArrayExpression') {
      const key = path.node.key;
      const moduleName = key.type === 'StringLiteral' ? key.value : key.name;
      const moduleCode = generate(path.node.value, {
        retainLines: true,
        comments: true,
        compact: false,
        concise: false,
        retainFunctionParens: true,
        sourceMaps: false
      }, code).code;

      modules[sanitizeFilename(moduleName)] = removeExtraEmptyLines(moduleCode);
    }
  }
});

// 创建保存文件夹（如果不存在）
const saveFolderPath = path.resolve(__dirname, argv.save_folder);
try {
  if (!fs.existsSync(saveFolderPath)) {
    fs.mkdirSync(saveFolderPath, { recursive: true });
  }
} catch (error) {
  console.error(`Error creating directory ${saveFolderPath}: ${error.message}`);
  process.exit(1);
}

// 将模块保存到独立文件
Object.entries(modules).forEach(([name, cleanedCode]) => {
  const filename = `${name}.js`;
  const outputPath = path.join(saveFolderPath, filename);
  try {
    fs.writeFileSync(outputPath, cleanedCode);
    console.log(`Saved ${outputPath}`);
  } catch (error) {
    console.error(`Error writing file ${outputPath}: ${error.message}`);
  }
});
