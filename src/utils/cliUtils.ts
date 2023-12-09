/**
 * @author SaiForceOne
 * @description A collection of helper functions specific to the CLI
 */
// Core & third-party imports
import * as Constants from 'constants';
import chalk from 'chalk';
import path from 'node:path';
import {
  access,
  appendFile,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

// STRM Stack imports
import { ConsoleLogger } from './consoleLogger.js';
import { getProjectConfig, getSTRMCLIRoot } from './fileUtils.js';
import { LocaleManager } from '../cliHelpers/localeManager.js';
import { buildScaffoldOutput, titleCase } from './generalUtils.js';
import STRMProjectPkgFile = STRMStackCLI.STRMProjectPkgFile;
import STRMLocaleData = STRMStackCLI.STRMLocaleData;
import ScaffoldOutput = STRMStackCLI.ScaffoldOutput;
import STRMConfigFile = STRMStackCLI.STRMConfigFile;
import STRMModuleArgs = STRMStackCLI.STRMModuleArgs;
import STRMModulesFile = STRMStackCLI.STRMModulesFile;
import STRMModule = STRMStackCLI.STRMModule;
import STRMController = STRMStackCLI.STRMController;
import STRMFERoute = STRMStackCLI.STRMFERoute;
import { generateIndexPage } from '../cliHelpers/fePageHelpers/generateIndexPage.js';
import generateDetailsPage from '../cliHelpers/fePageHelpers/generateDetailsPage.js';

/**
 * @async
 * @description Reads the CLI's package.json file and returns the version or not if it fails
 * @returns {Promise<string|undefined>}
 */
export async function getCLIVersion(): Promise<string | undefined> {
  try {
    const currentUrl = import.meta.url;
    const pkgPath = path.resolve(
      path.normalize(new URL(currentUrl).pathname),
      '../../../',
      'package.json'
    );

    const pkgData = await readFile(pkgPath, {
      encoding: 'utf-8',
    });

    const parsedPkg = JSON.parse(pkgData) as STRMProjectPkgFile;

    return parsedPkg.version;
  } catch (e) {
    ConsoleLogger.printLog(`${e.message}`, 'error');
  }
}

/**
 * @function loadLocaleFile
 * @param {string} locale
 * @description Given a locale, attempts to read the corresponding locale file
 * and load the contents into the LocaleManager (singleton)
 */
export async function loadLocaleFile(locale: string) {
  try {
    const cliRoot = getSTRMCLIRoot();
    const localeFilePath = path.resolve(cliRoot, `locales/${locale}.json`);
    const localeFileData = await readFile(localeFilePath, {
      encoding: 'utf-8',
    });
    const localeData = JSON.parse(localeFileData) as STRMLocaleData;
    LocaleManager.getInstance().setLocaleData(localeData);
    LocaleManager.getInstance().setLocale(locale);
  } catch (e) {
    ConsoleLogger.printLog(`Failed to load locale file error: ${e.toString()}`);
    process.exit(1);
  }
}

/**
 * @async
 * @function checkSTRMProject
 * @param {string} projectDir the directory to be checked
 * @param {boolean} showOutput determines if the output should be shown
 * @description Checks that the target directory contains a STRM Stack Project
 * @returns {Promise<ScaffoldOutput>}
 */
export async function checkSTRMProject(
  projectDir: string,
  showOutput: boolean = false
): Promise<ScaffoldOutput> {
  const output = buildScaffoldOutput();

  try {
    // read the JSON config file
    const configPath = path.resolve(
      projectDir,
      'strm_config',
      'strm_config.json'
    );

    const configData = await readFile(configPath, { encoding: 'utf-8' });
    const parsedConfig = JSON.parse(configData) as STRMConfigFile;

    // check if project has the appropriate files and folders
    const frontendDir = `strm_fe_${parsedConfig.frontend}`;
    const PATHS = [
      frontendDir,
      `${frontendDir}/src/${parsedConfig.frontendEntryPoint}`,
      `${frontendDir}/src/pages`,
      'strm_controllers',
      'strm_models',
      'strm_modules/strm_modules.json',
      'strm_routes',
      'support/strm_hmr.py',
      'templates/app.html',
      'app.py',
      'vite.config.ts',
      'tailwind.config.ts',
    ];
    // loop over paths and check for read access
    for (const dir of PATHS) {
      await access(path.resolve(projectDir, dir), Constants.R_OK);
      if (showOutput) console.log('✔️ ', dir);
    }

    output.success = true;
    return output;
  } catch (e) {
    output.message = e.message;
    return output;
  }
}

// async function generateModuleRoutes(): Promise<ScaffoldOutput> {}

/**
 * @async
 * @function writeSTRMControllerFile
 * @description Attempts to create a controller file based on the given name.
 * @param {string} controllerName the name of the controller
 * @returns {Promise<ScaffoldOutput>} an object indicating result
 */
async function writeSTRMControllerFile(
  controllerName: string
): Promise<ScaffoldOutput> {
  const output = buildScaffoldOutput();
  const localeData = LocaleManager.getInstance().getLocaleData();
  try {
    const controllerData = `# Generated by the ${
      localeData.misc.STORM_BRANDED
    } ${new Date().toLocaleDateString()}
# Core imports
from starlette.endpoints import HTTPEndpoint
from starlette.responses import JSONResponse


class ${titleCase(controllerName)}Controller(HTTPEndpoint):
\t"""
\tAutogenerated: Represents a ${localeData.misc.STORM_BRANDED} Controller
\t"""
\tdef get(self, request):
\t\treturn JSONResponse({
\t\t\t"success": True,
\t\t\t"message": "Controller generated by the CLI. Edit 'strm_models/${controllerName}.py as needed"
\t\t})\n
`;

    const controllerFilePath = path.resolve(
      process.cwd(),
      `strm_controllers/${controllerName}_controller.py`
    );
    // write output
    await writeFile(controllerFilePath, controllerData);
    output.success = true;
    return output;
  } catch (e) {
    output.message = e.message;
    return output;
  }
}

/**
 * @async
 * @function updateSTRMModuleRouteAutoImports
 * @description given a controller name, updates the auto imports (strm_controllers/__init__.py)
 * @param {string} controllerName
 * @returns {Promise<ScaffoldOutput>} an object indicating the result of the operation
 */
async function updateSTRMModuleRouteAutoImports(
  controllerName: string
): Promise<ScaffoldOutput> {
  const output = buildScaffoldOutput();
  try {
    const autoImportPath = path.resolve(
      process.cwd(),
      `strm_controllers/__init__.py`
    );
    // append to the file
    const autoImportData = `from .${controllerName}_controller import ${titleCase(
      controllerName
    )}Controller\n`;
    await appendFile(autoImportPath, autoImportData);
    output.success = true;
    return output;
  } catch (e) {
    output.message = e.message;
    return output;
  }
}

/**
 * @function writeSTRMModelFile
 * @description given a model name, attempts to create the model file
 * @param {string} modelName the name of the model
 * @returns {Promise<ScaffoldOutput>}
 */
async function writeSTRMModelFile(modelName: string): Promise<ScaffoldOutput> {
  const output = buildScaffoldOutput();
  try {
    const localeData = LocaleManager.getInstance().getLocaleData();
    // build model file
    const modelFileData = `# Generated by the ${
      localeData.misc.STORM_BRANDED
    } ${new Date().toLocaleDateString()}
# Core Imports
import datetime
import mongoengine as me


class ${titleCase(modelName)}(me.Document):
\t"""
\tAutogenerated:
\tRepresents a ${modelName}
\t"""
\tlabel = me.StringField(required=True, max_length=200)
\tupdated_at = me.DateTimeField(default=datetime.datetime.utcnow)\n
    `;
    const modelFilePath = path.resolve(
      process.cwd(),
      `strm_models/${modelName}.py`
    );
    await writeFile(modelFilePath, modelFileData);
    output.success = true;
    return output;
  } catch (e) {
    output.message = e.message;
    return output;
  }
}

/**
 * @async
 * @function getSTRMModules
 * @description Helper function that attempts to read the strm_modules.json file and returns a typed object or not
 * @returns {Promise<STRMModulesFile|undefined>}
 */
async function getSTRMModules(): Promise<STRMModulesFile | undefined> {
  try {
    const modulesFilePath = path.resolve(
      process.cwd(),
      'strm_modules/strm_modules.json'
    );
    const modulesFileStringData = await readFile(modulesFilePath, {
      encoding: 'utf-8',
    });
    return JSON.parse(modulesFileStringData) as STRMModulesFile;
  } catch (e) {
    return;
  }
}

/**
 * @function writeSTRMModulesFile
 * @description Given STRMModulesFile data, attempts to write to the filesystem
 * @param {STRMModulesFile} strmModulesFile the STRMModules files data that should be written to the filesystem
 * @returns {Promise<ScaffoldOutput>}
 */
async function writeSTRMModulesFile(
  strmModulesFile: STRMModulesFile
): Promise<ScaffoldOutput> {
  const output = buildScaffoldOutput();
  try {
    const targetPath = path.resolve(
      process.cwd(),
      'strm_modules/strm_modules.json'
    );
    strmModulesFile.lastUpdated = new Date().toISOString();
    const dataToWrite = JSON.stringify(strmModulesFile, undefined, 2);
    await writeFile(targetPath, dataToWrite);

    output.success = true;
    return output;
  } catch (e) {
    output.message = e.message;
    return output;
  }
}

/**
 * @function regenerateSTRMModuleRoutes
 * @description Attempts to rewrite the backend routes (strm_routes/__init__.py) based on the contents of the modules file (strm_modules/strm_modules.json)
 * @returns {Promise<ScaffoldOutput>} an object indicating the result of operation
 */
async function regenerateSTRMModuleRoutes(): Promise<ScaffoldOutput> {
  const output = buildScaffoldOutput();
  const localeData = LocaleManager.getInstance().getLocaleData();
  try {
    // read strm_modules
    const modulesJSON = await getSTRMModules();

    if (!modulesJSON) {
      // todo: replace with localized string
      output.message = 'Failed to read modules file';
      return output;
    }

    let controllerRoutesString = ``;
    // extract the controllers from modules
    Object.keys(modulesJSON['modules']).forEach((moduleKey, index) => {
      const module = modulesJSON['modules'][moduleKey];
      if (module) {
        const { controller } = module;
        const correctedControllerName = controller.controllerName
          .split('_')
          .map((word) => {
            return `${String(word).charAt(0).toUpperCase()}${String(word).slice(
              1
            )}`;
          })
          .join('');
        const shouldAddNewLine =
          index !== Object.keys(modulesJSON['modules']).length - 1;
        controllerRoutesString += `        Route('/${controller.endpointBase}', ${correctedControllerName}),\n`;
        controllerRoutesString += `        Route('/${
          controller.endpointBase
        }/{${moduleKey}}', ${correctedControllerName}),${
          shouldAddNewLine ? '\n' : ''
        }`;
      }
    });

    const routesString = `# Generated by the ${
      localeData.misc.STORM_BRANDED
    } ${new Date().toLocaleDateString()}
# core imports
from starlette.routing import Mount, Route
# ${localeData.misc.STORM_BRANDED} imports
from strm_controllers import *


# generated routes
routes = [
    Mount('/api', routes=[
${controllerRoutesString}
    ])
]
`;
    // write to file replacing contents
    const targetFilePath = path.resolve(
      process.cwd(),
      'strm_routes/__init__.py'
    );
    await writeFile(targetFilePath, routesString);

    output.success = true;
    return output;
  } catch (e) {
    output.message = e.message;
    return output;
  }
}

/**
 * @function buildSTRMFrontendComponents
 * @description Given an array of STRMFERoute objects read from the modules file
 * (strm_modules/strm_modules.json), reads the config file and generates the
 * frontend component based on the frontend option specified in the config
 * (strm_config/strm_config.json) file and the given pluralizedModuleName.
 * @param {string} moduleKey
 * @param {string} pluralizedModuleName
 * @returns {Promise<ScaffoldOutput>} an object indicating the result of the operation
 */
async function buildSTRMFrontendComponents(
  moduleKey: string,
  pluralizedModuleName: string
): Promise<ScaffoldOutput> {
  const output = buildScaffoldOutput();
  try {
    // read our strm config
    const strmConfig = await getProjectConfig(process.cwd());
    if (!strmConfig) {
      output.message = 'Failed to load project config';
      return output;
    }
    // read strm modules
    const strmModules = await getSTRMModules();
    if (!strmModules) {
      output.message = 'Failed to load strm modules';
      return output;
    }

    const feFolder = `strm_fe_${strmConfig.frontend}`;
    const feBasePath = path.resolve(
      process.cwd(),
      feFolder,
      'src/pages',
      titleCase(pluralizedModuleName)
    );

    // create folder
    await mkdir(feBasePath);

    // loop over pages and build components as needed
    const module = strmModules.modules[moduleKey];
    if (!module) {
      output.message = 'Invalid STRM Module';
      return output;
    }

    const { pages } = module;
    for (const page of pages) {
      // attempt to generate page components
      const isIndexPage = page.componentPath.includes('Index');
      const fileName = isIndexPage ? 'Index.tsx' : `${page.componentName}.tsx`;
      const pageData = isIndexPage
        ? generateIndexPage(strmConfig.frontend, page.componentName)
        : generateDetailsPage(
            strmConfig.frontend,
            page.componentName,
            page.componentPath,
            module.controller.controllerName
          );
      const pageFilePath = path.resolve(feBasePath, fileName);
      await writeFile(pageFilePath, pageData);
      console.log('✅ wrote frontend component: ', pageFilePath);
    }

    output.success = true;
    return output;
  } catch (e) {
    output.message = e.message;
    return output;
  }
}

/**
 * @function buildSTRMModule
 * @description Helper function that constructs a STRM module based on the given parameters
 * @param {STRMModuleArgs} moduleArgs command line arguments passed in
 * @returns {STRMModule} an object representing a module
 */
function buildSTRMModule(moduleArgs: STRMModuleArgs): STRMModule {
  const { name, controllerOnly, plural } = moduleArgs;

  const pluralizedName = plural ? plural : name;
  const lowercaseName = name.toLowerCase();
  // setup controller
  const controller: STRMController = {
    controllerName: `${lowercaseName}_controller`,
    modelName: `${lowercaseName}.py`,
    endpointBase: pluralizedName,
  };

  const pages: Array<STRMFERoute> = [];

  // setup pages (if controllerOnly = false)
  if (!controllerOnly) {
    const indexPage: STRMFERoute = {
      path: `/${pluralizedName}`,
      componentName: titleCase(name),
      componentPath: `${titleCase(pluralizedName)}/Index`,
    };

    const detailsPage: STRMFERoute = {
      path: `/${pluralizedName}/:id`,
      componentName: `${titleCase(name)}Detail`,
      componentPath: `${titleCase(pluralizedName)}/${titleCase(name)}`,
    };

    pages.push(indexPage, detailsPage);
  }

  return {
    controller,
    controllerOnly: !!controllerOnly,
    pages,
  };
}

/**
 * @async
 * @function createSTRMModule
 * @description Utility function that handles the creation of a STRM Stack Module
 * @param {STRMModuleArgs} moduleArgs
 * @returns {Promise<ScaffoldOutput>} Standard scaffold output indicating the result of attempting to create a module
 */
export async function createSTRMModule(
  moduleArgs: STRMModuleArgs
): Promise<ScaffoldOutput> {
  const localeData = LocaleManager.getInstance().getLocaleData();
  const output = buildScaffoldOutput();
  try {
    const { name } = moduleArgs;
    ConsoleLogger.printCLIProcessInfoMessage(
      `Attempting to update ${localeData.misc.STORM_BRANDED} Modules...`
    );
    // 0. read configuration
    const strmModulesFileData = await getSTRMModules();
    if (!strmModulesFileData) {
      ConsoleLogger.printCLIProcessErrorMessage(
        'Failed to read data from',
        'strm_modules/strm_modules.json'
      );
      output.message = 'Failed to read STRMModules file';
      return output;
    }
    // 0.1 update modules JSON file
    strmModulesFileData.modules[name] = buildSTRMModule(moduleArgs);
    const writeModulesResult = await writeSTRMModulesFile(strmModulesFileData);
    if (!writeModulesResult.success) {
      output.message = 'Failed to write Modules';
      ConsoleLogger.printCLIProcessErrorMessage(
        'Failed to update STRM Modules file'
      );
      return output;
    }
    ConsoleLogger.printCLIProcessSuccessMessage(
      `Updated ${localeData.misc.STORM_BRANDED} Modules.`
    );
    // 1. build model

    ConsoleLogger.printCLIProcessInfoMessage(
      'Attempting to create module file',
      `strm_models/${name.toLowerCase()}.py`
    );
    const modelResult = await writeSTRMModelFile(name);
    if (!modelResult.success) {
      output.message = modelResult.message;
      ConsoleLogger.printCLIProcessErrorMessage('Failed to create model file');
      return output;
    }
    ConsoleLogger.printCLIProcessSuccessMessage(
      'Successfully created model file',
      `strm_models/${name.toLowerCase()}.py`
    );
    // 2. build controller
    ConsoleLogger.printCLIProcessInfoMessage(
      'Attempting to create controller with name',
      `strm_controllers/${name}_controller.py`
    );
    const controllerResult = await writeSTRMControllerFile(name);
    if (!controllerResult.success) {
      output.message = controllerResult.message;
      ConsoleLogger.printCLIProcessErrorMessage(
        'Failed to create controller file'
      );
      return output;
    }
    ConsoleLogger.printCLIProcessSuccessMessage(
      'Successfully created controller file',
      `strm_controllers/${name.toLowerCase()}_controller.py`
    );
    // 3. rewrite backend routes
    ConsoleLogger.printCLIProcessInfoMessage(
      'Attempting to rebuild module routes file',
      'strm_routes/__init__.py'
    );
    const moduleRoutesResult = await regenerateSTRMModuleRoutes();
    if (!moduleRoutesResult.success) {
      output.message = moduleRoutesResult.message;
      ConsoleLogger.printCLIProcessErrorMessage(
        'Failed to rewrite strm_routes/__init__.py file'
      );
      return output;
    }
    // 3.1 update auto imports
    ConsoleLogger.printCLIProcessInfoMessage(
      'Updating auto imports',
      'strm_controllers/__init__.py'
    );
    const updateAutoImportsResult =
      await updateSTRMModuleRouteAutoImports(name);
    if (!updateAutoImportsResult.success) {
      output.message = updateAutoImportsResult.message;
      ConsoleLogger.printCLIProcessErrorMessage(
        'Failed to module auto imports',
        updateAutoImportsResult.message
      );
      return output;
    }

    ConsoleLogger.printCLIProcessSuccessMessage('Updated auto imports');

    // 4. build frontend components
    ConsoleLogger.printCLIProcessInfoMessage(
      `Attempting to create frontend components...`
    );
    const buildFEComponentsResult = await buildSTRMFrontendComponents(
      name,
      moduleArgs.plural ? moduleArgs.plural : name
    );

    if (!buildFEComponentsResult.success) {
      output.message = buildFEComponentsResult.message;
      ConsoleLogger.printCLIProcessErrorMessage(
        'Failed to build FE components',
        buildFEComponentsResult.message
      );
      return output;
    }

    ConsoleLogger.printCLIProcessSuccessMessage(
      'Successfully created frontend page components'
    );

    output.success = true;
    return output;
  } catch (e) {
    output.message = e.message;
    return output;
  }
}
