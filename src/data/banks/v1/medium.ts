import type { Problem } from "../../problemTypes";

export const mediumProblems: Problem[] = [
  {
    id: "count-even-numbers",
    title: "Count the Evens",
    difficulty: "medium",
    tags: ["lists", "loops", "modulo"],
    description: `# Count the Evens

Count how many numbers in a list are even.

## Input
One line of whole numbers separated by spaces.

## Output
Print the number of even values. Remember that zero is even.

### Example
Input: \`1 2 4 7\`
Output: \`2\``,
    starterCode: `numbers = [int(value) for value in input().split()]
count = 0

# Count the even numbers

print(count)
`,
    solutionCode: `numbers = [int(value) for value in input().split()]
count = 0
for number in numbers:
    if number % 2 == 0:
        count += 1
print(count)`,
    testCases: [
      { input: "1 2 4 7", expectedOutput: "2" },
      { input: "0 3 8 11 12 15", expectedOutput: "3" },
      { input: "1 3 5 7", expectedOutput: "0" },
    ],
  },
  {
    id: "prime-finder",
    title: "Prime Finder",
    difficulty: "medium",
    tags: ["lists", "nested-loops", "numbers"],
    description: `# Prime Finder

Find every prime number in a list. A prime number is greater than 1 and is divisible only by 1 and itself.

## Input
One line of positive whole numbers separated by spaces.

## Output
Print the prime values in their original order, separated by spaces. Print \`none\` if there are no primes.

### Example
Input: \`4 5 8 11\`
Output: \`5 11\``,
    starterCode: `numbers = [int(value) for value in input().split()]
primes = []

for number in numbers:
    is_prime = True
    # Check whether number is prime

if primes:
    print(*primes)
else:
    print("none")
`,
    solutionCode: `numbers = [int(value) for value in input().split()]
primes = []
for number in numbers:
    is_prime = number > 1
    divisor = 2
    while divisor < number:
        if number % divisor == 0:
            is_prime = False
            break
        divisor += 1
    if is_prime:
        primes.append(number)
if primes:
    print(*primes)
else:
    print("none")`,
    testCases: [
      { input: "4 5 8 11", expectedOutput: "5 11" },
      { input: "1 2 3 4 9 13", expectedOutput: "2 3 13" },
      { input: "1 4 6 8 10", expectedOutput: "none" },
    ],
  },
  {
    id: "list-sum",
    title: "List Sum",
    difficulty: "medium",
    tags: ["lists", "loops", "arithmetic"],
    description: `# List Sum

Add every number in a list.

## Input
One line of whole numbers separated by spaces.

## Output
Print their total.

### Example
Input: \`4 7 2\`
Output: \`13\``,
    starterCode: `numbers = [int(value) for value in input().split()]
total = 0

# Add each number to total

print(total)
`,
    solutionCode: `numbers = [int(value) for value in input().split()]
total = 0
for number in numbers:
    total += number
print(total)`,
    testCases: [
      { input: "4 7 2", expectedOutput: "13" },
      { input: "10 -3 5 -2", expectedOutput: "10" },
      { input: "0 0 0", expectedOutput: "0" },
    ],
  },
  {
    id: "largest-number",
    title: "Largest Number",
    difficulty: "medium",
    tags: ["lists", "loops", "comparisons"],
    description: `# Largest Number

Find the largest value in a list without changing the list.

## Input
One non-empty line of whole numbers separated by spaces.

## Output
Print the largest number.

### Example
Input: \`3 9 2 7\`
Output: \`9\``,
    starterCode: `numbers = [int(value) for value in input().split()]
largest = numbers[0]

# Compare the numbers with largest

print(largest)
`,
    solutionCode: `numbers = [int(value) for value in input().split()]
largest = numbers[0]
for number in numbers:
    if number > largest:
        largest = number
print(largest)`,
    testCases: [
      { input: "3 9 2 7", expectedOutput: "9" },
      { input: "-8 -2 -15", expectedOutput: "-2" },
      { input: "5 5 5", expectedOutput: "5" },
    ],
  },
  {
    id: "vowel-counter",
    title: "Vowel Counter",
    difficulty: "medium",
    tags: ["strings", "loops", "conditionals"],
    description: `# Vowel Counter

Count the vowels in a line of text. The vowels are a, e, i, o, and u.

## Input
One line of text.

## Output
Print the number of vowels. Uppercase and lowercase vowels both count.

### Example
Input: \`Python is fun\`
Output: \`3\``,
    starterCode: `text = input().lower()
count = 0

# Count letters that are vowels

print(count)
`,
    solutionCode: `text = input().lower()
count = 0
for letter in text:
    if letter in "aeiou":
        count += 1
print(count)`,
    testCases: [
      { input: "Python is fun", expectedOutput: "3" },
      { input: "AEIOU", expectedOutput: "5" },
      { input: "rhythms", expectedOutput: "0" },
    ],
  },
  {
    id: "reverse-word-order",
    title: "Reverse the Words",
    difficulty: "medium",
    tags: ["strings", "lists", "slicing"],
    description: `# Reverse the Words

Reverse the order of the words in a sentence, but keep each word spelled normally.

## Input
One line containing words separated by spaces.

## Output
Print the words in reverse order with one space between them.

### Example
Input: \`climb the mountain\`
Output: \`mountain the climb\``,
    starterCode: `words = input().split()

# Reverse the list of words
`,
    solutionCode: `words = input().split()
print(*words[::-1])`,
    testCases: [
      { input: "climb the mountain", expectedOutput: "mountain the climb" },
      { input: "one two", expectedOutput: "two one" },
      { input: "python", expectedOutput: "python" },
    ],
  },
  {
    id: "five-products",
    title: "Five Products",
    difficulty: "medium",
    tags: ["loops", "lists", "multiplication"],
    description: `# Five Products

Create the first five multiples of a number.

## Input
One whole number.

## Output
Print the number multiplied by 1, 2, 3, 4, and 5 on one line, separated by spaces.

### Example
Input: \`4\`
Output: \`4 8 12 16 20\``,
    starterCode: `number = int(input())
products = []

# Add the first five multiples

print(*products)
`,
    solutionCode: `number = int(input())
products = []
for multiplier in range(1, 6):
    products.append(number * multiplier)
print(*products)`,
    testCases: [
      { input: "4", expectedOutput: "4 8 12 16 20" },
      { input: "7", expectedOutput: "7 14 21 28 35" },
      { input: "0", expectedOutput: "0 0 0 0 0" },
    ],
  },
  {
    id: "unique-values",
    title: "Keep It Unique",
    difficulty: "medium",
    tags: ["lists", "loops", "membership"],
    description: `# Keep It Unique

Remove repeated numbers while keeping their first appearance.

## Input
One line of whole numbers separated by spaces.

## Output
Print each different number once, in its original order.

### Example
Input: \`2 5 2 7 5\`
Output: \`2 5 7\``,
    starterCode: `numbers = [int(value) for value in input().split()]
unique = []

# Add only numbers not already in unique

print(*unique)
`,
    solutionCode: `numbers = [int(value) for value in input().split()]
unique = []
for number in numbers:
    if number not in unique:
        unique.append(number)
print(*unique)`,
    testCases: [
      { input: "2 5 2 7 5", expectedOutput: "2 5 7" },
      { input: "1 1 1 1", expectedOutput: "1" },
      { input: "3 2 1", expectedOutput: "3 2 1" },
    ],
  },
  {
    id: "running-totals",
    title: "Running Totals",
    difficulty: "medium",
    tags: ["lists", "loops", "accumulators"],
    description: `# Running Totals

Show the total after each number is added.

## Input
One line of whole numbers separated by spaces.

## Output
Print the running totals on one line.

### Example
Input: \`2 4 3\`
Output: \`2 6 9\``,
    starterCode: `numbers = [int(value) for value in input().split()]
total = 0
totals = []

# Update total and save it after each number

print(*totals)
`,
    solutionCode: `numbers = [int(value) for value in input().split()]
total = 0
totals = []
for number in numbers:
    total += number
    totals.append(total)
print(*totals)`,
    testCases: [
      { input: "2 4 3", expectedOutput: "2 6 9" },
      { input: "5 -2 4", expectedOutput: "5 3 7" },
      { input: "0 1 0 1", expectedOutput: "0 1 1 2" },
    ],
  },
  {
    id: "password-strength",
    title: "Password Strength",
    difficulty: "medium",
    tags: ["strings", "loops", "conditionals"],
    description: `# Password Strength

A password is strong when it has at least 8 characters and contains at least one number.

## Input
One password with no spaces.

## Output
Print \`strong\` if both rules are met. Otherwise print \`weak\`.

### Example
Input: \`climb123\`
Output: \`strong\``,
    starterCode: `password = input()
has_number = False

# Look for a number and check the length
`,
    solutionCode: `password = input()
has_number = False
for character in password:
    if character.isdigit():
        has_number = True
if len(password) >= 8 and has_number:
    print("strong")
else:
    print("weak")`,
    testCases: [
      { input: "climb123", expectedOutput: "strong" },
      { input: "longpassword", expectedOutput: "weak" },
      { input: "abc123", expectedOutput: "weak" },
    ],
  },
  {
    id: "fizzbuzz-range",
    title: "FizzBuzz Range",
    difficulty: "medium",
    tags: ["loops", "conditionals", "modulo"],
    description: `# FizzBuzz Range

List the numbers from 1 through n. Replace multiples of 3 with \`Fizz\`, multiples of 5 with \`Buzz\`, and multiples of both with \`FizzBuzz\`.

## Input
One positive whole number n.

## Output
Print all results on one line separated by spaces.

### Example
Input: \`5\`
Output: \`1 2 Fizz 4 Buzz\``,
    starterCode: `n = int(input())
results = []

# Build one result for every number from 1 through n

print(*results)
`,
    solutionCode: `n = int(input())
results = []
for number in range(1, n + 1):
    if number % 15 == 0:
        results.append("FizzBuzz")
    elif number % 3 == 0:
        results.append("Fizz")
    elif number % 5 == 0:
        results.append("Buzz")
    else:
        results.append(number)
print(*results)`,
    testCases: [
      { input: "5", expectedOutput: "1 2 Fizz 4 Buzz" },
      { input: "3", expectedOutput: "1 2 Fizz" },
      { input: "15", expectedOutput: "1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz" },
    ],
  },
  {
    id: "digit-sum",
    title: "Digit Sum",
    difficulty: "medium",
    tags: ["strings", "loops", "numbers"],
    description: `# Digit Sum

Add all the digits in a non-negative whole number.

## Input
One non-negative whole number.

## Output
Print the sum of its digits.

### Example
Input: \`482\`
Output: \`14\``,
    starterCode: `digits = input()
total = 0

# Convert and add each digit

print(total)
`,
    solutionCode: `digits = input()
total = 0
for digit in digits:
    total += int(digit)
print(total)`,
    testCases: [
      { input: "482", expectedOutput: "14" },
      { input: "10001", expectedOutput: "2" },
      { input: "0", expectedOutput: "0" },
    ],
  },
  {
    id: "factor-list",
    title: "Factor List",
    difficulty: "medium",
    tags: ["loops", "division", "number-theory"],
    description: `# Factor List

A factor divides a number with no remainder. Find every positive factor of a number.

## Input
One positive whole number.

## Output
Print all factors from smallest to largest, separated by spaces.

### Example
Input: \`12\`
Output: \`1 2 3 4 6 12\``,
    starterCode: `number = int(input())
factors = []

# Test every possible factor

print(*factors)
`,
    solutionCode: `number = int(input())
factors = []
for candidate in range(1, number + 1):
    if number % candidate == 0:
        factors.append(candidate)
print(*factors)`,
    testCases: [
      { input: "12", expectedOutput: "1 2 3 4 6 12" },
      { input: "7", expectedOutput: "1 7" },
      { input: "1", expectedOutput: "1" },
    ],
  },
  {
    id: "target-word-count",
    title: "Target Word Count",
    difficulty: "medium",
    tags: ["strings", "lists", "counting"],
    description: `# Target Word Count

Count how many times a target word appears in a sentence. Capital letters should not affect the match.

## Input
The first line is a sentence. The second line is the target word.

## Output
Print the number of matches.

### Example
Input: \`Go go stop go\` and \`go\`
Output: \`3\``,
    starterCode: `words = input().lower().split()
target = input().lower()
count = 0

# Count words equal to target

print(count)
`,
    solutionCode: `words = input().lower().split()
target = input().lower()
count = 0
for word in words:
    if word == target:
        count += 1
print(count)`,
    testCases: [
      { input: "Go go stop go\ngo", expectedOutput: "3" },
      { input: "python is fun\ncode", expectedOutput: "0" },
      { input: "Red blue red RED\nred", expectedOutput: "3" },
    ],
  },
  {
    id: "shared-values",
    title: "Shared Values",
    difficulty: "medium",
    tags: ["lists", "membership", "duplicates"],
    description: `# Shared Values

Find values that appear in both lists. Keep the order of the first list and print each shared value only once.

## Input
Two lines of whole numbers separated by spaces.

## Output
Print the shared values, or \`none\` when there are none.

### Example
Input lists: \`1 2 3 2\` and \`2 4 3\`
Output: \`2 3\``,
    starterCode: `first = [int(value) for value in input().split()]
second = [int(value) for value in input().split()]
shared = []

# Keep values found in both lists only once
`,
    solutionCode: `first = [int(value) for value in input().split()]
second = [int(value) for value in input().split()]
shared = []
for number in first:
    if number in second and number not in shared:
        shared.append(number)
if shared:
    print(*shared)
else:
    print("none")`,
    testCases: [
      { input: "1 2 3 2\n2 4 3", expectedOutput: "2 3" },
      { input: "5 6\n1 2", expectedOutput: "none" },
      { input: "9 8 9\n9 8", expectedOutput: "9 8" },
    ],
  },
  {
    id: "rotate-left",
    title: "Rotate Left",
    difficulty: "medium",
    tags: ["lists", "slicing", "reordering"],
    description: `# Rotate Left

Move the first item in a list to the end.

## Input
One non-empty line of words separated by spaces.

## Output
Print the rotated words separated by spaces.

### Example
Input: \`a b c d\`
Output: \`b c d a\``,
    starterCode: `items = input().split()

# Join everything after the first item with the first item
`,
    solutionCode: `items = input().split()
rotated = items[1:] + items[:1]
print(*rotated)`,
    testCases: [
      { input: "a b c d", expectedOutput: "b c d a" },
      { input: "red blue", expectedOutput: "blue red" },
      { input: "solo", expectedOutput: "solo" },
    ],
  },
  {
    id: "passing-score-count",
    title: "Passing Score Count",
    difficulty: "medium",
    tags: ["lists", "comparisons", "counting"],
    description: `# Passing Score Count

A score of 60 or higher passes. Count the passing scores in a class list.

## Input
One line of whole-number scores separated by spaces.

## Output
Print the number of passing scores.

### Example
Input: \`55 60 72 40\`
Output: \`2\``,
    starterCode: `scores = [int(value) for value in input().split()]
passing = 0

# Count scores of at least 60

print(passing)
`,
    solutionCode: `scores = [int(value) for value in input().split()]
passing = 0
for score in scores:
    if score >= 60:
        passing += 1
print(passing)`,
    testCases: [
      { input: "55 60 72 40", expectedOutput: "2" },
      { input: "100 90 80", expectedOutput: "3" },
      { input: "10 20 30", expectedOutput: "0" },
    ],
  },
  {
    id: "character-groups",
    title: "Character Groups",
    difficulty: "medium",
    tags: ["strings", "classification", "counting"],
    description: `# Character Groups

Count letters, digits, and all other characters in a line.

## Input
One line of text.

## Output
Print the letter count, digit count, and other count in that order.

### Example
Input: \`Room 7!\`
Output: \`4 1 2\``,
    starterCode: `text = input()
letters = 0
digits = 0
other = 0

# Classify each character
`,
    solutionCode: `text = input()
letters = 0
digits = 0
other = 0
for character in text:
    if character.isalpha():
        letters += 1
    elif character.isdigit():
        digits += 1
    else:
        other += 1
print(letters, digits, other)`,
    testCases: [
      { input: "Room 7!", expectedOutput: "4 1 2" },
      { input: "abc123", expectedOutput: "3 3 0" },
      { input: "...", expectedOutput: "0 0 3" },
    ],
  },
  {
    id: "coupon-total",
    title: "Coupon Total",
    difficulty: "medium",
    tags: ["conditionals", "arithmetic", "shopping"],
    description: `# Coupon Total

A store subtracts 20 dollars when a purchase is at least 100 dollars.

## Input
One whole-number purchase total.

## Output
Print the total after applying the coupon when eligible.

### Example
Input: \`125\`
Output: \`105\``,
    starterCode: `total = int(input())

# Apply the coupon when the total qualifies
`,
    solutionCode: `total = int(input())
if total >= 100:
    total -= 20
print(total)`,
    testCases: [
      { input: "125", expectedOutput: "105" },
      { input: "100", expectedOutput: "80" },
      { input: "99", expectedOutput: "99" },
    ],
  },
  {
    id: "title-case-words",
    title: "Title Case Words",
    difficulty: "medium",
    tags: ["strings", "lists", "formatting"],
    description: `# Title Case Words

Capitalize the first letter of every word and lowercase its other letters.

## Input
One line containing words separated by spaces.

## Output
Print the newly formatted words.

### Example
Input: \`pYTHON summer CAMP\`
Output: \`Python Summer Camp\``,
    starterCode: `words = input().split()
formatted = []

# Format each word

print(*formatted)
`,
    solutionCode: `words = input().split()
formatted = []
for word in words:
    formatted.append(word.capitalize())
print(*formatted)`,
    testCases: [
      { input: "pYTHON summer CAMP", expectedOutput: "Python Summer Camp" },
      { input: "hello world", expectedOutput: "Hello World" },
      { input: "ONE", expectedOutput: "One" },
    ],
  },
  {
    id: "integer-average",
    title: "Integer Average",
    difficulty: "medium",
    tags: ["lists", "arithmetic", "floor-division"],
    description: `# Integer Average

Find the average of a list and round it down to the nearest whole number.

## Input
One non-empty line of whole numbers separated by spaces.

## Output
Print the rounded-down average.

### Example
Input: \`3 7 8\`
Output: \`6\``,
    starterCode: `numbers = [int(value) for value in input().split()]
total = 0

# Add the numbers and divide by the list length
`,
    solutionCode: `numbers = [int(value) for value in input().split()]
total = 0
for number in numbers:
    total += number
print(total // len(numbers))`,
    testCases: [
      { input: "3 7 8", expectedOutput: "6" },
      { input: "10 20 30", expectedOutput: "20" },
      { input: "1 2", expectedOutput: "1" },
    ],
  },
  {
    id: "list-range",
    title: "List Range",
    difficulty: "medium",
    tags: ["lists", "minimum", "maximum"],
    description: `# List Range

The range of a list is its largest value minus its smallest value.

## Input
One non-empty line of whole numbers separated by spaces.

## Output
Print the range.

### Example
Input: \`4 10 2 7\`
Output: \`8\``,
    starterCode: `numbers = [int(value) for value in input().split()]
smallest = numbers[0]
largest = numbers[0]

# Update the smallest and largest values
`,
    solutionCode: `numbers = [int(value) for value in input().split()]
smallest = numbers[0]
largest = numbers[0]
for number in numbers:
    if number < smallest:
        smallest = number
    if number > largest:
        largest = number
print(largest - smallest)`,
    testCases: [
      { input: "4 10 2 7", expectedOutput: "8" },
      { input: "-5 -2 -9", expectedOutput: "7" },
      { input: "6 6 6", expectedOutput: "0" },
    ],
  },
  {
    id: "word-palindrome",
    title: "Word Palindrome",
    difficulty: "medium",
    tags: ["strings", "slicing", "conditionals"],
    description: `# Word Palindrome

A palindrome word reads the same forward and backward. Capital letters should not affect the answer.

## Input
One word.

## Output
Print \`yes\` or \`no\`.

### Example
Input: \`Racecar\`
Output: \`yes\``,
    starterCode: `word = input().lower()

# Compare the word with its reverse
`,
    solutionCode: `word = input().lower()
if word == word[::-1]:
    print("yes")
else:
    print("no")`,
    testCases: [
      { input: "Racecar", expectedOutput: "yes" },
      { input: "python", expectedOutput: "no" },
      { input: "level", expectedOutput: "yes" },
    ],
  },
  {
    id: "acronym-builder",
    title: "Acronym Builder",
    difficulty: "medium",
    tags: ["strings", "lists", "indexing"],
    description: `# Acronym Builder

Create an acronym from the first letter of every word in a phrase.

## Input
One line containing words separated by spaces.

## Output
Print the uppercase acronym with no spaces.

### Example
Input: \`portable network graphics\`
Output: \`PNG\``,
    starterCode: `words = input().split()
acronym = ""

# Add the first letter of each word

print(acronym)
`,
    solutionCode: `words = input().split()
acronym = ""
for word in words:
    acronym += word[0].upper()
print(acronym)`,
    testCases: [
      { input: "portable network graphics", expectedOutput: "PNG" },
      { input: "central processing unit", expectedOutput: "CPU" },
      { input: "python", expectedOutput: "P" },
    ],
  },
  {
    id: "perfect-number",
    title: "Perfect Number",
    difficulty: "medium",
    tags: ["factors", "loops", "number-theory"],
    description: `# Perfect Number

A perfect number equals the sum of its positive factors other than itself.

## Input
One positive whole number.

## Output
Print \`perfect\` or \`not perfect\`.

### Example
Input: \`6\`
Output: \`perfect\``,
    starterCode: `number = int(input())
factor_total = 0

# Add factors smaller than number
`,
    solutionCode: `number = int(input())
factor_total = 0
for candidate in range(1, number):
    if number % candidate == 0:
        factor_total += candidate
if factor_total == number:
    print("perfect")
else:
    print("not perfect")`,
    testCases: [
      { input: "6", expectedOutput: "perfect" },
      { input: "28", expectedOutput: "perfect" },
      { input: "12", expectedOutput: "not perfect" },
    ],
  },
  {
    id: "alternate-merge",
    title: "Alternate Merge",
    difficulty: "medium",
    tags: ["lists", "loops", "merging"],
    description: `# Alternate Merge

Combine two equal-length lists by taking one item from each list at a time.

## Input
Two lines of words separated by spaces. Both lines have the same number of words.

## Output
Print the alternated result.

### Example
Input lists: \`a b c\` and \`1 2 3\`
Output: \`a 1 b 2 c 3\``,
    starterCode: `first = input().split()
second = input().split()
merged = []

# Add one item from each list at every index

print(*merged)
`,
    solutionCode: `first = input().split()
second = input().split()
merged = []
for index in range(len(first)):
    merged.append(first[index])
    merged.append(second[index])
print(*merged)`,
    testCases: [
      { input: "a b c\n1 2 3", expectedOutput: "a 1 b 2 c 3" },
      { input: "red blue\ncat dog", expectedOutput: "red cat blue dog" },
      { input: "x\ny", expectedOutput: "x y" },
    ],
  },
  {
    id: "word-length-map",
    title: "Word Length Map",
    difficulty: "medium",
    tags: ["dictionaries", "strings", "formatting"],
    description: `# Word Length Map

Store each different word with its length. Keep the order of first appearance.

## Input
One line of words separated by spaces.

## Output
Print \`word:length\` entries separated by spaces. Repeated words appear once.

### Example
Input: \`cat python cat\`
Output: \`cat:3 python:6\``,
    starterCode: `words = input().split()
lengths = {}

# Add words not already in the dictionary
`,
    solutionCode: `words = input().split()
lengths = {}
for word in words:
    if word not in lengths:
        lengths[word] = len(word)
results = []
for word in lengths:
    results.append(word + ":" + str(lengths[word]))
print(*results)`,
    testCases: [
      { input: "cat python cat", expectedOutput: "cat:3 python:6" },
      { input: "a to sun", expectedOutput: "a:1 to:2 sun:3" },
      { input: "repeat repeat", expectedOutput: "repeat:6" },
    ],
  },
  {
    id: "rising-pairs",
    title: "Rising Pairs",
    difficulty: "medium",
    tags: ["lists", "comparisons", "adjacent-values"],
    description: `# Rising Pairs

Count how many values are greater than the value immediately before them.

## Input
One non-empty line of whole numbers separated by spaces.

## Output
Print the number of increases.

### Example
Input: \`2 5 4 7 9\`
Output: \`3\``,
    starterCode: `numbers = [int(value) for value in input().split()]
increases = 0

# Compare each item after the first with its neighbor

print(increases)
`,
    solutionCode: `numbers = [int(value) for value in input().split()]
increases = 0
for index in range(1, len(numbers)):
    if numbers[index] > numbers[index - 1]:
        increases += 1
print(increases)`,
    testCases: [
      { input: "2 5 4 7 9", expectedOutput: "3" },
      { input: "5 4 3", expectedOutput: "0" },
      { input: "1 1 2 2 3", expectedOutput: "2" },
    ],
  },
  {
    id: "leap-year",
    title: "Leap Year",
    difficulty: "medium",
    tags: ["calendar", "conditionals", "modulo"],
    description: `# Leap Year

A leap year is divisible by 4, except century years must also be divisible by 400.

## Input
One positive whole-number year.

## Output
Print \`leap\` or \`common\`.

### Example
Input: \`2024\`
Output: \`leap\``,
    starterCode: `year = int(input())

# Apply the divisibility rules
`,
    solutionCode: `year = int(input())
if year % 400 == 0:
    print("leap")
elif year % 100 == 0:
    print("common")
elif year % 4 == 0:
    print("leap")
else:
    print("common")`,
    testCases: [
      { input: "2024", expectedOutput: "leap" },
      { input: "1900", expectedOutput: "common" },
      { input: "2000", expectedOutput: "leap" },
      { input: "2023", expectedOutput: "common" },
    ],
  },
  {
    id: "pair-sums",
    title: "Pair Sums",
    difficulty: "medium",
    tags: ["lists", "loops", "grouping"],
    description: `# Pair Sums

Group a list into neighboring pairs and add each pair.

## Input
One line containing an even number of whole numbers.

## Output
Print each pair's sum separated by spaces.

### Example
Input: \`1 4 2 8\`
Output: \`5 10\``,
    starterCode: `numbers = [int(value) for value in input().split()]
sums = []

# Move through the list two positions at a time

print(*sums)
`,
    solutionCode: `numbers = [int(value) for value in input().split()]
sums = []
for index in range(0, len(numbers), 2):
    sums.append(numbers[index] + numbers[index + 1])
print(*sums)`,
    testCases: [
      { input: "1 4 2 8", expectedOutput: "5 10" },
      { input: "5 5", expectedOutput: "10" },
      { input: "-2 7 10 -3 1 1", expectedOutput: "5 7 2" },
    ],
  },
];
