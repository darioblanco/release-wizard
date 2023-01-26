# Contributing Guide

- Check out a new branch based on `main` and name it to what you intend to do,
  based on the company's branch naming conventions:

  - Example:

    ```sh
    git checkout -b BRANCH_NAME origin/main
    ```

    If you get an error, you may need to fetch `main` first by using

    ```sh
    git remote update && git fetch
    ```

  - Use one branch per fix/feature

- Make your changes
  - Make sure to provide a spec for unit tests (and any other relevant tests).
  - When all tests pass, everything's fine.
- Commit your changes
  - Please provide a git message that explains what you've done based on the conventional commit standard.
  - Commit to your local branch.
- Make a pull request
  - Make sure you send the PR to the `main` branch.
  - Github actions will verify your code.
  - A code owner must approve your change before it can be merged.

If you follow these instructions, your PR will land pretty safely in the repo once approved.
