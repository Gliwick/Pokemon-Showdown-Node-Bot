const COMMAND_PATH = './commands';
const MAX_COMMAND_RECURSION = 10;

let assert = require('assert');

const commands = {};
const separatedCommands = {};

function getFile(cmd) {
	for (let file in separatedCommands) {
		if (cmd in separatedCommands[file]) return file;
	}
}

describe('Commands', function () {
	it('Should not crash when loading files', function () {
		fs.readdirSync(COMMAND_PATH).forEach((file) => {
			if (file.endsWith('.ts')) {
				separatedCommands[file] = require('../../' + COMMAND_PATH + '/' + file).commands;
			}
		});
	});
	it('Should come from files with #commands attribute as object type', function () {
		for (let file in separatedCommands) {
			assert.strictEqual(typeof separatedCommands[file], 'object', `commands file "${file}" has not a valid commands attribute`);
			assert.notStrictEqual(separatedCommands[file], null, `commands file "${file}" has not a valid commands attribute`);
		}
	});
	it('Should not be repeated in more than one file', function () {
		for (let file in separatedCommands) {
			for (let command in separatedCommands[file]) {
				assert.strictEqual(
					commands[command],
					undefined,
					`command "${command}" from file "${file}" is repeated (${getFile(command)})`
				);
				commands[command] = separatedCommands[file][command];
			}
		}
	});
	it('Should be functions or valid references', function () {
		let handler;
		let loopBreaker;
		for (let command in commands) {
			loopBreaker = 0;
			handler = command;
			while (typeof commands[handler] === 'string' && loopBreaker++ < MAX_COMMAND_RECURSION) {
				handler = commands[handler];
			}
			assert.strictEqual(
				typeof commands[handler],
				'function',
				`command "${command}" from file "${getFile(command)}" is not a valid function or reference`
			);
		}
	});
	it('Should not contain uppercase characters or spaces on their names', function () {
		for (let command in commands) {
			assert.strictEqual(
				command,
				command.toLowerCase().replace(/[ ]/, ''),
				`command "${command}" from file "${getFile(command)}" contains uppercase or spaces in the name`
			);
		}
	});
});
