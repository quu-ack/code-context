import chalk from 'chalk';
import ora, { Ora } from 'ora';
import Table from 'cli-table3';

export class UI {
  private spinner: Ora | null = null;

  startSpinner(text: string): void {
    this.spinner = ora(text).start();
  }

  succeedSpinner(text?: string): void {
    if (this.spinner) {
      this.spinner.succeed(text);
      this.spinner = null;
    }
  }

  failSpinner(text?: string): void {
    if (this.spinner) {
      this.spinner.fail(text);
      this.spinner = null;
    }
  }

  header(text: string): void {
    console.log('\n' + chalk.bold.cyan(text));
  }

  section(title: string): void {
    console.log('\n' + chalk.bold.white(title));
  }

  info(label: string, value: string): void {
    console.log(chalk.gray(label + ':'), chalk.white(value));
  }

  success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  warning(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  error(message: string): void {
    console.log(chalk.red('✗'), message);
  }

  list(items: string[]): void {
    items.forEach(item => {
      console.log(chalk.gray('  -'), item);
    });
  }

  table(data: { [key: string]: string }[]): void {
    if (data.length === 0) return;

    const keys = Object.keys(data[0]);
    const table = new Table({
      head: keys.map(k => chalk.cyan(k)),
      style: {
        head: [],
        border: ['gray']
      }
    });

    data.forEach(row => {
      table.push(keys.map(k => row[k]));
    });

    console.log(table.toString());
  }

  divider(): void {
    console.log(chalk.gray('─'.repeat(50)));
  }

  newline(): void {
    console.log();
  }
}

export const ui = new UI();
