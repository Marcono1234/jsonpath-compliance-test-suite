#!/usr/bin/env node
// @ts-check

const fs = require('fs');
const path = require('path');
const {parseArgs} = require('node:util');

/**
 * The file extension of test files.
 * @type {string}
 */
const fileExtension = '.json';
/**
 * The number of spaces to use for indentation in the output.
 * @type {number}
 */
const jsonIndent = 2;
/**
 * The separator to use when combining test names.
 * @type {string}
 */
const testNameSeparator = ', ';

/**
 * The description of the test suite.
 * @type {string}
 */
const description = 'JSONPath Compliance Test Suite. This file is autogenerated, do not edit.';

/**
 * The options for the command line. See https://nodejs.org/api/util.html#utilparseargsconfig.
 * IMPORTANT: Update usage if you change these options.
 */
const options = {
    'tag': {
        type: 'string',
        short: 't',
        multiple: true,
        default: [],
    },
    'require-all': {
        type: 'boolean',
        short: 'a',
        default: false,
    },
    'exclude': {
        type: 'boolean',
        short: 'e',
        default: false,
    }
}

const usage = [
    'Build a combined test suite from a directory of test files.',
    '',
    'Usage: node build.js <test-folder-path> [OPTION]...',
    'Options:',
    '  -t, --tag <tag>      Filter tests by tag. Can be used multiple times.',
    '                       Any test with at least one matching tag (by default) or all matching tags (if -a is used)',
    '                       will be included (by default) or excluded (if -e is used) in the output.',
    '  -a, --require-all    Flag to require all tags to be present in a test.',
    '  -e, --exclude        Flag to exclude the specified tags instead of including them.',
]

main()

function main() {
    const {values, positionals} = parseArgs({options, allowPositionals: true});
    if (positionals.length !== 1) {
        usage.forEach(line => console.error(line));
        process.exit(1);
    }
    const [testsFolder] = positionals;
    buildTestSuite(testsFolder, values['tag'], values['require-all'], values['exclude']);
}

/**
 * Build a combined test suite from a directory of test files.
 * The output is written to stdout.
 * @param testsFolder {string} - The directory containing the test files.
 * @param tags {string[]} - The tags to filter tests by.
 * @param all {boolean} - True if all tags must match.
 * @param exclude {boolean} - True if the tags should be excluded instead of included.
 */
function buildTestSuite(testsFolder, tags, all, exclude) {
    console.error(`Building test suite from ${testsFolder}`);
    console.error(`Filtering by tags (${tags.length}): ${tags.join(', ')}`);
    console.error(`Require all tags: ${all}`);
    console.error(`Exclude tags: ${exclude}`);
    const tagFilter = all
        ? list => tags.every(t => list.includes(t))
        : list => tags.some(t => list.includes(t))
    const tests = readTestsFromDir(testsFolder)
        .filter(test => tags.length === 0 || (tagFilter(getTags(test)) !== exclude));
    tests.forEach(test => {
        if ('tags' in test) test.tags.sort();
    });
    const cts = {'description': description, 'tests': tests};
    console.log(JSON.stringify(cts, null, jsonIndent));
    const allTags = Array.from(new Set(tests.flatMap(getTags)));
    allTags.sort();
    console.error(`Wrote ${tests.length} tests to stdout.`);
    console.error(`Tags (${allTags.length}): ${allTags.join(', ')}`);

    function getTags(test) {
        return 'tags' in test ? test.tags : [];
    }
}

/**
 * Read all test files from a directory and its subdirectories.
 * The directory name is prepended to the test name.
 * @param dir {string} - The directory to read.
 * @param relativePath {string[]} - The path to the directory.
 * @returns {*[]} - An array of test objects.
 */
function readTestsFromDir(dir, relativePath = []) {
    const files = fs.readdirSync(dir);
    files.sort(filesBeforeDirs);
    return files.reduce(addTestsFromFile, []);

    /**
     * Add tests from a file to the list of all tests.
     * @param allTests - The list of all tests.
     * @param file - The file to read.
     * @returns {*} - The updated list of all tests.
     */
    function addTestsFromFile(allTests, file) {
        const fullPath = path.join(dir, file);

        if (isDir(file)) {
            console.error(`Processing dir ${fullPath}`);
            const tests = readTestsFromDir(fullPath, [...relativePath, file]);
            return allTests.concat(tests);
        }

        if (path.extname(file) === fileExtension) {
            console.error(`Processing file ${fullPath}`);
            const basename = path.basename(file, fileExtension);
            const testNamePrefix = [...relativePath, basename]
                .join(testNameSeparator)
                .replace('_', ' ');
            const tests = readTestsFromFile(fullPath).map(prependToTestName(testNamePrefix));
            return allTests.concat(tests);
        }

        return allTests;
    }

    /**
     * Sort entries so that directories are listed after files.
     * @param first - The first file.
     * @param second - The second file.
     * @returns {number}
     */
    function filesBeforeDirs(first, second) {
        const firstIsDir = isDir(first);
        const secondIsDir = isDir(second);
        if (firstIsDir && !secondIsDir) return 1;
        if (!firstIsDir && secondIsDir) return -1;
        return first.localeCompare(second, 'en', {sensitivity: 'base'});
    }

    /**
     * Check if a file is a directory.
     * @param file {string} - The file name.
     * @returns {boolean} - True if the file is a directory.
     */
    function isDir(file) {
        return fs.statSync(path.join(dir, file)).isDirectory();
    }
}

/**
 * Read the tests from a file.
 * @param file - The file to read.
 * @returns {*[]}
 */
function readTestsFromFile(file) {
    const fileData = fs.readFileSync(file, 'utf8');
    return JSON.parse(fileData).tests;
}

/**
 * Prepend the prefix to the test name.
 * @param prefix {string} - The file name.
 * @returns {function(*): *&{name: string}} - A function that prepends the file name to the test name.
 */
function prependToTestName(prefix) {
    return (test) => {
        return {
            ...test, name: prefix + testNameSeparator + test.name,
        };
    };
}

