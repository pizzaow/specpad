# Authoring guide — References

Read this before adding an entry. The enforced rules are `reference-located` and `reference-covers`.

## Purpose

The references register accounts for **the processes this project depends on but does not hold**.

IEC 62304 requires software development planning (§5.1), maintenance (clause 6) and problem resolution
(clause 9). SpecPad models none of them. That is a decision, not an oversight: companies already run
these in a quality system and an issue tracker, and a second copy living in a git repo would be the one
that goes stale — which is worse than no copy, because it looks authoritative.

So this register does what `hazardRef` does for the system risk management file: it **names the
document, says where it is, and says what it discharges**. A reviewer following the trace out of
SpecPad lands somewhere real.

## Keep it short

This is the rule people break. An entry earns its place by **discharging a clause the project would
otherwise have no answer for**. A register listing every SOP in the company is a filing cabinet; it
tells a reviewer nothing about this project and buries the four entries that mattered.

Ask of each entry: *if this were missing, which clause would go unanswered?* If nothing, remove it.

## What to capture

| Field | Answers |
|---|---|
| `title` | What the document is called, as its owner would name it |
| `kind` | `sop`, `plan`, `procedure`, `tracker`, `record`, `standard`, `other` |
| `identifier` | The controlled-document number and revision — "SOP-012 rev C" |
| `location` | Where it is kept: a URL, a system, a shelf |
| `owner` | The function that owns it — a role, never a person |
| `covers` | What it discharges: "IEC 62304 clause 9", "5.1 planning" |
| `notes` | Anything a reader needs in order to find or use it |

**`owner` is a role, not a person.** "Quality" survives someone leaving; "Priya" does not, and a
register full of former employees is how a reviewer learns the file is unmaintained.

**`identifier` matters more than it looks.** In an audit a reference is requested by number. An entry
with a title and no number sends someone searching, and searching is how a finding starts.

## The clauses this register usually answers

Not a checklist to fill — most projects need three or four entries, and some need none because they
hold nothing externally.

| Clause | What the reference usually is |
|---|---|
| §5.1 | The software development plan, and the SOP that governs planning |
| Clause 6 | The maintenance plan; the procedure for receiving and evaluating feedback |
| Clause 9 | The problem resolution procedure, and the tracker where problem reports live |
| §6.2.5 | How users and regulators are notified — often the same procedure as clause 9 |
| §8.2.1 | The change approval procedure, where approval is recorded outside git |
| §4.4 | The gap analysis and justification, where the software predates the standard |

## ✅ Good

- *"Software Problem Resolution Procedure, SOP-012 rev C, at qms.acme/SOP-012, owned by Quality,
  covering IEC 62304 clause 9, 5.6.8 and 8.2.4."* — findable, numbered, and it says which clauses stop
  being SpecPad's problem.
- A `tracker` entry naming the Jira project where problem reports live, so 8.2.4's "trace a change to
  its problem report" has somewhere to point.
- No entry at all for a project whose planning genuinely lives in this repo — the register is optional,
  and an empty one is more honest than a padded one.

## ❌ Bad (and why)

- *"Quality Manual."* — ❌ covers nothing in particular, so it discharges nothing in particular.
- An entry with a title and no location — ❌ a claim that a document exists, which is not a record that
  it does.
- Twenty SOPs copied from the QMS index — ❌ nobody will read the list, and the three that mattered are
  now invisible.
- A reference used to avoid writing something SpecPad *should* hold — ❌ if it is a requirement, a risk
  or a design, put it in the register that owns it. This file is for what genuinely lives elsewhere.
- Pointing at a document nobody has written yet — ❌ record the gap as a gap. A reference to a planned
  SOP reads, to a reviewer, exactly like a reference to a real one.

See also: `guides/risk.md` (`hazardRef`, the same move for the system risk file).
