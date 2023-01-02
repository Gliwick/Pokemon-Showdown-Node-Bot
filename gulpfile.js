var path = require('path');
var util = require('util');

var gulp = require('gulp');
var lazypipe = require('lazypipe');
var merge = require('merge-stream');
var cache = require('gulp-cache');
var jscs = require('gulp-jscs');
var jshint = require('gulp-jshint');
var replace = require('gulp-replace');
var FileCache = require('cache-swap');
var jshintStylish = require('jshint-stylish');

var globals = {};
var globalList = [
	'AppOptions',
	'Bot',
	'CommandParser',
	'Config',
	'DataDownloader',
	'Features',
	'Formats',
	'GlobalMonitor',
	'I18n',
	'SecurityLog',
	'Settings'
];
globalList.forEach(function (identifier) {
	globals[identifier] = false;
});

function transformLet() {
	// Replacing `var` with `let` is sort of a hack that stops jsHint from
	// complaining that I'm using `var` like `let` should be used, but
	// without having to deal with iffy `let` support.

	return lazypipe().pipe(replace.bind(null, /\bvar\b/g, 'let'))();
}

function lint(jsHintOptions, jscsOptions) {
	function cachedJsHint() {
		return cache(jshint(jsHintOptions, { timeout: 450000 }), {
			success: function (file) {
				return file.jshint.success;
			},
			value: function (file) {
				return { jshint: file.jshint };
			},
			fileCache: new FileCache({ tmpDir: '.', cacheDirName: 'gulp-cache' })
		});
	}
	return lazypipe()
		.pipe(cachedJsHint)
		.pipe(jscs.bind(jscs, { configPath: jscsOptions }))
		.pipe(jscs.reporter.bind(jscs.reporter))
		.pipe(jscs.reporter.bind(jscs.reporter, 'fail'))();
}

var jsHintOptions = {};
jsHintOptions.base = {
	nonbsp: true,
	nonew: true,
	noarg: true,
	loopfunc: true,
	latedef: 'nofunc',

	freeze: true,
	undef: true,

	sub: true,
	evil: true,
	esnext: true,
	node: true,
	eqeqeq: true,

	globals: globals
};

jsHintOptions.test = util._extend(util._extend({}, jsHintOptions.base), {
	mocha: true
});

jsHintOptions.externalScripts = util._extend(util._extend({}, jsHintOptions.base), {
	globals: {}
});

var jscsOptions = {};
jscsOptions.base = './test/.jscsrc';
jscsOptions.config = './test/.jscsrc';

var lintData = [
	{
		dirs: [
			'./command-parser.ts',
			'./data-downloader.ts',
			'./index.ts',
			'./security-log.ts',
			'./settings.ts',
			'showdown-client.ts',
			'./tools.ts',
			'./commands/*.js',
			'./features/*/*.ts',
			'./languages/*/*.js',
			'./features/battle/battle-ai/*.ts',
			'./features/battle/battle-ai/modules/*.ts'
		],
		jsHint: jsHintOptions.base,
		jscs: jscsOptions.base
	},
	{
		dirs: ['./config-example.js', './data/*-example.js', './data/typechart.ts'],
		jsHint: jsHintOptions.base,
		jscs: jscsOptions.config
	},
	{
		dirs: ['./test/*.js', './testfiles/*.js'],
		jsHint: jsHintOptions.test,
		jscs: jscsOptions.config
	},
	{
		dirs: ['./getserver.js', './config-setup.js'],
		jsHint: jsHintOptions.externalScripts,
		jscs: jscsOptions.base
	}
];

var linter = function () {
	return merge
		.apply(
			null,
			lintData.map(function (source) {
				return gulp.src(source.dirs).pipe(transformLet()).pipe(lint(source.jsHint, source.jscs));
			})
		)
		.pipe(jshint.reporter(jshintStylish))
		.pipe(jshint.reporter('fail'));
};

gulp.task('fastlint', function () {
	var source = lintData[0];
	return gulp
		.src(source.dirs)
		.pipe(transformLet())
		.pipe(lint(source.jsHint, source.jscs))
		.pipe(jshint.reporter(jshintStylish))
		.pipe(jshint.reporter('fail'));
});

gulp.task('lint', linter);
gulp.task('default', linter);
