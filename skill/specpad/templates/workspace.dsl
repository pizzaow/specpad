workspace "PROJECT_NAME" "C4 model for PROJECT_NAME. Render with Structurizr." {

  model {
    user = person "User" "Primary user of the system."

    system = softwareSystem "PROJECT_NAME" "What the system does." {
      web = container "Web app" "User-facing UI" "(technology)"
      api = container "API / backend" "Business logic and endpoints" "(technology)"
      db = container "Data store" "Persistence" "(technology)"
    }

    # external = softwareSystem "External system" "..." "External"

    user -> web "Uses"
    web -> api "Calls"
    api -> db "Reads/writes"

    # Medical profile only: classify each unit, e.g.
    #   api = container "..." { properties { "class" "C" } tags "Class C" }
    # and colour by class in the styles block below.
  }

  views {
    systemContext system "Context" {
      include *
      autolayout lr
    }
    container system "Containers" {
      include *
      autolayout lr
    }
    # component api "Components" { include * autolayout lr }
    # deployment system "Production" "Deployment" { ... }

    styles {
      element "Class A" { background #66bb6a }
      element "Class B" { background #ffa726 }
      element "Class C" { background #ef5350 }
    }
    theme default
  }
}
