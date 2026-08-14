<!-- specpad:working-loop -->
## SpecPad — capture requirements as you build

This project uses **SpecPad**: requirements and verification tests are a first-class output of
development, captured **spec-first** and attributed to a job — never written up afterward.

**Read `SKILL.md` from the specpad skill before doing spec work, and read the matching guide in its
`guides/` folder before writing each kind of entry.** This section deliberately does *not* restate the
working loop. A summary here would be a second copy of a procedure that changes, and the copy that is
convenient to follow is the one that goes stale — which is exactly how a loop gets followed from memory
and its guides never opened.

Three things that hold whether or not you have read it yet:

- **Every commit references a job** (a `Job:` trailer); the pre-push hook enforces it. A genuine
  refactor or comment-only change with no requirement uses a `Spec: none <reason>` trailer.
- **A change to product behaviour is not done until its requirement and verifying test exist**, in the
  same commit as the code.
- **Governance must be clean before you call anything finished** — run it, do not assume it.

If you find yourself about to write a requirement, a test, a design section, a risk, a component or a
threat without having opened the guide for it, that is the moment to open it.
<!-- /specpad:working-loop -->
