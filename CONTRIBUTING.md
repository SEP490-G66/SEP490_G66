# Git convention (linked to Jira)

Jira shows a ticket's branches, commits and pull requests, including whether the PR is **MERGED**, in the **Development** panel. It finds them only by the Jira key written exactly as `SCRUM-<number>`: uppercase, with the hyphen.

| Written as | Linked to Jira? |
|---|---|
| `SCRUM-890` | Yes |
| `SCRUM890`, `scrum-890`, `SCUM-890`, `feat1006` | No |

## 1. Branch

```
<type>/SCRUM-<number>-<short-description>
```

Example: `feat/SCRUM-890-in-app-notifications`

`type` is one of `feat`, `fix`, `test`, `refactor`, `docs`, `chore`.

## 2. Commit

```
<type>(SCRUM-<number>): <what changed, imperative, English>

<optional body: why, and anything a reviewer should know>
```

Example:

```
feat(SCRUM-1010): wire monthly shifts to bulk preview/create APIs

Calendar preview calls POST /api/work-shifts/bulk/preview before saving.
```

Put the key in **every** commit, not only the first one. A commit without the key does not appear on the ticket.

## 3. Pull request

- **Title:** `SCRUM-<number> <short description>`, for example `SCRUM-890 Add in-app notifications`.
- **Description:** fill in the template (Jira, What changed, Why, How to test).
- Merge into `main` only through a PR, not by pushing directly.

## 4. Checking a ticket in Jira

Open the ticket and look at the **Development** panel on the right:

- **branch**: the branches that contain the key.
- **commits**: click to see each commit's message and description.
- **pull request**: shows `OPEN`, `MERGED` or `DECLINED`. `MERGED` means the work is already on `main`.

Click a pull request to open it on GitHub:

- the **Conversation** tab shows the description;
- the **Commits** tab shows each commit;
- the purple **Merged** badge shows who merged it, when, and into which branch.

## 5. Fixing an old PR that is not linked

Edit the PR title on GitHub and add the key, for example change `Feat/scrum890 develop notification` to `SCRUM-890 Develop notification`. Jira picks up the change after the next sync. Commits that are already merged cannot be renamed. The PR link is enough to see the description and the merge status.
