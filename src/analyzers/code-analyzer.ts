import { Project, SourceFile, SyntaxKind } from 'ts-morph';
import { FileContext } from '../types/index.js';
import * as path from 'path';

export class CodeAnalyzer {
  private project: Project;

  constructor(tsConfigPath?: string) {
    this.project = new Project({
      tsConfigFilePath: tsConfigPath,
      skipAddingFilesFromTsConfig: !tsConfigPath,
    });
  }

  addSourceFile(filePath: string): void {
    this.project.addSourceFileAtPath(filePath);
  }

  analyzeDependencies(filePath: string): Partial<FileContext> {
    const sourceFile = this.project.getSourceFile(filePath);
    if (!sourceFile) {
      throw new Error(`Source file not found: ${filePath}`);
    }

    const imports = this.getImports(sourceFile);
    const importedBy = this.getImportedBy(filePath);

    return {
      dependencies: {
        imports,
        importedBy,
      },
    };
  }

  private getImports(sourceFile: SourceFile): string[] {
    const imports: string[] = [];

    // Get import declarations
    sourceFile.getImportDeclarations().forEach(importDecl => {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();

      // Resolve relative imports to absolute paths
      if (moduleSpecifier.startsWith('.')) {
        const resolvedPath = path.resolve(
          path.dirname(sourceFile.getFilePath()),
          moduleSpecifier
        );
        imports.push(resolvedPath);
      } else {
        imports.push(moduleSpecifier);
      }
    });

    // Get require() calls
    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
      const expression = call.getExpression();
      if (expression.getText() === 'require') {
        const args = call.getArguments();
        if (args.length > 0) {
          const arg = args[0];
          if (arg.getKind() === SyntaxKind.StringLiteral) {
            imports.push(arg.getText().replace(/['"]/g, ''));
          }
        }
      }
    });

    return [...new Set(imports)]; // Remove duplicates
  }

  private getImportedBy(filePath: string): string[] {
    const importedBy: string[] = [];
    const normalizedPath = path.normalize(filePath);

    this.project.getSourceFiles().forEach(sourceFile => {
      const sourceFilePath = sourceFile.getFilePath();
      if (sourceFilePath === normalizedPath) return;

      sourceFile.getImportDeclarations().forEach(importDecl => {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();

        if (moduleSpecifier.startsWith('.')) {
          const resolvedPath = path.resolve(
            path.dirname(sourceFilePath),
            moduleSpecifier
          );

          if (path.normalize(resolvedPath) === normalizedPath) {
            importedBy.push(sourceFilePath);
          }
        }
      });
    });

    return [...new Set(importedBy)];
  }

  findFunctionDefinition(functionName: string): { file: string; line: number } | null {
    for (const sourceFile of this.project.getSourceFiles()) {
      // Check function declarations
      const funcDecl = sourceFile.getFunction(functionName);
      if (funcDecl) {
        return {
          file: sourceFile.getFilePath(),
          line: funcDecl.getStartLineNumber(),
        };
      }

      // Check arrow functions and function expressions
      const varDeclarations = sourceFile.getVariableDeclarations();
      for (const varDecl of varDeclarations) {
        if (varDecl.getName() === functionName) {
          const initializer = varDecl.getInitializer();
          if (
            initializer &&
            (initializer.getKind() === SyntaxKind.ArrowFunction ||
              initializer.getKind() === SyntaxKind.FunctionExpression)
          ) {
            return {
              file: sourceFile.getFilePath(),
              line: varDecl.getStartLineNumber(),
            };
          }
        }
      }

      // Check class methods
      sourceFile.getClasses().forEach(cls => {
        const method = cls.getMethod(functionName);
        if (method) {
          return {
            file: sourceFile.getFilePath(),
            line: method.getStartLineNumber(),
          };
        }
      });
    }

    return null;
  }

  getExportedSymbols(filePath: string): string[] {
    const sourceFile = this.project.getSourceFile(filePath);
    if (!sourceFile) return [];

    const exports: string[] = [];

    // Named exports
    sourceFile.getExportDeclarations().forEach(exportDecl => {
      exportDecl.getNamedExports().forEach(namedExport => {
        exports.push(namedExport.getName());
      });
    });

    // Default exports
    const defaultExport = sourceFile.getDefaultExportSymbol();
    if (defaultExport) {
      exports.push('default');
    }

    return exports;
  }
}
