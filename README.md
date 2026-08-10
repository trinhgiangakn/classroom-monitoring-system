```text
classroom-monitoring-system/
│
├── README.md
│   # Main project introduction: purpose, architecture overview, prerequisites,
│   # installation steps, environment setup, build commands, and quick start.
│
├── CONTRIBUTING.md
│   # Collaboration guide: English-only task rules, branch naming,
│   # commit format, pull-request process, review rules, and merge policy.
│
├── CODING_CONVENTION.md
│   # Shared coding rules: snake_case, naming prefixes, English comments,
│   # formatting, error handling, logging, and code-review expectations.
│
├── mkdocs.yml
│   # Configuration file for MkDocs; defines documentation navigation,
│   # theme, markdown extensions, and generated documentation site settings.
│
├── Doxyfile
│   # Doxygen configuration used to generate C/C++ API documentation
│   # from documented STM32 and ESP32 source code.
│
├── docs/
│   # Human-readable project documents written mainly in Markdown.
│   │
│   ├── architecture/
│   │   # System design diagrams and technical architecture descriptions.
│   │   ├── system-architecture.drawio
│   │   │   # Full architecture: STM32 nodes, ESP32 Gateway, MQTT, Backend,
│   │   │   # MySQL, and React Web Dashboard.
│   │   ├── wsn-topology.drawio
│   │   │   # Wireless Sensor Network topology: four STM32 sensor nodes
│   │   │   # communicating with the ESP32 Gateway through BLE Advertising.
│   │   ├── data-flow.drawio
│   │   │   # Telemetry data flow from sensors to Dashboard and control flow
│   │   │   # from Dashboard back to Gateway devices.
│   │   ├── dashboard-api-flow.drawio
│   │   │   # Web UI action → REST API → MQTT command → Gateway ACK
│   │   │   # → Backend/WebSocket update → confirmed UI state.
│   │   ├── stm32-architecture.drawio
│   │   │   # STM32 modules: sensors, ADC/DMA, BLE payload creation,
│   │   │   # watchdog, scheduler, and configuration.
│   │   ├── stm32-flow.drawio
│   │   │   # STM32 execution flow: read sensors, validate data, package
│   │   │   # telemetry, advertise through BLE, then repeat periodically.
│   │   ├── esp32-architecture.drawio
│   │   │   # ESP32 modules: BLE scanner, Wi-Fi, MQTT, TFT, relay control,
│   │   │   # curtain motor control, ACK handling, and watchdog.
│   │   ├── esp32-flow.drawio
│   │   │   # ESP32 execution flow: scan BLE, publish MQTT telemetry,
│   │   │   # receive commands, control actuators, and send acknowledgements.
│   │   └── erd.drawio
│   │       # Entity Relationship Diagram for MySQL tables such as users,
│   │       # sensor_data, device_status, automation_rules, and audit_logs.
│   │
│   ├── api/
│   │   # API contracts between Backend and Web Dashboard.
│   │   ├── openapi.yaml
│   │   │   # OpenAPI/Swagger specification for REST endpoints, requests,
│   │   │   # responses, JWT authentication, and error codes.
│   │   ├── websocket-events.md
│   │   │   # WebSocket event names and payload definitions for live
│   │   │   # telemetry, device status, alerts, and command ACK updates.
│   │   └── doxygen/
│   │       # Generated Doxygen HTML/API output for firmware code.
│   │       # Usually generated locally and excluded from Git.
│   │
│   ├── frontend/
│   │   # Web Dashboard design and end-user documents.
│   │   ├── ui-screen-map.drawio
│   │   │   # Map of frontend screens and navigation paths, for example:
│   │   │   # Login, Dashboard, Analytics, Device Control, and Settings.
│   │   ├── wireframes/
│   │   │   # Low-fidelity UI designs for each Web Dashboard screen.
│   │   └── user-guide.md
│   │       # Instructions for end users: login, view telemetry, control
│   │       # devices, change Auto/Manual mode, and read alerts.
│   │
│   ├── development/
│   │   # Developer onboarding and engineering process documents.
│   │   ├── build-and-run.md
│   │   │   # Reproducible steps to install dependencies, configure .env,
│   │   │   # build firmware, run Docker services, and start the frontend.
│   │   ├── coding-convention.md
│   │   │   # Detailed coding examples complementing CODING_CONVENTION.md.
│   │   └── git-workflow.md
│   │       # Git workflow: task IDs, branch format, commits, pull requests,
│   │       # code review, merge rules, and Todo/In Progress/Done statuses.
│   │
│   ├── testing/
│   │   # Planning and reporting documents for quality assurance.
│   │   ├── test-plan.md
│   │   │   # Test scope, test environment, roles, schedule, tools,
│   │   │   # entry criteria, exit criteria, and risk management.
│   │   ├── test-cases.md
│   │   │   # Detailed test cases with ID, preconditions, steps,
│   │   │   # input data, expected result, and actual result.
│   │   └── test-report.md
│   │       # Executed test results, defects, fixes, evidence, and
│   │       # acceptance-test summary.
│   │
│   └── presentation/
│       └── project-presentation.pptx
│           # Slide deck for proposal, mid-term, final defense, architecture,
│           # demo flow, implementation progress, and test results.
│
├── firmware/
│   # Firmware projects for embedded devices.
│   │
│   ├── stm32-sensor-node/
│   │   # STM32F401RE firmware shared by four configured sensor nodes.
│   │   ├── test/
│   │   │   # Unit tests for sensor drivers, payload creation, validation,
│   │   │   # and embedded business logic where hardware permits testing.
│   │   └── README.md
│   │       # STM32 IDE/toolchain setup, build, flash, configuration,
│   │       # calibration, and troubleshooting guide.
│   │
│   └── esp32-gateway/
│       # ESP32 Gateway firmware for BLE scanning, MQTT communication,
│       # TFT display, relay control, and curtain motor control.
│       ├── test/
│       │   # PlatformIO/unit tests and hardware-in-the-loop Gateway tests.
│       └── README.md
│           # ESP32 dependencies, PlatformIO setup, build, flash,
│           # Wi-Fi/MQTT configuration, and verification instructions.
│
├── backend/
│   # Node.js/Express Backend application.
│   ├── tests/
│   │   ├── unit/
│   │   │   # Isolated tests for rule engine, validators, services,
│   │   │   # MQTT payload handling, and business logic.
│   │   └── integration/
│   │       # Tests combining REST API, MySQL, MQTT, WebSocket,
│   │       # authentication, and device-command acknowledgement flow.
│   └── README.md
│       # Backend installation, .env setup, database migration,
│       # test execution, and Docker run instructions.
│
├── web-frontend/
│   # React-based Web Dashboard; no mobile application is included.
│   ├── src/
│   │   # React source code: pages, components, services, charts,
│   │   # state management, routes, styles, and utility functions.
│   ├── tests/
│   │   ├── unit/
│   │   │   # Tests for React components, hooks, utilities, and formatters.
│   │   └── integration/
│   │       # Tests for API calls, WebSocket updates, authentication,
│   │       # Dashboard interactions, and device-control UI flow.
│   └── README.md
│       # Frontend installation, environment variables, development server,
│       # production build, and test commands.
│
├── scripts/
│   # Reusable PowerShell automation scripts.
│   ├── build-firmware.ps1
│   │   # Builds STM32 and ESP32 firmware projects.
│   ├── build-docs.ps1
│   │   # Generates MkDocs website and Doxygen API documentation.
│   ├── run-unit-tests.ps1
│   │   # Runs unit tests for firmware, backend, and frontend where available.
│   └── run-integration-tests.ps1
│       # Runs integration tests across Backend, MySQL, MQTT, and Web Dashboard.
│
└── tests/
    # System-level tests that span multiple project components.
    ├── e2e/
    │   # End-to-end browser tests for complete Dashboard user journeys.
    ├── sensor-simulation/
    │   # Tools/scripts that simulate BLE or MQTT sensor telemetry
    │   # when physical sensor nodes are unavailable.
    └── acceptance/
        # Acceptance tests mapped to SRS/SoW criteria: BLE rate, latency,
        # Auto rules, curtain timeout, reconnect, and data reliability.
```
