# Execute BASE PRP

Implement a TypeScript/JavaScript feature using the PRP file.

## PRP File: $ARGUMENTS

## Execution Process

1. **Load PRP**
   - Read the specified PRP file
   - Understand all context and requirements
   - Follow all instructions in the PRP and extend the research if needed
   - Ensure you have all needed context to implement the PRP fully
   - Do more web searches and codebase exploration as needed

2. **ULTRATHINK**
   - Ultrathink before you execute the plan. Create a comprehensive plan addressing all requirements.
   - Break down the PRP into clear todos using the TodoWrite tool.
   - Use agents subagents and batchtool to enhance the process.
   - **Important** YOU MUST ENSURE YOU HAVE EXTREMELY CLEAR TASKS FOR SUBAGENTS AND REFERENCE CONTEXT AND MAKE SURE EACH SUBAGENT READS THE PRP AND UNDERSTANDS ITS CONTEXT.
   - Identify implementation patterns from existing code to follow.
   - Never guess about imports, file names function names etc, ALWAYS be based in reality and real context gathering

3. ## **Execute the plan**

   ## Execute the PRP step by step
   - Implement all the code
   - Follow TypeScript/JavaScript best practices
   - Ensure proper type safety and error handling
   - Follow existing codebase patterns and conventions

4. **Validate**
   - Run each validation command from the PRP
   - The better validation that is done, the more confident we can be that the implementation is correct.
   - Utilize the playwright MCP to view all UI changes. Ensure all branding guidelines have been followed (ai_docs/branding/style-guide.md)
   - Start a sub agent and request command `/fix_lint_errors`. Wait for the agent to finish
   - Start a sub agent and request command `/fix_js_tests`. Wait for the agent to finish
   - Start a sub agent and request command `/fix_js_tests`. Wait for the agent to finish
   - Always re-read the PRP to validate and review the implementation to ensure it meets the requirements

5. **Complete**
   - Ensure all checklist items done
   - Run final validation suite
   - Report completion status
   - Document new features and any information valuable to a user. If the information is short modify README.md with the new information. If it is long create a new file in docs/ and update README.md with a new summary section and link to the new file.
   - Read the PRP again to ensure you have implemented everything

6. **Reference the PRP**
   - You can always reference the PRP again if needed

Note: If validation fails, use error patterns in PRP to fix and retry.
