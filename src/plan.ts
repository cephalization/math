import { createInterface } from "node:readline/promises";
import { join } from "node:path";
import { DEFAULT_MODEL } from "./constants";

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

const CLARIFY_PROMPT = `You are a planning assistant. Before creating a task plan, you need to gather context.

Analyze the user's goal and the project structure, then ask 3-5 clarifying questions that would help you create a better plan.

Format your response EXACTLY like this:

QUESTIONS:
1. [Your first question]
2. [Your second question]
3. [Your third question]
...

Guidelines for questions:
- Ask about ambiguous requirements
- Ask about preferences (e.g., testing framework, code style)
- Ask about scope and priorities
- Ask about constraints or existing patterns to follow
- Don't ask questions you can answer by examining the codebase

If the goal is crystal clear and you have no questions, respond with:
QUESTIONS:
NONE`;

const PLAN_PROMPT = `You are a planning assistant helping to break down a project goal into actionable tasks.

## Step 1: Discover Project Tooling

FIRST, examine the project to understand its technology stack:
- Look for package.json, Cargo.toml, go.mod, pyproject.toml, Makefile, etc.
- Identify the test runner (e.g., bun test, npm test, cargo test, pytest, go test)
- Identify the build system (e.g., bun build, npm run build, cargo build, make)
- Identify the linter/formatter (e.g., eslint, prettier, rustfmt, black)
- Note any existing scripts or commands defined in the project

## Step 2: Plan the Tasks

Break the user's goal into discrete, implementable tasks using this format:

### task-id
- content: Clear description of what to implement
- status: pending
- dependencies: comma-separated task IDs or "none"

Guidelines:
- Tasks should be small enough for one focused work session
- Use kebab-case for task IDs (e.g., setup-database, add-auth)
- Order tasks logically with proper dependencies
- Group related tasks into phases with markdown headers
- Each task should have a clear, testable outcome
- Reference the PROJECT'S test/build commands, not generic ones

## Step 3: Update PROMPT.md Quick Reference

Update the "Quick Reference" table in PROMPT.md with project-specific commands:
- Replace generic commands with the actual commands for THIS project
- Include test, build, lint, and any other relevant commands
- Keep the table format intact

Example transformations:
- "bun test" -> project's actual test command
- "npm run build" -> project's actual build command

## Step 4: Summarize

After updating both files, briefly summarize:
- What tasks were planned
- What project tooling was discovered
- Any assumptions made`;

/**
 * Parse questions from the AI's response.
 * Expects format: "QUESTIONS:\n1. Question one\n2. Question two\n..."
 */
function parseQuestions(output: string): string[] {
  const questionsMatch = output.match(
    /QUESTIONS:\s*([\s\S]*?)(?:$|(?=\n\n[A-Z]))/i
  );
  if (!questionsMatch?.[1]) return [];

  const questionsBlock = questionsMatch[1].trim();
  if (questionsBlock.toUpperCase() === "NONE") return [];

  // Extract numbered questions
  const questions = questionsBlock
    .split(/\n/)
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter((line) => line.length > 0);

  return questions;
}

export async function runPlanningMode({
  todoDir,
  options,
}: {
  todoDir: string;
  options: { model?: string; quick?: boolean };
}): Promise<void> {
  const model = options.model || DEFAULT_MODEL;
  const skipQuestions = options.quick || false;

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log();
  console.log(`${colors.magenta}${colors.bold}Planning Mode${colors.reset}`);
  console.log(
    `${colors.dim}Let's break down your goal into actionable tasks.${colors.reset}`
  );
  console.log();

  try {
    const goal = await rl.question(
      `${colors.cyan}What would you like to accomplish?${colors.reset}\n> `
    );

    if (!goal.trim()) {
      console.log(
        `${colors.yellow}No goal provided. Skipping planning.${colors.reset}`
      );
      console.log(
        `You can run planning later with: ${colors.cyan}math plan${colors.reset}`
      );
      rl.close();
      return;
    }

    const tasksPath = join(todoDir, "TASKS.md");
    const promptPath = join(todoDir, "PROMPT.md");
    const learningsPath = join(todoDir, "LEARNINGS.md");

    let clarifications = "";

    // Phase 1: Gather clarifying questions (unless --quick)
    if (!skipQuestions) {
      console.log();
      console.log(
        `${colors.dim}Analyzing your goal and gathering context...${colors.reset}`
      );

      const clarifyPrompt = `${CLARIFY_PROMPT}

USER'S GOAL:
${goal}`;

      const clarifyResult =
        await Bun.$`opencode run -m ${model} ${clarifyPrompt} -f ${tasksPath} -f ${promptPath} --title ${
          "Planning: " + goal.slice(0, 40)
        }`.text();

      const questions = parseQuestions(clarifyResult);

      if (questions.length > 0) {
        console.log();
        console.log(
          `${colors.cyan}${colors.bold}A few questions to help create a better plan:${colors.reset}`
        );
        console.log();

        const answers: string[] = [];
        for (let i = 0; i < questions.length; i++) {
          const question = questions[i];
          console.log(`${colors.bold}${i + 1}. ${question}${colors.reset}`);
          const answer = await rl.question(`${colors.dim}> ${colors.reset}`);
          answers.push(`Q: ${question}\nA: ${answer || "(skipped)"}`);
          console.log();
        }

        clarifications = `
CLARIFICATIONS FROM USER:
${answers.join("\n\n")}`;
      } else {
        console.log(
          `${colors.dim}No clarifying questions needed.${colors.reset}`
        );
      }
    }

    rl.close();

    // Phase 2: Generate the plan (continue session if we asked questions)
    console.log();
    console.log(`${colors.dim}Generating task plan...${colors.reset}`);
    console.log();

    const planPrompt = `${PLAN_PROMPT}

USER'S GOAL:
${goal}
${clarifications}

Read the attached files and update TASKS.md with a well-structured task list for this goal.`;

    // If we asked questions, continue the session; otherwise start fresh
    const result =
      !skipQuestions && clarifications
        ? await Bun.$`opencode run -c -m ${model} ${planPrompt} -f ${tasksPath} -f ${promptPath} -f ${learningsPath}`
        : await Bun.$`opencode run -m ${model} ${planPrompt} -f ${tasksPath} -f ${promptPath} -f ${learningsPath}`;

    if (result.exitCode === 0) {
      console.log();
      console.log(`${colors.green}✓${colors.reset} Planning complete!`);
      console.log();
      console.log(`${colors.bold}Next steps:${colors.reset}`);
      console.log(
        `  1. Review ${colors.cyan}todo/TASKS.md${colors.reset} to verify the plan`
      );
      console.log(
        `  2. Run ${colors.cyan}math run${colors.reset} to start executing tasks`
      );
    } else {
      console.log(
        `${colors.yellow}Planning completed with warnings. Check todo/TASKS.md${colors.reset}`
      );
    }
  } catch (error) {
    rl.close();
    if ((error as Error).message?.includes("opencode")) {
      console.log(
        `${colors.yellow}OpenCode not available. Skipping planning.${colors.reset}`
      );
      console.log(
        `Install OpenCode: ${colors.cyan}curl -fsSL https://opencode.ai/install | bash${colors.reset}`
      );
    } else {
      throw error;
    }
  }
}

export async function askToRunPlanning(): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(
      `\n${colors.cyan}Would you like to plan your tasks now?${colors.reset} (Y/n) `
    );
    rl.close();
    return answer.toLowerCase() !== "n";
  } catch {
    rl.close();
    return false;
  }
}
