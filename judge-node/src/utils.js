/**
 * Smartly split input string into parameters.
 * Handles cases like: [1,2,3], 4  or  "HELLO"  or  42
 */
export function smartSplitInput(input) {
  if (!input) return [];
  let result = [];
  let depth = 0, current = '', inString = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"' || c === "'") inString = !inString;
    if (!inString && (c === '[' || c === '{')) depth++;
    if (!inString && (c === ']' || c === '}')) depth--;
    if (!inString && c === ',' && depth === 0) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

/**
 * Detect Java-like type from value and optional constraints.
 */
export function detectType(val, constraints) {
  val = String(val || '').trim();
  if (/^\".*\"$|^'.*'$/.test(val)) return 'String';
  if (/^\[.*\]$/.test(val)) {
    const arrContent = val.slice(1, -1).trim();
    if (!arrContent) return 'int[]';
    const firstElem = smartSplitInput(arrContent)[0];
    if (firstElem && (/^\".*\"$|^'.*'$/.test(firstElem))) return 'String[]';
    if (firstElem && /^-?\d*\.\d+$/.test(firstElem)) return 'double[]';
    return 'int[]';
  }
  if (/^-?\d+$/.test(val)) return 'int';
  if (/^-?\d*\.\d+$/.test(val)) return 'double';
  if (constraints) {
    if (/string/i.test(constraints)) return 'String';
    if (/array/i.test(constraints)) return 'int[]';
    if (/integer|int/i.test(constraints)) return 'int';
  }
  return 'String';
}

/**
 * Suggest parameter name based on type.
 */
export function suggestParamName(type, idx) {
  let base = 'arg';
  if (type.endsWith('[]')) base = 'arr';
  else if (type === 'String') base = 's';
  else if (type === 'int' || type === 'long') base = 'n';
  else if (type === 'double' || type === 'float') base = 'd';
  else if (type === 'boolean' || type === 'bool') base = 'flag';

  return base + (idx + 1);
}

/**
 * Infer parameter types from testcases and constraints.
 */
export function inferParamTypesFromTestcases(problem) {
  let inputExample = '';
  if (problem.testcases && problem.testcases.length > 0) {
    inputExample = String(problem.testcases[0].input || '');
  }
  const params = smartSplitInput(inputExample);
  return params.map((val, idx) => {
    const type = detectType(val, problem.constraints);
    return { type, name: suggestParamName(type, idx) };
  });
}

/**
 * Map detected types to language-specific types.
 */
export function mapType(type, language) {
  if (language === 'python') return ''; // Python is dynamic
  if (language === 'java') {
    if (type === 'String[]') return 'String[]';
    if (type === 'int[]') return 'int[]';
    if (type === 'double[]') return 'double[]';
    if (type === 'String') return 'String';
    if (type === 'int') return 'int';
    if (type === 'double') return 'double';
    return 'Object';
  }
  if (language === 'cpp') {
    if (type === 'String[]') return 'vector<string>';
    if (type === 'int[]') return 'vector<int>';
    if (type === 'double[]') return 'vector<double>';
    if (type === 'String') return 'string';
    if (type === 'int') return 'int';
    if (type === 'double') return 'double';
    return 'auto';
  }
  if (language === 'c') {
    if (type === 'String[]') return 'char**';
    if (type === 'int[]') return 'int*';
    if (type === 'double[]') return 'double*';
    if (type === 'String') return 'char*';
    if (type === 'int') return 'int';
    if (type === 'double') return 'double';
    return 'void*';
  }
  return type;
}
