import { parse, posix } from 'path';
import { tsquery } from '@phenomnomnominal/tsquery';
import { ExportDeclaration, Expression, ImportDeclaration, SourceFile } from 'typescript';
import { Buildozer } from '../../buildozer';
import { GeneratorType } from '../../flags';
import { Label } from '../../label';
import { fatal, log } from '../../logger';
import { Workspace } from '../../workspace';
import { BuildFileGenerator } from '../generator';

const IMPORTS_QUERY = `ImportDeclaration:has(StringLiteral)`;
const EXPORTS_QUERY = `ExportDeclaration:has(StringLiteral)`;

export class TsGenerator extends BuildFileGenerator {
  protected readonly buildozer: Buildozer;

  constructor(protected readonly workspace: Workspace) {
    super();
    this.buildozer = workspace.getBuildozer();
  }

  async generate(): Promise<void> {
    const files = this.workspace.readDirectory();
    const flags = this.workspace.getFlags();

    const tsFiles = files
      .filter(file => file.endsWith('.ts'))
      .filter(file => !(flags.ignore_spec_files && file.endsWith('.spec.ts')));

    const deps = new Set<string>();
    tsFiles
      .forEach(file => this.processFile(file, tsFiles, flags.npm_workspace_name, deps));

    const tsLibrary = this.buildozer.newTsLibraryRule(this.workspace.getLabelForPath())
      .setSrcs(tsFiles.map(path => parse(path).base))
      .addDeps(Array.from(deps));

    if (flags.ts_config_label) {
      tsLibrary.setTsconfig(flags.ts_config_label);
    }

    if (flags.default_visibility) {
      tsLibrary.setVisibility(flags.default_visibility);
    }
  }

  validate(): boolean {
    if (!this.workspace.isDirectory()) {
      fatal('Path passed to Typescript generator must be a directory');
    }

    return true;
  }

  getGeneratorType(): GeneratorType {
    return GeneratorType.TS;
  }

  supportsDirectories(): boolean {
    return true;
  }

  protected processFile(filePath: string, tsFiles: string[], npmWorkspace: string, labels: Set<string>): Set<string> {
    const file = this.workspace.readFile(filePath);
    const ast = tsquery.ast(file);

    return this.processTsFileAst(ast, tsFiles, npmWorkspace, labels);
  }

  protected processTsFileAst(ast: SourceFile, tsFiles: string[], npmWorkspace: string, labels: Set<string>): Set<string> {
    tsquery(ast, IMPORTS_QUERY)
      .map((node: ImportDeclaration) => this.resolveLabelFromModuleSpecifier(node.moduleSpecifier, tsFiles, npmWorkspace))
      .filter(label => !!label)
      .forEach(label => labels.add(label.toString()));

    tsquery(ast, EXPORTS_QUERY)
      .map((node: ExportDeclaration) => this.resolveLabelFromModuleSpecifier(node.moduleSpecifier, tsFiles, npmWorkspace))
      .filter(label => !!label)
      .forEach(label => labels.add(label.toString()));

    return labels;
  }

  private resolveLabelFromModuleSpecifier(moduleSpecifier: Expression, tsFiles: string[] = [], npmWorkspace: string): Label | undefined {
    const moduleSpecifierText = moduleSpecifier.getText().split(`'`)[1];

    const workspaceRelativeImport = this.workspace.resolveRelativeToWorkspace(moduleSpecifierText);
    if (
      tsFiles.includes(
        workspaceRelativeImport.endsWith('.ts') ? workspaceRelativeImport : workspaceRelativeImport + '.ts')
    ) {
      return;
    }

    const label = this.calculateTsDependencyLabel(moduleSpecifierText, npmWorkspace);

    if (this.workspace.getFlags().verbose_import_mappings) {
      log(`${moduleSpecifierText}=${label}`);
    }

    return label;
  }

  private calculateTsDependencyLabel(imp: string, npmWorkspace: string): Label | undefined {
    let label = this.workspace.tryResolveLabelFromStaticMapping(imp, undefined, '.');
    if (label) { return label; }

    const relative = this.workspace.isWorkspaceRelative(imp) || imp.startsWith('.');

    if (relative) {
      label = this.workspace.getLabelForFile(imp + '.ts');
      if (label) { return label; }

      throw new Error (`Unable to generate label for: ${imp}`)
    } else {
      // module specifiers do not use system seperators
      // they always use forward slashes
      const pathParts = imp.split(posix.sep);
      // remove any deep imports by stripping any paths past the end of the package name
      let reducedPathed: string;
      if(imp.startsWith('@')) {
        // a scoped npm package cannot have more than two segments
        reducedPathed = posix.join(...pathParts.slice(0, 2));
      } else {
        // a normal npm package cannot have more than one segment
        reducedPathed = posix.join(...pathParts.slice(0, 1));

      }
      return Label.parseAbsolute(`@${npmWorkspace}//${reducedPathed}`);
    }
  }

}
