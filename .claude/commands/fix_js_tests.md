---
allowed-tools: Bash(git:*), npm, Read, WebFetch
description: Run tests and fix failing tests
---

## Instructions and Context

The application contains failing tests.

- When writing code that generates test data create data specific to the test. Make sure that it is
  random so that we don't end up with insert or update conficts in the database.

- Keep in mind the multi-threaded nature of the test environment. Be careful not to generate data that could be delete by another test or depend on data where another test might be creating data at the same time.

- If data is created in a test make sure that data and only that data is precisely cleaned up at the
  end of the test. In order to be thread safe we should NOT delete all data from a table after test.
  Be specific, about what is created and deleted in each test.

## Commands

- Run tests in the background: `npm run test`

- Example of how to run a specific set of tests `npm run --test [name of test file]`

## Process:

1. Run tests in the background to get an idea of the overall failing tests `npm run test`
2. Review the test output.
3. If tests are failing determine why they are failing.
   1. Sometimes a large number of tests are failing for the same reason. If that is the case determine the root cause and fix that first.
   2. Are there groups of tests or tests suites that can be fixed in parallel? If so spawn new sub agents and task them with fixing specific tests. The subagents should only ever be tasked with fixing one file of failing tests at a time (`npm run --test [name of test file]`). Provide them with the proper context for fixing the failing tests including the following:
      1. Examine the test failure careful as well as the code that it tests. You will need to carefully examine the output and think deeply before making the following choice:
      2. If the test failure is due to problems with the code then make a plan and fix the code. Output your findings and think deeply about how to properly fix the error.
      3. If the test failure is due to failures in the test then focus on fixing the tests.
      4. You might need to add debugging output to the application code to determine why the tests are failing.
   3. Implement the fixes.
4. Wait for the sub agents to complete their fixes and gather their output.
5. Cycling back to #1. Repeat this process until all tests are fixed.
