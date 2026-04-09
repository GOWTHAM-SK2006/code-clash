-- Update Problem Descriptions, Input Format, and Output Format for extended problems
-- Note: These updates are applied using the title as the unique identifier.

-- Two Sum
UPDATE problems SET
    description = 'Given an array of integers `nums` and an integer `target`, identify the indices of the two elements that sum up exactly to the target value. You may assume that each input has exactly one solution, and you should not use the same element twice. Returning the result as a sorted pair of indices is generally preferred.',
    input_format = 'An integer array `nums` followed by an integer `target`.',
    output_format = 'A pair of integers representing the zero-indexed positions of the two numbers.'
WHERE title = 'Two Sum';

-- FizzBuzz
UPDATE problems SET
    description = 'Print a sequence of strings from 1 to n, substituting specific values based on divisibility: return "Fizz" for multiples of three, "Buzz" for multiples of five, and "FizzBuzz" for multiples of both. For all other numbers, return the number itself as a string.',
    input_format = 'A single non-negative integer n.',
    output_format = 'A space-separated sequence or list of strings as specified.'
WHERE title = 'FizzBuzz';

-- Check Prime
UPDATE problems SET
    description = 'Determine whether a given positive integer n is a prime number. A prime number is a natural number greater than 1 that maintains exactly two divisors: 1 and itself.',
    input_format = 'A single positive integer n.',
    output_format = 'Return "True" if the number is prime, otherwise return "False" (or Boolean equivalent).'
WHERE title = 'Check Prime';

-- Factorial
UPDATE problems SET
    description = 'Compute the factorial of a non-negative integer n. The factorial (denoted as n!) represents the product of all positive integers less than or equal to n. Note that 0! is mathematically defined as 1.',
    input_format = 'A single non-negative integer n.',
    output_format = 'A single integer representing the calculated factorial.'
WHERE title = 'Factorial';

-- Fibonacci Nth
UPDATE problems SET
    description = 'Calculate the n-th value in the Fibonacci sequence. The sequence begins with 0 and 1, and each subsequent number is the sum of the two preceding values. This is an excellent exercise in recursion or dynamic programming.',
    input_format = 'A single non-negative integer n representing the index (starting from 0).',
    output_format = 'A single integer representing the n-th Fibonacci number.'
WHERE title = 'Fibonacci Nth';

-- Palindrome String
UPDATE problems SET
    description = 'Assess a given alphanumeric string to determine if it is a palindrome. This requires verifying that the sequence of characters reads identically when reversed, typically ignoring non-alphanumeric characters and case sensitivity (though refer to specifics for exact matching).',
    input_format = 'A single string value.',
    output_format = 'Return YES if the string is a palindrome, otherwise NO.'
WHERE title = 'Palindrome String';

-- Check Anagram
UPDATE problems SET
    description = 'Analyze two provided strings to determine if they are anagrams of each other. Two strings are anagrams if they consist of the exact same characters in the same frequency, regardless of their original arrangement.',
    input_format = 'Two space-separated or newly-lined strings.',
    output_format = 'Return YES if they are anagrams, otherwise NO.'
WHERE title = 'Check Anagram';

-- Check Even or Odd
UPDATE problems SET
    description = 'Determine the parity of a given integer. This basic logical operation involves checking if the number is divisible by 2 without a remainder.',
    input_format = 'A single integer value.',
    output_format = 'Return "Even" if the number is even, and "Odd" if it is odd.'
WHERE title = 'Check Even or Odd';

-- Sum of Array
UPDATE problems SET
    description = 'Perform a comprehensive summation of all numeric elements currently stored within an array. This demonstrates fundamental iteration and data aggregation skills.',
    input_format = 'An integer n followed by n integers.',
    output_format = 'A single integer representing the sum.'
WHERE title = 'Sum of Array';

-- Find Maximum Number
UPDATE problems SET
    description = 'Determine the largest value residing in an array of integers. This problem tests the ability to manage state during a single pass through a dataset.',
    input_format = 'An integer n followed by n integers.',
    output_format = 'The largest integer value present in the array.'
WHERE title = 'Find Maximum Number';

-- Reverse String
UPDATE problems SET
    description = 'Generate a new string that contains all characters from the input string in exact opposite order. This is a common operation for string manipulation tasks.',
    input_format = 'A single string s.',
    output_format = 'The reversed string.'
WHERE title = 'Reverse String';

-- Reverse Number
UPDATE problems SET
    description = 'Given an integer, return its digits in reverse order. Ensure that negative signs are preserved if applicable to the specific requirement, though generally, this involves numerical digit manipulation.',
    input_format = 'A single integer value.',
    output_format = 'The numerically reversed integer.'
WHERE title = 'Reverse Number';

-- Sum of First N Numbers
UPDATE problems SET
    description = 'Calculate the arithmetic sum of the first n positive integers (1 + 2 + ... + n). This can be solved iteratively or via the standard arithmetic progression formula.',
    input_format = 'A single positive integer n.',
    output_format = 'A single integer value representing the sum.'
WHERE title = 'Sum of First N Numbers';

-- Count Digits
UPDATE problems SET
    description = 'Determine the total number of digits contained within a given integer. This involves understanding numerical place values or string conversion.',
    input_format = 'A single integer value.',
    output_format = 'The count of individual digits in the number.'
WHERE title = 'Count Digits';

-- Check Armstrong Number
UPDATE problems SET
    description = 'Verify if a given number is an Armstrong number. A number is an Armstrong number if the sum of its own digits raised to the power of the number of digits is equal to the number itself (e.g., 153 = 1³ + 5³ + 3³).',
    input_format = 'A single integer n.',
    output_format = 'Return YES if it is an Armstrong number, NO otherwise.'
WHERE title = 'Check Armstrong Number';

-- GCD of Two Numbers
UPDATE problems SET
    description = 'Find the Greatest Common Divisor (GCD) of two integers, which is the largest positive integer that divides each of the integers without a remainder. Often solved using the Euclidean Algorithm.',
    input_format = 'Two space-separated integers a and b.',
    output_format = 'The GCD of a and b.'
WHERE title = 'GCD of Two Numbers';

-- LCM of Two Numbers
UPDATE problems SET
    description = 'Calculate the Least Common Multiple (LCM) of two integers. The LCM is the smallest positive integer that is divisible by both of the provided numbers.',
    input_format = 'Two space-separated integers a and b.',
    output_format = 'The LCM of a and b.'
WHERE title = 'LCM of Two Numbers';

-- Power of Number
UPDATE problems SET
    description = 'Compute the result of raising a base number `a` to the power of an exponent `b` (a^b).',
    input_format = 'Two space-separated integers: base a and exponent b.',
    output_format = 'The result of a raised to the power of b.'
WHERE title = 'Power of Number';

-- Check Sorted Array
UPDATE problems SET
    description = 'Identify whether the provided integer array is sorted in ascending (non-decreasing) order. Every element must be less than or equal to the element immediately following it.',
    input_format = 'An integer n followed by n space-separated integers.',
    output_format = 'Return YES if sorted, otherwise NO.'
WHERE title = 'Check Sorted Array';

-- Merge Sorted Arrays
UPDATE problems SET
    description = 'Take two already sorted integer arrays and merge them into a single, unified array that preserves the sorted order of all elements.',
    input_format = 'Two arrays, each starting with its size n followed by the elements.',
    output_format = 'A single space-separated sequence of the merged sorted elements.'
WHERE title = 'Merge Sorted Arrays';

-- Count Occurrences
UPDATE problems SET
    description = 'Quantify how many times a specific target value appears within a given array. This task evaluates the ability to perform conditional counting during iteration.',
    input_format = 'An integer n followed by n integers, and a target value x.',
    output_format = 'The frequency of x in the array.'
WHERE title = 'Count Occurrences';

-- String Length
UPDATE problems SET
    description = 'Measure the total count of characters in a given string, including spaces and special characters.',
    input_format = 'A single string value.',
    output_format = 'The integer length of the string.'
WHERE title = 'String Length';

-- Uppercase String
UPDATE problems SET
    description = 'Transform all lowercase alphabetical characters within a string into their uppercase equivalents, leaving all other characters unchanged.',
    input_format = 'A single string value.',
    output_format = 'The string in full uppercase.'
WHERE title = 'Uppercase String';

-- Lowercase String
UPDATE problems SET
    description = 'Transform all uppercase alphabetical characters within a string into their lowercase equivalents, leaving all other characters unchanged.',
    input_format = 'A single string value.',
    output_format = 'The string in full lowercase.'
WHERE title = 'Lowercase String';

-- Swap Two Numbers
UPDATE problems SET
    description = 'Exchange the values stored in two variables. This problem often explores the use of a temporary variable or arithmetic tricks to achieve the swap.',
    input_format = 'Two integers a and b.',
    output_format = 'Two space-separated integers: the swapped values of a and b.'
WHERE title = 'Swap Two Numbers';

-- Multiplication Table
UPDATE problems SET
    description = 'Generate the multiplication table for a given integer n up to 10. This is a basic display task using loops.',
    input_format = 'A single integer n.',
    output_format = 'Ten space-separated values: n*1, n*2, ..., n*10.'
WHERE title = 'Multiplication Table';

-- Is Leap Year Check
UPDATE problems SET
    description = 'Determine whether a given Gregorian calendar year is a leap year. A year is a leap year if it is divisible by 4, except for years divisible by 100 but not by 400.',
    input_format = 'A single integer representing the year.',
    output_format = 'YES if it is a leap year, otherwise NO.'
WHERE title = 'Is Leap Year Check';

-- Find Index of Element
UPDATE problems SET
    description = 'Determine the first zero-indexed position of a target element within an array. If the element is not found, return -1.',
    input_format = 'An integer n followed by n integers, and a target value x.',
    output_format = 'The first index of x, or -1 if absent.'
WHERE title = 'Find Index of Element';

-- Sum of Even Numbers
UPDATE problems SET
    description = 'Isolate all even values in an array and return their collective sum. This combines filtering and accumulation logic.',
    input_format = 'An integer n followed by n integers.',
    output_format = 'The sum of even numbers.'
WHERE title = 'Sum of Even Numbers';

-- Sum of Odd Numbers
UPDATE problems SET
    description = 'Isolate all odd values in an array and return their collective sum.',
    input_format = 'An integer n followed by n integers.',
    output_format = 'The sum of odd numbers.'
WHERE title = 'Sum of Odd Numbers';

-- Count Even Numbers in Array
UPDATE problems SET
    description = 'Identify and count how many integers within the provided array are even.',
    input_format = 'An integer n followed by n integers.',
    output_format = 'The count of even integers.'
WHERE title = 'Count Even Numbers in Array';

-- Count Odd Numbers
UPDATE problems SET
    description = 'Identify and count how many integers within the provided array are odd.',
    input_format = 'An integer n followed by n integers.',
    output_format = 'The count of odd integers.'
WHERE title = 'Count Odd Numbers';

-- Remove Duplicates
UPDATE problems SET
    description = 'Processes an array to remove any repeated occurrences of a value, ensuring that only the first instance of each unique element remains in the resulting sequence.',
    input_format = 'An integer n followed by n integers.',
    output_format = 'The unique sequence of elements, separated by spaces.'
WHERE title = 'Remove Duplicates';

-- Largest of Three
UPDATE problems SET
    description = 'Given three distinct or non-distinct integers, identify which of them has the highest numerical value.',
    input_format = 'Three space-separated integers a, b, and c.',
    output_format = 'The maximum of the three integers.'
WHERE title = 'Largest of Three';

-- Find Minimum
UPDATE problems SET
    description = 'Determine the smallest integer value present in an array.',
    input_format = 'An integer n followed by n integers.',
    output_format = 'The minimum value in the array.'
WHERE title = 'Find Minimum';

-- Find Average
UPDATE problems SET
    description = 'Calculate the arithmetic mean of all numeric elements in the array. This is the sum divided by the count.',
    input_format = 'An integer n followed by n integers.',
    output_format = 'The numerical average (often as a floating point or integer depending on requirement).'
WHERE title = 'Find Average';

-- Find Second Largest
UPDATE problems SET
    description = 'Locate the second highest value in an array of integers. This task requires careful handling of duplicates and unique maximums.',
    input_format = 'An integer n followed by n integers.',
    output_format = 'The second largest value found.'
WHERE title = 'Find Second Largest';

-- Reverse Array
UPDATE problems SET
    description = 'Produce an array that contains all elements of the input array in reverse sequence.',
    input_format = 'An integer n followed by n integers.',
    output_format = 'The reversed array elements, space-separated.'
WHERE title = 'Reverse Array';

-- Check Positive or Negative
UPDATE problems SET
    description = 'Determine the sign of a given integer. Classify it as positive, negative, or zero.',
    input_format = 'A single integer n.',
    output_format = 'The string "Positive", "Negative", or "Zero".'
WHERE title = 'Check Positive or Negative';

-- Check Substring
UPDATE problems SET
    description = 'Determine if a specific sequence of characters (the substring) is present within another larger string.',
    input_format = 'Two strings: the main string and the target substring.',
    output_format = 'Return YES if the substring exists, otherwise NO.'
WHERE title = 'Check Substring';

-- Count Vowels
UPDATE problems SET
    description = 'Calculate the total frequency of vowel characters (a, e, i, o, u) within a given string, regardless of case.',
    input_format = 'A single string value.',
    output_format = 'The count of vowels found.'
WHERE title = 'Count Vowels';

-- Replace Character
UPDATE problems SET
    description = 'Scan a string and substitute every occurrence of a specific character with another provided character.',
    input_format = 'A string s, a target character `old`, and a replacement character `new`.',
    output_format = 'The resulting string with characters replaced.'
WHERE title = 'Replace Character';

-- Remove Spaces From String
UPDATE problems SET
    description = 'Eliminate all whitespace characters from the given string to form a contiguous sequence of non-space characters.',
    input_format = 'A single string value.',
    output_format = 'The string with all spaces removed.'
WHERE title = 'Remove Spaces From String';

-- Count Spaces in String
UPDATE problems SET
    description = 'Determine the total number of whitespace characters present in the provided string.',
    input_format = 'A single string value.',
    output_format = 'The count of space characters.'
WHERE title = 'Count Spaces in String';

-- First Character
UPDATE problems SET
    description = 'Extract and return the very first character of the provided string.',
    input_format = 'A single non-empty string.',
    output_format = 'The first character of the string.'
WHERE title = 'First Character';

-- Last Character
UPDATE problems SET
    description = 'Extract and return the final character of the provided string.',
    input_format = 'A single non-empty string.',
    output_format = 'The last character of the string.'
WHERE title = 'Last Character';

-- Count Character Frequency
UPDATE problems SET
    description = 'Determine how many times a specific character appears within a given string.',
    input_format = 'A string s and a character c.',
    output_format = 'The count of character c in string s.'
WHERE title = 'Count Character Frequency';

-- Merge Two Arrays
UPDATE problems SET
    description = 'Concatenate two arrays into a single sequential collection. The elements of the first array should be followed immediately by those of the second.',
    input_format = 'Size and elements of Array 1, followed by size and elements of Array 2.',
    output_format = 'A single space-separated sequence of all elements.'
WHERE title = 'Merge Two Arrays';

-- Multiply All Elements
UPDATE problems SET
    description = 'Calculate the product of every numerical value contained within the array. Initial value for accumulation should be 1.',
    input_format = 'An integer n followed by n integers.',
    output_format = 'The result of multiplying all elements.'
WHERE title = 'Multiply All Elements';

-- Square of Numbers
UPDATE problems SET
    description = 'Calculate the square of a given integer (n * n).',
    input_format = 'A single integer n.',
    output_format = 'The square of n.'
WHERE title = 'Square of Numbers';

-- Cube of Numbers
UPDATE problems SET
    description = 'Calculate the cube of a given integer (n * n * n).',
    input_format = 'A single integer n.',
    output_format = 'The cube of n.'
WHERE title = 'Cube of Numbers';

-- Remove Character From String
UPDATE problems SET
    description = 'Generates a new string by removing all instances of a specified character from the original input.',
    input_format = 'A string s and a character c to remove.',
    output_format = 'The string with all instances of c removed.'
WHERE title = 'Remove Character From String';

-- Valid Parentheses
UPDATE problems SET
    description = 'Given a string containing just the characters "(", ")", "{", "}", "[" and "]", determine if the input string is valid. An input string is valid if open brackets are closed by the same type of brackets and in the correct order.',
    input_format = 'A single string consisting of brackets.',
    output_format = 'YES if valid, NO otherwise.'
WHERE title = 'Valid Parentheses';

-- Median of Two Sorted Arrays
UPDATE problems SET
    description = 'Find the median value of two sorted arrays. The median is the middle element of the combined sorted sequence (or the average of the two middle elements if the total count is even).',
    input_format = 'Two sorted arrays.',
    output_format = 'The numerical median.'
WHERE title = 'Median of Two Sorted Arrays';

-- Longest Common Subsequence
UPDATE problems SET
    description = 'Given two strings, find the length of their longest common subsequence. A subsequence is a sequence that appears in the same relative order, but not necessarily contiguously.',
    input_format = 'Two strings s1 and s2.',
    output_format = 'The length of the longest common subsequence.'
WHERE title = 'Longest Common Subsequence';

-- Binary Search
UPDATE problems SET
    description = 'Efficiently locate the index of a target element within a sorted integer array using the binary search algorithm. This algorithm repeatedly divides the search interval in half to achieve logarithmic time complexity.',
    input_format = 'A sorted integer array `nums` and a target value `x`.',
    output_format = 'The zero-based index of `x` if it exists in `nums`, otherwise -1.'
WHERE title = 'Binary Search';

