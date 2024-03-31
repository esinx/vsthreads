

VSThreads is a [VSCode](https://code.visualstudio.com) extension to create and reply to discussion threads anywhere within a codebase. It combines the in-context, line by line, clarity of a PR comment, and the convenience/visibility necessary to support active collaboration for in-progress projects.

Within their existing code editor, a user can create a discussion thread on any given line of code using Markdown or HTML formatting. Their team can then respond at their leisure and/or leave Slack-like reactions.

VSThreads has a wide range of applications. Educators can leave constructive feedback on student code where it already is, without having to switch to another dedicated platform (e.g. Gradescope) or impose additional burdens (e.g. making a PR for in-progress projects). Interviewers can meet students in their existing, configured IDEs, using vsthreads alongside something like [Live Share](https://visualstudio.microsoft.com/services/live-share/) to leave notes in real-time. Anyone working on features simultaneously with another person can benefit.

We used Typescript for development of the extension itself, as well as FastAPI and MongoDB on the backend, and GitHub authentication to secure ownership of threads.
