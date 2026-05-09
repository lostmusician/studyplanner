**Objective:** Build a "SOC Study Planner" web application using React, TypeScript, and Tailwind CSS. The app should allow students to plan their modules across 8 semesters and track degree requirements.

# 1. Data Models:
Module: { code: string, name: string, mcs: number, category: Category }
Category: 'Primary Major', 'SOC/NUSC', 'Other Programmes', 'University Requirements', 'Unrestricted Electives'
Semester: { year: number, sem: number, modules: Module[] }
Requirement: { name: string, fulfilledBy: string[], isFulfilled: boolean }
# 2. UI Requirements:
Dashboard Header: Display Student Name, Matric No, Major (Computer Science), and Specialisation (Networking and Distributed Systems).
Summary Stats: A top bar showing "Total MCs" (Target: 160), "Primary Major MCs" (Target: 80), and "SOC/NUSC MCs" (Target: 60). These should update dynamically as modules are added.
The Study Plan Grid:
Create an 8-column layout (Year 1 Sem 1 through Year 4 Sem 2).
Organize rows into collapsible sections based on the Category list above.
Each module entry in the grid should show: Module Code, Description/Name, and MCs.
Requirements Checklist Sidebar: A checklist to track specific SOC/NUSC requirements:
GE Pillars: Writing (e.g., NTW2035), GEA: Data Literacy (e.g., GEA1000N), GEI: Digital Literacy (e.g., CS1101S), GEX: Critique & Expression, GESS: Singapore Studies, GEC: Cultures and Connections, GEN: Communities and Engagement.
Computing Ethics: IS1108.
Interdisciplinary: Cross-Disciplinary, Interdisciplinary 1, Interdisciplinary 2.
# 3. Logic & Validation:
MC Calculation: Automatically sum the MCs for each semester and category.
Requirement Mapping: If a module code in the plan matches a requirement (e.g., 'CS1101S' for 'GEI'), mark that requirement as "Fulfilled" in the checklist.
Career Guidance: Include specific tracking for non-credit or low-credit career modules like CFG1002, CFG1003, CFG1004, HS1402, and HS1403.
# 4. Initial Data Seed:
Pre-populate the plan with core CS modules: CS1231, CS2030S, CS2040S, CS2100, CS2103T, CS2101, CS2102, CS2106, CS2109S, CS3230, ST2334, MA1521, MA1522.
Please generate the folder structure, the main StudyPlan component, and the useStudyPlan hook for state management.
Key Insights from your Data for the App Logic:

**Credit Weighting:** Most of your core modules (CS1231, CS2030S, etc.) are 4 MCs, while career modules like CFG1002/CFG1004 are 2 MCs, and some like HS1402 are 0 MCs. Your app logic must handle these variations.
Requirement Overlap: Your SOC_Checklist shows that some modules fulfill specific "Pillars" (e.g., NTW2035 for Writing). The app should have a lookup table to link these.
**Visual Hierarchy:** Your spreadsheet uses a horizontal semester layout. In a web app, you might consider a "Kanban" style board where each semester is a column that modules can be dragged into.

**Design:** The design is minimalistic and organic, using the colours (239, 238, 231) and (225, 218, 205) for background and widgets respectively and (20, 20, 19) and (108, 107, 104) for text.