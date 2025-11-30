import { Project, SyntaxKind, Node } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import { ModuleIR, ImportEntry, ExportEntry } from './types/ir';

export async function parseTSFile(file: string,
  workspaceRoot?: string): Promise<ModuleIR> {
  const start = Date.now();

  // 如果 workspaceRoot 存在且是绝对路径，就作为路径拼接基准，否则回退到文件所在目录
  const rootDir =
    workspaceRoot && path.isAbsolute(workspaceRoot)
      ? workspaceRoot
      : path.dirname(file);

  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const source = project.addSourceFileAtPath(file);

  // 只负责把相对导入解析成「真实文件绝对路径」
  // spec: './helper', './pkg', '../x' 等
  // fromFile: 当前文件绝对路径
  function resolveImport(spec: string): string | undefined {
    if (!spec) { return undefined; }

    // 只解析相对路径；npm 包等不进图
    if (!spec.startsWith('./') && !spec.startsWith('../')) {
      return undefined;
    }

    const base = path.isAbsolute(spec)
      ? spec
      : path.resolve(rootDir, spec);

    const isFile = (p: string): boolean =>
      fs.existsSync(p) && fs.statSync(p).isFile();

    // ① 如果写的是带后缀的文件名，比如 './helper.ts'
    if (isFile(base)) {
      return base;
    }

    // ② 尝试常见扩展名
    const exts = ['.ts', '.tsx', '.js', '.jsx'];
    for (const ext of exts) {
      const p = base + ext;
      if (isFile(p)) {
        return p;
      }
    }

    // ③ 如果 base 是目录，则尝试目录下的 index.*
    if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
      for (const ext of exts) {
        const p = path.join(base, 'index' + ext);
        if (isFile(p)) {
          return p;
        }
      }
    }

    // 找不到就算了，不影响其它语言
    return undefined;
  }

  const imports: ImportEntry[] = [];

  // ① 处理 ES Module imports
  source.getImportDeclarations().forEach((im) => {
    const spec = im.getModuleSpecifierValue();

    const named = im.getNamedImports().map((n) => n.getName());
    const hasDefault = !!im.getDefaultImport();

    const specifiers =
      named.length > 0
        ? named
        : hasDefault
          ? ['default']
          : [];

    const resolved = resolveImport(spec);

    imports.push({
      source: spec,
      specifiers,
      resolved,
    });
  });

  // ② 处理 require(...) 调用
  source
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .forEach((call) => {
      const expr = call.getExpression();
      if (expr.getText() !== 'require') { return; }

      const args = call.getArguments();
      if (args.length !== 1) { return; }

      const arg = args[0];
      if (!Node.isStringLiteral(arg)) { return; }

      const spec = arg.getLiteralText();
      const resolved = resolveImport(spec);

      imports.push({
        source: spec,
        specifiers: [], // 对图来说不区分 default/named
        resolved,
      });
    });

  // TODO: 如有需要可在这里做一下去重（可选，不去重也只是一条边重复）
  // 例如按 `${source}|${resolved}` 建个 Set 过滤

  // collected export symbols
  const exported = source.getExportedDeclarations();
  const exports: ExportEntry[] = [];

  exported.forEach((decls, name) => {
    const d = decls[0];
    if (!d) {
      return;
    }

    // 推断导出类型
    let kind: ExportEntry['type'] = 'var';
    if (Node.isFunctionDeclaration(d) || Node.isMethodDeclaration(d)) {
      kind = 'function';
    } else if (Node.isClassDeclaration(d)) {
      kind = 'class';
    } else if (Node.isVariableDeclaration(d)) {
      kind = 'var';
    }

    // 找到用于定位的节点（优先名字节点）
    const nameNode: Node | undefined =
      (Node.isFunctionDeclaration(d) || Node.isClassDeclaration(d) || Node.isInterfaceDeclaration(d))
        ? (d).getNameNode?.()
        : Node.isVariableDeclaration(d)
          ? d.getNameNode()
          : undefined;

    const targetNode = (nameNode as Node) || d;
    const pos = source.getLineAndColumnAtPos(targetNode.getStart());

    exports.push({
      name,
      type: kind,
      loc: {
        line: pos.line,      // ts-morph 已是 1-based
        column: pos.column,  // column 也是从 1 开始，这里保持即可
      },
    });
  });

  const loc = source.getEndLineNumber();

  console.log('from *parse_ts.ts* [server][ts] imports', {
    file,
    imports: JSON.stringify(imports),
  });

  return {
    file, // 已是绝对路径（analyzer 里传进来的）
    lang: file.endsWith('.ts') || file.endsWith('.tsx') ? 'ts' : 'js',
    imports,
    exports,
    meta: { parseMs: Date.now() - start, loc, cacheHit: false },
  };
}
