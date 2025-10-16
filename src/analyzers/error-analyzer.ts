import { Project, SyntaxKind, ClassDeclaration } from 'ts-morph';
import { ErrorContext, ErrorFlow, CoverageReport, TypedErrorInfo } from '../types/index.js';

export class ErrorAnalyzer {
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

  analyzeFileErrors(filePath: string): ErrorContext {
    const sourceFile = this.project.getSourceFile(filePath);
    if (!sourceFile) {
      throw new Error(`Source file not found: ${filePath}`);
    }

    const defined = this.findDefinedErrors(filePath);
    const thrown = this.findThrownErrors(filePath);
    const caught = this.findCaughtErrors(filePath);

    return { defined, thrown, caught };
  }

  private findDefinedErrors(filePath: string): TypedErrorInfo[] {
    const sourceFile = this.project.getSourceFile(filePath);
    if (!sourceFile) return [];

    const errors: TypedErrorInfo[] = [];

    sourceFile.getClasses().forEach(cls => {
      // Check if class extends Error or TypedError
      const heritage = cls.getExtends();
      if (heritage && this.isErrorClass(heritage.getText())) {
        errors.push({
          name: cls.getName() || 'AnonymousError',
          type: heritage.getText(),
          location: {
            file: filePath,
            line: cls.getStartLineNumber(),
          },
        });
      }
    });

    return errors;
  }

  private findThrownErrors(filePath: string): TypedErrorInfo[] {
    const sourceFile = this.project.getSourceFile(filePath);
    if (!sourceFile) return [];

    const errors: TypedErrorInfo[] = [];

    sourceFile.getDescendantsOfKind(SyntaxKind.ThrowStatement).forEach(throwStmt => {
      const expression = throwStmt.getExpression();
      if (!expression) return;

      // Handle: throw new ErrorClass()
      if (expression.getKind() === SyntaxKind.NewExpression) {
        const newExpr = expression.asKindOrThrow(SyntaxKind.NewExpression);
        const errorName = newExpr.getExpression().getText();

        errors.push({
          name: errorName,
          type: 'thrown',
          location: {
            file: filePath,
            line: throwStmt.getStartLineNumber(),
          },
        });
      }
      // Handle: throw error
      else if (expression.getKind() === SyntaxKind.Identifier) {
        const errorName = expression.getText();
        errors.push({
          name: errorName,
          type: 'rethrown',
          location: {
            file: filePath,
            line: throwStmt.getStartLineNumber(),
          },
        });
      }
    });

    return errors;
  }

  private findCaughtErrors(filePath: string): TypedErrorInfo[] {
    const sourceFile = this.project.getSourceFile(filePath);
    if (!sourceFile) return [];

    const errors: TypedErrorInfo[] = [];

    sourceFile.getDescendantsOfKind(SyntaxKind.CatchClause).forEach(catchClause => {
      const variableDecl = catchClause.getVariableDeclaration();
      if (!variableDecl) return;

      const errorType = variableDecl.getType().getText();
      const errorName = variableDecl.getName();

      // Check if there's type guard or instanceof check
      const catchBlock = catchClause.getBlock();
      catchBlock?.getDescendantsOfKind(SyntaxKind.BinaryExpression).forEach(binExpr => {
        if (binExpr.getOperatorToken().getText() === 'instanceof') {
          const rightSide = binExpr.getRight().getText();
          errors.push({
            name: rightSide,
            type: errorType,
            location: {
              file: filePath,
              line: catchClause.getStartLineNumber(),
            },
          });
        }
      });

      // If no instanceof check, just record generic catch
      if (errors.length === 0) {
        errors.push({
          name: errorName,
          type: errorType,
          location: {
            file: filePath,
            line: catchClause.getStartLineNumber(),
          },
        });
      }
    });

    return errors;
  }

  analyzeErrorFlow(errorName: string): ErrorFlow {
    let definedIn = '';
    const thrownIn: string[] = [];
    const caughtIn: string[] = [];
    const uncaughtIn: string[] = [];

    this.project.getSourceFiles().forEach(sourceFile => {
      const filePath = sourceFile.getFilePath();

      // Find where error is defined
      sourceFile.getClasses().forEach(cls => {
        if (cls.getName() === errorName) {
          definedIn = filePath;
        }
      });

      // Find where error is thrown
      sourceFile.getDescendantsOfKind(SyntaxKind.ThrowStatement).forEach(throwStmt => {
        const expression = throwStmt.getExpression();
        if (expression?.getText().includes(errorName)) {
          thrownIn.push(filePath);
        }
      });

      // Find where error is caught
      sourceFile.getDescendantsOfKind(SyntaxKind.CatchClause).forEach(catchClause => {
        const catchBlock = catchClause.getBlock();
        catchBlock?.getDescendantsOfKind(SyntaxKind.BinaryExpression).forEach(binExpr => {
          if (
            binExpr.getOperatorToken().getText() === 'instanceof' &&
            binExpr.getRight().getText() === errorName
          ) {
            caughtIn.push(filePath);
          }
        });
      });
    });

    // Find files that throw but don't catch
    thrownIn.forEach(file => {
      if (!caughtIn.includes(file)) {
        uncaughtIn.push(file);
      }
    });

    return {
      error: errorName,
      definedIn,
      thrownIn: [...new Set(thrownIn)],
      caughtIn: [...new Set(caughtIn)],
      uncaughtIn: [...new Set(uncaughtIn)],
    };
  }

  generateCoverageReport(): CoverageReport {
    const allErrors = new Set<string>();
    const errorFlows: ErrorFlow[] = [];

    // Collect all error classes
    this.project.getSourceFiles().forEach(sourceFile => {
      sourceFile.getClasses().forEach(cls => {
        const heritage = cls.getExtends();
        if (heritage && this.isErrorClass(heritage.getText())) {
          const errorName = cls.getName();
          if (errorName) {
            allErrors.add(errorName);
          }
        }
      });
    });

    // Analyze flow for each error
    allErrors.forEach(errorName => {
      errorFlows.push(this.analyzeErrorFlow(errorName));
    });

    // Calculate coverage
    const totalErrors = errorFlows.length;
    const coveredErrors = errorFlows.filter(flow => flow.caughtIn.length > 0).length;
    const uncoveredErrors = totalErrors - coveredErrors;
    const percentage = totalErrors > 0 ? (coveredErrors / totalErrors) * 100 : 0;

    const details = errorFlows.map(flow => ({
      error: flow.error,
      coverage: flow.thrownIn.length > 0 ? (flow.caughtIn.length / flow.thrownIn.length) * 100 : 0,
      riskyFiles: flow.uncaughtIn,
    }));

    return {
      totalErrors,
      coveredErrors,
      uncoveredErrors,
      percentage: Math.round(percentage),
      details,
    };
  }

  private isErrorClass(className: string): boolean {
    const errorClasses = ['Error', 'TypedError', 'TypeError', 'RangeError', 'ReferenceError'];
    return errorClasses.some(errClass => className.includes(errClass));
  }
}
