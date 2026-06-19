workspace "SpecPad" "C4 model of SpecPad (dogfood, generic profile). Render with Structurizr." {

  model {
    developer = person "Developer" "Authors specs and code with Claude Code."
    reviewer = person "Reviewer" "Approves design-controls evidence in the eQMS."

    specpad = softwareSystem "SpecPad" "Governs structured software documentation and produces design evidence." {
      contract = container "Shared contract" "JSON Schema + governance + id-keyed diff" "TypeScript (src/shared)"
      editor = container "Hosted editor" "Visual editor; renders change tracking, jobs, and architecture." "React SPA" {
        srsView = component "SRS/VTP tables" "Edit requirements and tests"
        jobsView = component "Jobs view" "Release notes + per-job diffs and commits"
        archView = component "Architecture view" "Renders arc42 + presents the C4 DSL"
        fileApi = component "Local file API" "Reads/writes via the File System Access API"
      }
      skill = container "Claude Code skill" "Scaffolds, governs, caches, exports; git plumbing." "SKILL.md + git"
      repo = container "Spec files + cache" "proj/srs/vtp, sad.md, workspace.dsl, .specpad/ baselines & job caches" "Git"
    }

    claudeCode = softwareSystem "Claude Code" "Runs the SpecPad skill." "External"
    eqms = softwareSystem "eQMS" "Quality system of record; formal review and approval." "External"
    structurizr = softwareSystem "Structurizr" "Renders the C4 model from this DSL." "External"

    developer -> claudeCode "Designs and builds with"
    claudeCode -> skill "Runs"
    skill -> repo "Writes spec files, caches, and Job: trailers"
    skill -> contract "Validates against / governs with"
    skill -> eqms "Exports design-controls evidence to"
    developer -> editor "Edits spec files visually"
    editor -> contract "Validates against / governs with"
    fileApi -> repo "Reads/writes via File System Access API"
    archView -> structurizr "C4 DSL rendered by"
    reviewer -> eqms "Reviews and approves in"
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
    component editor "Components" {
      include *
      autolayout lr
    }
    theme default
  }
}
