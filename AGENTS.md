# Strategy Square - Agent Instructions

## For AI Coding Agents

1. Read `CLAUDE.md` for quick reference
2. Read `docs/architecture.md` for full architecture
3. Read `docs/plans.md` for current milestones and tasks
4. Read `docs/implement.md` for execution rules
5. Check `tasks/todo.md` for task status

## Execution Flow

1. Pick the next `pending` task from `tasks/todo.md`
2. Implement fully (code + tests + configs)
3. Commit with format: `M{n}-T{m}: description`
4. Update `tasks/todo.md` status to `done`
5. Repeat

## Key Constraints

- One task = one atomic commit
- No compatibility shims
- Rewrite over patch
- API-first: build endpoints before UI
- Check `docs/architecture.md` before implementing anything
