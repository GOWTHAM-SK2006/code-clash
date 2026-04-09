// Code wrapping and Docker execution for Python
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const { normalizeOutput } = require('./utils');

function wrapPythonCode(userCode, functionName, testcases) {
  let runner = '';
  runner += userCode + '\n';
  runner += 'import sys\n';
  runner += 'def __run():\n';
  testcases.forEach((tc, idx) => {
    runner += `    try:\n`;
    runner += `        result = ${functionName}(*${tc.input})\n`;
    runner += `        print("CASE${idx}:", result)\n`;
    runner += `    except Exception as e:\n`;
    runner += `        print("CASE${idx}:__EXCEPTION__", e)\n`;
  });
  runner += '\n__run()\n';
  return runner;
}

function runPythonInDocker(code, timeLimit = 2) {
  const codePath = path.join(__dirname, 'temp.py');
  fs.writeFileSync(codePath, code);
  try {
    const output = execSync(
      `docker run --rm -m 128m --cpus=0.5 -v ${codePath}:/code.py python:3.10-alpine timeout ${timeLimit}s python /code.py`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    return { output, error: null };
  } catch (err) {
    return { output: err.stdout?.toString() || '', error: err.stderr?.toString() || err.message };
  } finally {
    fs.unlinkSync(codePath);
  }
}

module.exports = { wrapPythonCode, runPythonInDocker };
