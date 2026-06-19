workspace "SpecPad" "C4 model of SpecPad (dogfood). Render with Structurizr." {

  model {
    developer = person "Developer" "Authors specs and code with Claude Code."
    reviewer = person "Reviewer" "Approves design-controls evidence in the eQMS."

    specpad = softwareSystem "SpecPad" "Governs structured software documentation (SRS/VTP/SAD) and produces design-controls evidence." {
      contract = container "Shared contract" "JSON Schema + governance + id-keyed diff" "TypeScript (src/shared)"
      editor = container "Hosted editor" "Visual editor for the spec files; renders change tracking and jobs." "React SPA"
      skill = container "Claude Code skill" "Scaffolds, governs, caches, and exports; git plumbing." "SKILL.md + git"
      repo = container "Spec files + cache" "docs/specpad/*.json|md|dsl + .specpad/ baselines & job caches" "Git"
    }

    claudeCode = softwareSystem "Claude Code" "Runs the SpecPad skill." "External"
    eqms = softwareSystem "eQMS" "Quality system of record; formal review and approval." "External"
    structurizr = softwareSystem "Structurizr" "Renders the C4 model from this DSL." "External"

    developer -> claudeCode "Designs and builds with"
    claudeCode -> skill "Runs"
    skill -> repo "Writes spec files, caches, and trailers"
    skill -> contract "Validates against / governs with"
    developer -> editor "Edits spec files visually"
    editor -> contract "Validates against / governs with"
    editor -> repo "Reads/writes via File System Access API"
    skill -> eqms "Exports design-controls evidence to"
    reviewer -> eqms "Reviews and approves in"
    editor -> structurizr "C4 DSL rendered by"
  }

  views {
    systemContext specpad "Context" {
      include *
      autolayout lr
    }
    container specpad "Containers" {
      include *
      autolayout lr
    }
    theme default
  }
}
