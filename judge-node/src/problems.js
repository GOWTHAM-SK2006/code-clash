// Problem storage for CodeClash Judge
module.exports = [
  {
    id: "two-sum",
    title: "Two Sum",
    functionName: "twoSum",
    language: "python",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    constraints: "1 <= nums.length <= 10^4, -10^9 <= nums[i] <= 10^9, -10^9 <= target <= 10^9",
    testcases: [
      { input: "[[2,7,11,15], 9]", expected: "[0, 1]", visible: true },
      { input: "[[3,2,4], 6]", expected: "[1, 2]", visible: true },
      { input: "[[3,3], 6]", expected: "[0, 1]", visible: false }
    ]
  }
];
