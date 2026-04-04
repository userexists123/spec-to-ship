## Project Charter:  Traffic Dashboard - Gemini 20 


## Purpose 

Build a Traffic App Dashboard that allows users to: 

Browse intersections 

View and compare saved simulation run from Pinot  

Trigger live simulator streams 

Compare saved and live simulator streams 

Validate the full integrated pipeline: Simulator → Pinot  or SignalR → Traffic App Backend → Traffic App Frontend 

This Gemini must validate both technical integration and frontend rendering performance (multiple simulations with heavy traffic)  

 

## Prototype Goals 

Validate end-to-end data pipeline integration across all systems. 

Support playback of pre-simulated runs stored in Pinot. 

Support triggering and streaming of live simulation runs. 

Schema modeling and make it as a source of truth. 

Ability to configure the simulation.  

Stress-test React + PixiJS canvas rendering performance for: 

Vehicle animation 

Phase changes 

High-density traffic loads 

Multiple simulations running together  

Define clean separation of data ownership: 

Intersection data – Traffic Apps Backend 

Simulation datasets (Pinot DB) 

Live Simulation Data ( Signal R) 

R & D / Learning  for  Historical playback and Live simulation 

 

## Scope 

Backend (Traffic App Backend) 

Schema modeling for intersection schema data  

Save in Cosmos DB as document.  

Explore graphical representation of intersection data in Cosmos DB.  

Explore Postgres as source of truth. 

Explore working of hooks.  

Store and manage intersection schema data: 

Geometry and Dimensions 

Metadata (name, ID, image …) 

Provide endpoints for: 

Listing intersections 

Fetching intersection detail 

Fetching available simulation runs per intersection 

Streaming saved simulation data from Pinot DB 

Streaming live simulation data delivered via IoT Hub 

Send both saved and live data to the frontend in the same way. 

Configure the schema for simulation and generate the simulation.  

Ability to input timing plan and demand vehicles 

Save the new simulation schema into SQL DB.  

 

## Frontend (Traffic App – React + PixiJS) 

1) Intersections Page 

Grid/List view 

Intersection name, ID, image 

Basic metadata (area) 

 

2) Intersection Detail Page 


Intersection canvas view 


Playback controls: 

Pause 

Fast-forward 

Rewind (limited to saved simulations) 


Speed controls 

Toggle Live mode: Start new simulation 

Configure the vehicle demand, timing plan and start simulation.  

View and select available simulation run 


3) Comparison Screen  

Select two simulation runs (Live and Saved, or 2 saved ones) 

Two / Four canvas panels side-by-side 


4) Performance Validation 

Stress test: 

High vehicle density 

Rapid phase changes 

Identify React + PixiJS bottlenecks 

Evaluate rendering optimization strategies 

 

## Out of Scope (V1) 

Advanced analytics dashboards 

User authentication/authorization expansion beyond basic login 



## Roles 

Project Manager: Jesbin 

Product Owner: Jimmey 

Backend Lead: Freddy 

Frontend Lead: Yoosef and Subash 

 

## Behavioural Norms 

Daily Stand up  

Walk up to clarify - don’t be shy 

Sprint review and planning every 2 weeks 

 

## Milestones  

1) Project Kickoff  

04/03/2026  

Jimmey 

2) UI layout design + Initial Schema modeling 

24/03/2026  

3) Team  

Playback simulated historic data 

14/04/2026  

4) Team  

Playback simulated live data  

05/05/2026  

5) Team  

Comparison of simulated data  

15/05/2026  

6) Team  

Stress test & Performance fix 

22/05/2026 

7) Team 

Final schema modeling 

27/05/2026 

8) Team 

## Project Closure 

29/05/2026  

Jesbin 


## Dependencies   

IoT Hub (Separate Team) 

Store multiple pre-simulated runs per intersection. 

Serve simulation datasets for playback. 

Deliver live simulator output stream into Traffic App backend. 

Explore future surfacing of IoT metrics. 

Simulation Team (Separate Team) 

Generate simulation outputs. 

Run multiple simulation and push   

Provide endpoint to trigger new live simulation run 

 
## Risks and Assumptions 

If the dependency items were not delivered on time, it would be a risk for the planned delivery.  