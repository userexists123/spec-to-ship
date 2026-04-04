## Project Charter: Hospital Operations Dashboard - Nova 7


## Purpose

Build a Hospital Operations Dashboard that allows users to:

Browse hospitals and care units

View and compare saved patient-flow runs from the analytics store

Trigger live bed-capacity and admissions event streams

Compare saved and live hospital operations streams

Validate the full integrated pipeline: Admissions and Bed Systems → Analytics Store or Event Stream → Hospital Backend → Hospital Frontend

This Nova must validate both technical integration and frontend rendering performance (multiple active units with high patient movement)


## Prototype Goals

Validate end-to-end data pipeline integration across all systems.

Support playback of pre-recorded patient-flow runs stored in the analytics store.

Support triggering and streaming of live bed-capacity and admissions runs.

Schema modeling and make it as a source of truth.

Ability to configure the hospital operations run.

Stress-test React + Canvas rendering performance for:

Patient movement animation

Bed status changes

High-density admission loads

Multiple care units running together

Define clean separation of data ownership:

Hospital master data – Hospital Backend

Patient-flow datasets – Analytics Store

Live hospital event data – Event Stream

R & D / Learning for historical playback and live hospital operations orchestration


## Scope

Backend (Hospital Backend)

Schema modeling for hospital layout and care-unit data

Save in Cosmos DB as document.

Explore graphical representation of care-unit and bed data in Cosmos DB.

Explore Postgres as source of truth.

Explore working of hooks.

Store and manage hospital schema data:

Layout and Capacity

Metadata (name, ID, image …)

Provide endpoints for:

Listing hospitals

Fetching hospital detail

Fetching available patient-flow runs per hospital

Streaming saved patient-flow data from analytics store

Streaming live hospital event data delivered via event stream

Send both saved and live data to the frontend in the same way.

Configure the schema for hospital operations runs and generate the run.

Ability to input staffing plan and admission demand

Save the new hospital operations schema into SQL DB.


## Frontend (Hospital App – React + Canvas)

1) Hospitals Page

Grid/List view

Hospital name, ID, image

Basic metadata (region)

2) Hospital Detail Page

Hospital unit canvas view

Playback controls:

Pause

Fast-forward

Rewind (limited to saved runs)

Speed controls

Toggle Live mode: Start new hospital operations run

Configure staffing levels, admission demand, and start run.

View and select available patient-flow run

3) Comparison Screen

Select two patient-flow runs (Live and Saved, or 2 saved ones)

Two / Four canvas panels side-by-side

4) Performance Validation

Stress test:

High patient density

Rapid bed status changes

Identify React + Canvas bottlenecks

Evaluate rendering optimization strategies


## Out of Scope (V1)

Advanced clinical analytics dashboards

User authentication/authorization expansion beyond basic login


## Roles

Project Manager: Leena

Product Owner: Marcus

Backend Lead: Harish

Frontend Lead: Diya and Rohan


## Behavioural Norms

Daily Stand up

Walk up to clarify - don’t be shy

Sprint review and planning every 2 weeks


## Milestones

1) Project Kickoff

08/04/2026

Marcus

2) UI layout design + Initial Schema modeling

22/04/2026

3) Team

Playback recorded patient-flow data

06/05/2026

4) Team

Playback live hospital events

20/05/2026

5) Team

Comparison of patient-flow runs

30/05/2026

6) Team

Stress test & Performance fix

06/06/2026

7) Team

Final schema modeling

12/06/2026

8) Team

## Project Closure

15/06/2026

Leena


## Dependencies

Event Streaming Team (Separate Team)

Store multiple recorded patient-flow runs per hospital.

Serve patient-flow datasets for playback.

Deliver live hospital event stream into Hospital Backend.

Explore future surfacing of ward device health metrics.

Operations Simulation Team (Separate Team)

Generate hospital operations run outputs.

Run multiple hospital scenarios and push

Provide endpoint to trigger new live hospital operations run


## Risks and Assumptions

If the dependency items were not delivered on time, it would be a risk for the planned delivery.