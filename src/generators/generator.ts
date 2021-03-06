import { GeneratorType } from '../flags';

export abstract class BuildFileGenerator {
  /**
   * Run any validation rules here on the current flags or workspace
   * If an error is thrown then the message is printed to the user and the generator exits with code 1,
   * If false is returned then a generic error is shown and the process exits with code 1.
   */
  public validate(): boolean {
    return true;
  }

  /**
   * Run the generator
   */
  public abstract async generate(): Promise<void>;

  /**
   * Get the type of generator this is
   */
  public abstract getGeneratorType(): GeneratorType;

  /**
   * Return if this generator supports directories
   */
  public abstract supportsDirectories(): boolean;
}