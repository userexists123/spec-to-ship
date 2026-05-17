# Support Escalation Tracker

## Problem
Support managers cannot reliably track which customer issues require escalation.

## Functional Requirements
- The support manager must view a list of escalated customer issues with issue title, customer name, severity, owner, and current status.
- The support manager must filter escalated issues by severity, owner, and status.
- The support manager must update the owner and status of an escalated issue.
- The system must persist every owner and status update.

## Non-Functional Requirements
- The escalation list should load within 2 seconds for up to 500 open escalations.
- The system must keep an audit history of owner and status changes.

## Risks and Assumptions
- CRM issue data may be incomplete or delayed.

## Dependencies
- Requires access to CRM issue records.