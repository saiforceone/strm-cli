/**
 * @author SaiForceOne
 * @description Messaging shown when the CLI starts
 */

// core & third-party imports
import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';

// STORM Stack imports
import { LocaleManager } from './localeManager.js';

/**
 * @function printPreScaffoldMessage
 * @description Prints the CLI welcome message displaying branding
 */
export function printPreScaffoldMessage(): void {
  const localeData = LocaleManager.getInstance().getLocaleData();
  console.log(`
 ${gradient.mind(figlet.textSync('STORM', { font: 'Chunky' }))}
 ${chalk.bold(localeData.misc.STORM_BRANDED)} ${chalk.italic(
   localeData.misc.TAG_LINE
 )}
`);
}
