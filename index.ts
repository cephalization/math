#!/usr/bin/env bun

import { init } from "./src/commands/init";
import { run } from "./src/commands/run";
import { status } from "./src/commands/status";
import { iterate } from "./src/commands/iterate";
import { plan } from "./src/commands/plan";
import { DEFAULT_MODEL } from "./src/constants";

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function printHelp() {
  console.log(`
${colors.bold}math${colors.reset} - Multi-Agent Todo Harness

A light meta agent orchestration harness designed to coordinate multiple AI 
agents working together to accomplish tasks from a TODO list.

${colors.bold}USAGE${colors.reset}
  math <command> [options]

${colors.bold}COMMANDS${colors.reset}
  ${colors.cyan}init${colors.reset}      Create todo/ directory with template files
  ${colors.cyan}plan${colors.reset}      Run planning mode to flesh out tasks
  ${colors.cyan}run${colors.reset}       Start the agent loop until all tasks complete
  ${colors.cyan}status${colors.reset}    Show current task counts
  ${colors.cyan}iterate${colors.reset}   Backup todo/ and reset for a new sprint
  ${colors.cyan}help${colors.reset}      Show this help message

${colors.bold}OPTIONS${colors.reset}
  ${colors.dim}--model <model>${colors.reset}          Model to use (default: ${DEFAULT_MODEL})
  ${colors.dim}--max-iterations <n>${colors.reset}    Safety limit (default: 100)
  ${colors.dim}--pause <seconds>${colors.reset}       Pause between iterations (default: 3)
  ${colors.dim}--no-plan${colors.reset}              Skip planning mode after init/iterate

${colors.bold}EXAMPLES${colors.reset}
  ${colors.dim}# Initialize and plan a new project${colors.reset}
  math init

  ${colors.dim}# Initialize without planning${colors.reset}
  math init --no-plan

  ${colors.dim}# Run planning mode on existing todo/${colors.reset}
  math plan

  ${colors.dim}# Run the agent loop${colors.reset}
  math run

  ${colors.dim}# Check task status${colors.reset}
  math status

  ${colors.dim}# Start a new sprint (backup current, reset, plan)${colors.reset}
  math iterate
`);
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        parsed[key] = next;
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }
  return parsed;
}

async function main() {
  const [command, ...rest] = Bun.argv.slice(2);
  const options = parseArgs(rest);

  try {
    switch (command) {
      case "init":
        await init({
          skipPlan: !!options["no-plan"],
          model: options.model as string,
        });
        break;
      case "plan":
        await plan(options);
        break;
      case "run":
        await run(options);
        break;
      case "status":
        await status();
        break;
      case "iterate":
        await iterate({
          skipPlan: !!options["no-plan"],
          model: options.model as string,
        });
        break;
      case "help":
      case "--help":
      case "-h":
      case undefined:
        printHelp();
        break;
      default:
        console.error(
          `${colors.red}Unknown command: ${command}${colors.reset}`
        );
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(
      `${colors.red}Error: ${error instanceof Error ? error.message : error}${
        colors.reset
      }`
    );
    process.exit(1);
  }
}

main();
