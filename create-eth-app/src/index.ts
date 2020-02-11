#!/usr/bin/env node
import chalk from "chalk";
import Commander from "commander";
import path from "path";
import prompts, { PromptObject, PromptType } from "prompts";
import updateCheck from "update-check";

import packageJson from "../package.json";
import { createEthApp } from "./createEthApp";
import { shouldUseYarn } from "./helpers/shouldUseYarn";
import { validateNpmName } from "./helpers/validatePkg";

let projectPath: string = "";

const program: Commander.Command = new Commander.Command(packageJson.name)
  .version(packageJson.version)
  .arguments("<project-directory>")
  .usage(`${chalk.green("<project-directory>")} [options]`)
  .action(name => {
    projectPath = name;
  })
  .option("--use-npm")
  .option("-e, --example <example-path>", "an example to bootstrap the app with")
  .allowUnknownOption()
  .parse(process.argv);

async function run() {
  if (typeof projectPath === "string") {
    projectPath = projectPath.trim();
  }

  if (!projectPath) {
    const res: prompts.Answers<string> = await prompts({
      initial: "my-app",
      message: "What is your project named?",
      name: "path",
      type: "text",
      validate: (name: string) => {
        const validation = validateNpmName(path.basename(path.resolve(name)));
        if (validation.valid) {
          return true;
        }
        return "Invalid project name: " + validation.problems![0];
      },
    });

    if (typeof res.path === "string") {
      projectPath = res.path.trim();
    }
  }

  if (!projectPath) {
    console.log();
    console.log("Please specify the project directory:");
    console.log(`  ${chalk.cyan(program.name())} ${chalk.green("<project-directory>")}`);
    console.log();
    console.log("For example:");
    console.log(`  ${chalk.cyan(program.name())} ${chalk.green("my-eth-app")}`);
    console.log();
    console.log(`Run ${chalk.cyan(`${program.name()} --help`)} to see all options.`);
    process.exit(1);
  }

  const resolvedProjectPath = path.resolve(projectPath);
  const projectName = path.basename(resolvedProjectPath);

  const { valid, problems } = validateNpmName(projectName);
  if (!valid) {
    console.error(
      `Could not create a project called ${chalk.red(`"${projectName}"`)} because of npm naming restrictions:`,
    );

    problems!.forEach(p => console.error(`    ${chalk.red.bold("*")} ${p}`));
    process.exit(1);
  }

  await createEthApp({
    appPath: resolvedProjectPath,
    example: (typeof program.example === "string" && program.example.trim()) || undefined,
    useNpm: !!program.useNpm,
  });
}

const update = updateCheck(packageJson).catch(() => null);

async function notifyUpdate() {
  try {
    const res = await update;
    if (res?.latest) {
      const isYarn = shouldUseYarn();

      console.log();
      console.log(chalk.yellow.bold("A new version of `create-eth-app` is available!"));
      console.log(
        "You can update by running: " +
          chalk.cyan(isYarn ? "yarn global add create-eth-app" : "npm i -g create-eth-app"),
      );
      console.log();
    }
  } catch {
    /* Ignore error */
  }
}

run()
  .then(notifyUpdate)
  .catch(async reason => {
    console.log();
    console.log("Aborting installation.");

    if (reason.command) {
      console.log(`  ${chalk.cyan(reason.command)} has failed.`);
    } else {
      console.log(chalk.red("Unexpected error. Please report it as a bug:"));
      console.log(reason);
    }
    console.log();

    await notifyUpdate();

    process.exit(1);
  });