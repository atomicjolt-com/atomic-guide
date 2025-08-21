---
allowed-tools: Bash(git:*), npm, Read, WebFetch
description: Run tests and fix failing tests
---

## Instructions and Context

The application does contains failing tests. I need you to use specialized AI agents to review the
tests output and provide fixes until all the tests are passing.

- When writing code that generates test data create data specific to the test. Make sure that it is
  random so that we don't end up with insert or update conficts in the database.

- Other tests will be running at the same time. Keep in mind the multi-threaded nature of the test
  environment

- If data is created in a test make sure that data and only that data is precisely cleaned up at the
  end of the test. In order to be thread safe we should NOT delete all data from a table after test.
  Be specific, about what is created and deleted in each test.

## Commands

- Run tests in the background: `npm run test`

- Example of how to run a specific set of tests `npm run --test [name of test file]`

## Process:

1. Run tests in the background `npm run test`
2. Review the test output and find any failing tests.
3. If tests are failing determine why they are failing. You might need to add debugging output to
   the application code to determine why the tests are failing.
4. Determine if the test failure is due to failures in the test that need to be fixed or if the
   application code needs to be fixed.
5. Make a plan for fixing the failing tests.
6. Implement the fixes.
7. Cycling back to #1. Repeat this process until all tests are fixed.
