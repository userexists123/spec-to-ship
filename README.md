# Spec to Ship

Prototype gateway for the Spec-to-Ship weekend build.

## Current status
Session 1 scaffold complete:
- Azure DevOps sandbox repo created
- demo PR created
- Azure Function skeleton created
- local health endpoint working

## Project structure

- `src/routes` - HTTP routes
- `src/services` - shared services and config
- `src/schemas` - future schema definitions
- `samples` - demo fixtures and PRD samples
- `docs` - setup and demo notes
- `openapi` - future gateway action schema

## Local run

Install dependencies:

```bash
npm install