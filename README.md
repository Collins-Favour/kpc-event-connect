# KPC Event Connect

KPC REGISTRATION & ATTENDANCE MANAGEMENT SYSTEM

1. PROJECT OBJECTIVE

Build a production-ready, web-based registration and attendance management system for Kagumo People's Church (KPC).

The system will be used during church events, conferences, services, and other gatherings to register attendees from multiple registration desks simultaneously.

The system must be:

Online

Multi-user

Multi-device

Responsive

Secure

Scalable

Easy to operate at a busy registration desk

It must work on:

Desktop computers

Laptops

Tablets

Android phones

iPhones

Multiple registration desks must be able to operate simultaneously using the same centralized system and database.

2. TECHNOLOGY STACK

Use the following technology stack.

Backend

Laravel

PHP

Laravel Sanctum or another appropriate secure authentication mechanism

Laravel API

Laravel Eloquent ORM

Laravel validation

Laravel authorization/policies

Laravel migrations

Laravel queues where required

Database

Use:

PostgreSQL

Development:

PostgreSQL locally

Docker/Docker Compose may be used

Production:

Managed/cloud PostgreSQL

SSL/TLS

Automated backups

Secure credentials

PostgreSQL must NOT be directly exposed to registration devices or the public frontend

Architecture:

React Frontend → Laravel Backend/API → PostgreSQL

Do NOT connect React directly to PostgreSQL.

Frontend

Use:

React.js

Responsive UI

Mobile-first registration interface

Admin dashboard

REST API communication

Use TypeScript if appropriate.

SMS

Integrate:

Africa's Talking

Africa's Talking credentials must remain on the Laravel backend and must never be exposed in the frontend.

3. HIGH-LEVEL ARCHITECTURE

The system should follow this architecture:

                    KPC SYSTEM
                        |
            +-----------+-----------+
            |                       |
        REGISTRARS              ADMINS
            |                       |
        Login Page              Login Page
            |                       |
            v                       v
    Registration Interface    Admin Dashboard
            |                       |
            +-----------+-----------+
                        |
                        v
                  Laravel Backend
                        |
            +-----------+-----------+
            |           |           |
            v           v           v
       PostgreSQL   Africa's    Reporting
                    Talking


The backend is responsible for:

Authentication

Authorization

Registration

Registration desk assignment

Events

Attendees

Ministries

Administrators

Registrars

Reports

Audit logs

SMS

Business rules

4. USER TYPES

The system must have a centralized users table.

There are three primary roles:

REGISTRAR
ADMIN
SUPER_ADMIN


Do NOT create completely separate authentication systems for each role.

Use one authentication system and role-based authorization.

5. REGISTRAR ROLE

Registrars are the people physically working at registration desks.

They are NOT backend administrators.

They should have their own login credentials.

After login, a registrar should only have access to the registration interface.

They should NOT have access to:

Admin dashboard

Reports

All attendees

Administrator management

System settings

Audit logs

Database management

SMS management

Their interface should be extremely simple and optimized for speed.

Example:

KPC REGISTRATION

Welcome, Jane 👋

Registration Desk:
MAIN ENTRANCE — DESK 01

[ REGISTER ATTENDEE ]


A registrar should be associated with a registration desk.

6. ADMIN ROLE

Admins are backend operational users.

They can:

Log in

View dashboard

View attendees

Search attendees

Filter attendees

Register attendees if necessary

Manage registration desks

View desk statistics

Manage ministries

View events

Generate reports

Export reports

Use SMS features where permitted

Admins must NOT be able to:

Delete Super Admins

Grant themselves Super Admin privileges

Modify protected system configuration

Delete critical historical records

Bypass authorization

7. SUPER ADMIN ROLE

There should initially be two Super Admin accounts.

Conceptually:

Main Administration Super Admin

Technical/Developer Super Admin

Do NOT hard-code these accounts into the source code.

Create them through a secure database seeding/setup process.

Super Admin can:

Create administrators

Approve administrators

Disable administrators

Create registrars

Disable registrars

Assign registrars to desks

Create registration desks

Edit registration desks

Activate/deactivate desks

Create events

Manage ministries

View all attendees

Generate reports

Manage SMS

View audit logs

Manage system configuration

Super Admin accounts must be protected from accidental deletion.

A Super Admin must not be removable through the ordinary administrator management interface unless a deliberate protected procedure is implemented.

8. USERS TABLE

Create a central users table.

Suggested fields:

id
name
email
phone
password
role
status
last_login_at
created_at
updated_at


Possible role values:

REGISTRAR
ADMIN
SUPER_ADMIN


Possible status values:

PENDING
ACTIVE
SUSPENDED
DISABLED


Do not store plain-text passwords.

Use Laravel's secure password hashing.

9. REGISTRATION DESKS

Registration desks are first-class entities.

Create a registration_desks table.

Suggested fields:

id
name
code
location
description
status
created_at
updated_at


Example:

Name: Main Entrance
Code: DESK-01
Location: Main Gate
Status: ACTIVE


Other examples:

DESK-01 — Main Entrance
DESK-02 — Hall Entrance
DESK-03 — Youth Desk
DESK-04 — VIP Desk


10. REGISTRATION DESK MANAGEMENT

Authorized administrators must be able to:

Create registration desks

Edit registration desks

Activate desks

Deactivate desks

View desk statistics

View assigned registrars

Assign registrars to desks

Remove/reassign registrars

Inactive desks must not accept new registrations.

Do NOT permanently delete desks that already have attendance records.

Use soft deletion or status-based deactivation.

Historical attendance records must retain their original desk.

11. REGISTRAR-DESK ASSIGNMENT

A registrar should be assigned to a registration desk.

However, do not rely only on a permanent registration_desk_id on the user.

Create a separate assignment/session structure.

Recommended table:

registrar_assignments

Fields:

id
user_id
registration_desk_id
event_id
started_at
ended_at
status
created_at
updated_at


This allows a registrar to work at different desks for different events.

Example:

Jane:

Manifest Conference 2026
Desk 03


Later:

Youth Conference 2027
Desk 01


Historical registrations must remain associated with the desk used at the time.

12. REGISTRATION DEVICE/SESSION

A registration device should be associated with a registration desk/session.

Example:

Tablet 1
→ DESK-01

Laptop 2
→ DESK-02

Phone 3
→ DESK-03


The registrar should not manually select a desk for every attendee.

The active desk should be known from the authenticated registrar/assignment/session.

Every registration should automatically store:

registered_by
registration_desk_id
registrar_assignment_id


13. EVENTS

The system must support multiple events.

Create an events table.

Suggested fields:

id
name
description
start_date
end_date
venue
status
created_at
updated_at


Example:

Manifest Conference 2026
Voice of My Spirit 2027
Youth Conference 2027


Every registration must belong to an event.

Do NOT create separate databases for each event.

14. REGISTRATION FLOW

The public registration experience should be simple and fast.

The first screen should display:

KAGUMO PEOPLE'S CHURCH

Welcome!

Are you:

[ HOME ]

[ GUEST ]


The interface should have a modern chat-like/progressive form experience.

Do not display a huge form at once.

15. HOME REGISTRATION

When the attendee selects:

HOME

Automatically set:

attendance_type = HOME
ministry = Kagumo People's Church


Do not ask the attendee to enter their ministry.

Collect:

Full name — REQUIRED

Phone — OPTIONAL

Email — OPTIONAL

Location — REQUIRED

Gender — REQUIRED

Youth — OPTIONAL

16. GUEST REGISTRATION

When the attendee selects:

GUEST

Collect:

Full name — REQUIRED

Phone — OPTIONAL

Email — OPTIONAL

Location — REQUIRED

Ministry/Church — REQUIRED

Gender — REQUIRED

Youth — OPTIONAL

The ministry should preferably be selected from the existing ministries database.

17. GENDER

Gender is mandatory.

Only allow one selection:

Male
Female


Do not allow both.

Use a radio/select control rather than two independent checkboxes.

18. YOUTH

Youth is optional.

Use:

[ ] Youth


If checked:

is_youth = true


If not checked:

is_youth = false


19. CLERGY

Do NOT implement clergy/pastor/minister classification in Version 1.

The architecture may allow it to be added later.

Do not add unnecessary complexity to the first version.

20. ATTENDEE DATABASE

Create an attendees table.

Suggested fields:

id
registration_number
full_name
phone
email
location
attendance_type
ministry_id
gender
is_youth
event_id
registration_desk_id
registered_by
registrar_assignment_id
registered_at
created_at
updated_at


Use proper foreign keys.

21. REGISTRATION NUMBER

Generate a unique registration number for every attendee.

Format:

KPC-000001
KPC-000002
KPC-000003


The registration number must be unique.

Do not use the attendee's phone number as their primary identifier.

22. AUTOMATIC TIMESTAMP

The backend must automatically record registration time.

The registrar must never manually enter the timestamp.

Use:

registered_at


The server/backend timestamp should be authoritative.

Configure the application for:

Africa/Nairobi


Store timestamps consistently.

23. ATTENDANCE RECORD

Every registration should preserve:

Event
Attendee
Registration number
Registrar
Registration desk
Registration timestamp
Attendance type
Gender
Youth status
Ministry
Location


This makes historical reporting possible.

24. REGISTRATION DESK ANALYTICS

Administrators must be able to see:

Desk 01 — 312 registrations
Desk 02 — 287 registrations
Desk 03 — 341 registrations
Desk 04 — 308 registrations


Also show:

Registrations per desk

Registrations per hour

Registrations by registrar

Registrations by event

Registrations by date

Allow filtering by event and date.

25. DASHBOARD

Create an admin dashboard with statistics such as:

TOTAL ATTENDEES
MALE
FEMALE
YOUTH
HOME
GUESTS
ACTIVE DESKS
ACTIVE REGISTRARS


Also show:

Registration trend

Registrations by hour

Registrations by desk

Registrations by ministry

Gender distribution

Youth distribution

Home vs Guest distribution

Use charts where useful.

26. ATTENDEE MANAGEMENT

Admins should be able to:

View attendees

Search attendees

Filter attendees

View attendee details

Edit permitted information

Search by:

Name

Phone

Email

Registration number

Filter by:

Event

Gender

Youth

Home/Guest

Ministry

Location

Registration desk

Registrar

Date/time

27. REPORTING

Create a reporting system.

Reports should be exportable as:

CSV

Excel

PDF

Initial reports:

Full attendance report

Gender report

Youth report

Home vs Guest report

Ministry report

Registration desk report

Registrar performance report

Hourly registration report

Example:

KPC EVENT ATTENDANCE REPORT

Event:
Manifest Conference 2026

Total:
1,248

Male:
532

Female:
716

Youth:
387

Home:
542

Guests:
706


28. ADMINISTRATOR MANAGEMENT

Super Admin should have a section:

Administrators

Show:

Name
Email
Role
Status
Last Login
Created At


Actions:

Approve
Suspend
Disable
Reactivate


Do not allow normal Admins to manage Super Admin privileges.

29. REGISTRAR MANAGEMENT

Super Admin/Admin should have:

Registrars

Show:

Registrar
Email
Phone
Status
Current Desk
Current Event
Last Login


Actions:

Create Registrar
Assign Desk
Reassign Desk
Disable Registrar
Reactivate Registrar


A registrar should only access the registration interface.

30. ADMIN APPROVAL

If administrator accounts are self-requested, they must initially have:

status = PENDING


A Super Admin must approve them.

After approval:

status = ACTIVE


Rejected accounts must not be able to access the admin backend.

31. AUTHENTICATION

Implement secure authentication.

Use Laravel Sanctum or an equivalent secure authentication mechanism.

There should be protected routes for:

REGISTRAR
ADMIN
SUPER_ADMIN


Do not rely only on frontend route hiding.

Authorization must also be enforced on the Laravel backend.

A registrar attempting to access:

/api/admin/...


must receive an authorization error even if they manually enter the URL.

32. FRONTEND ROUTES

Suggested routes:

Public/Registration

/registration/login
/registration
/registration/home
/registration/guest
/registration/success


Admin

/admin/login
/admin/dashboard
/admin/attendees
/admin/events
/admin/registration-desks
/admin/registrars
/admin/administrators
/admin/ministries
/admin/reports
/admin/sms
/admin/audit-logs
/admin/settings


33. REGISTRAR INTERFACE

After registrar login:

KPC REGISTRATION

Registrar:
Jane Wanjiku

Event:
Manifest Conference 2026

Desk:
MAIN ENTRANCE — DESK 01

[ REGISTER ATTENDEE ]


The interface should prioritize:

Speed

Large controls

Minimal fields

Clear validation

Mobile responsiveness

After successful registration:

REGISTRATION SUCCESSFUL

Registration Number:
KPC-001248

Thank you!

[ REGISTER NEXT PERSON ]


The registrar should be able to immediately start another registration.

34. REGISTRAR RESTRICTIONS

Registrars must NOT be able to:

View the complete attendee database

View reports

View other registrars

Manage desks

Manage admins

Manage events

Manage system settings

Send bulk SMS

View audit logs

They should only perform registration-related actions allowed by their role.

35. SMS / AFRICA'S TALKING

Integrate Africa's Talking through Laravel.

Possible functionality:

Registration confirmation

Bulk SMS

SMS to guests

SMS to Home members

SMS to youths

SMS to specific ministries

SMS to selected attendees

SMS credentials must be stored in environment variables.

Example:

AFRICASTALKING_USERNAME
AFRICASTALKING_API_KEY


Never expose them to React.

36. SMS HISTORY

Create an SMS log.

Store information such as:

id
recipient
message
status
sent_by
sent_at
event_id


This allows administrators to see SMS history.

37. AUDIT LOGGING

Create an audit log system.

Important actions should be logged.

Examples:

Admin created registration desk
Admin disabled registrar
Super Admin approved administrator
Admin edited attendee
Admin generated report
Admin sent SMS
Super Admin changed system settings


Store:

user_id
action
entity_type
entity_id
description
ip_address
created_at


Audit logs should not be editable by ordinary administrators.

38. SECURITY REQUIREMENTS

Implement:

HTTPS in production

Password hashing

Authorization policies

Role-based access control

CSRF protection where applicable

Input validation

Rate limiting

Secure API authentication

Secure HTTP headers

Environment-based secrets

Database access controls

Audit logs

Never commit:

Database passwords

API keys

JWT secrets

Africa's Talking credentials

to Git.

39. POSTGRESQL PRODUCTION

Use PostgreSQL as the production database.

Recommended architecture:

React
   |
HTTPS
   |
Laravel
   |
Secure Database Connection
   |
Managed PostgreSQL


PostgreSQL should be hosted through a managed cloud provider in production.

Requirements:

Automated backups

SSL

Restricted network access

Strong database credentials

Monitoring

Migration management

The registration devices should NEVER connect directly to PostgreSQL.

40. DATABASE MIGRATIONS

Use Laravel migrations.

Do not manually modify production database tables.

Version-control all schema changes.

Examples:

create_users_table
create_events_table
create_ministries_table
create_registration_desks_table
create_registrar_assignments_table
create_attendees_table
create_audit_logs_table
create_sms_logs_table


41. DATABASE RELATIONSHIPS

Implement proper relationships.

Conceptually:

User
 ├── hasMany RegistrarAssignments
 ├── hasMany Attendees
 └── hasMany AuditLogs

Event
 ├── hasMany Attendees
 └── hasMany RegistrarAssignments

RegistrationDesk
 ├── hasMany RegistrarAssignments
 └── hasMany Attendees

Ministry
 └── hasMany Attendees

RegistrarAssignment
 ├── belongsTo User
 ├── belongsTo Event
 ├── belongsTo RegistrationDesk
 └── hasMany Attendees

Attendee
 ├── belongsTo Event
 ├── belongsTo Ministry
 ├── belongsTo RegistrationDesk
 ├── belongsTo User
 └── belongsTo RegistrarAssignment


42. IMPORTANT DATA INTEGRITY RULE

When an attendee is registered, preserve the exact registration context.

For example:

Attendee:
John Mwangi

Event:
Manifest Conference 2026

Registrar:
Jane Wanjiku

Desk:
DESK-03

Registered:
26 August 2026, 10:42 AM


If Jane is moved to Desk 01 later, John's historical record must STILL show Desk 03.

Do not dynamically calculate historical desk information from the registrar's current assignment.

43. CHECK-OUT

Do not make check-out a major Version 1 requirement.

Version 1 should focus on registration/check-in.

Future version:

check_in_time
check_out_time
duration


This can later calculate:

John Mwangi
Check-in: 08:14 AM
Check-out: 04:37 PM
Duration: 8h 23m


44. FUTURE OFFLINE SUPPORT

Design the system so offline registration can potentially be introduced later.

Do not implement complex offline synchronization in Version 1 unless necessary.

The architecture should allow a future registration queue and synchronization mechanism.

45. PROJECT STRUCTURE

Use a clean Laravel architecture.

Suggested backend structure:

app/
 ├── Http/
 │   ├── Controllers/
 │   ├── Requests/
 │   └── Middleware/
 │
 ├── Models/
 │
 ├── Services/
 │
 ├── Policies/
 │
 ├── Jobs/
 │
 ├── Notifications/
 │
 └── Support/

database/
 ├── migrations/
 ├── seeders/
 └── factories/

routes/
 ├── api.php
 └── web.php


Frontend:

src/
 ├── components/
 ├── pages/
 ├── layouts/
 ├── services/
 ├── hooks/
 ├── contexts/
 ├── utils/
 └── types/


Keep business logic out of controllers where possible.

Use services for complex operations.

46. API DESIGN

Create clean RESTful APIs.

Examples:

POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

POST   /api/registration
GET    /api/registration/{id}

GET    /api/attendees
GET    /api/attendees/{id}
PUT    /api/attendees/{id}

GET    /api/events
POST   /api/events
PUT    /api/events/{id}

GET    /api/registration-desks
POST   /api/registration-desks
PUT    /api/registration-desks/{id}
PATCH  /api/registration-desks/{id}/status

GET    /api/registrars
POST   /api/registrars
PUT    /api/registrars/{id}

POST   /api/registrars/{id}/assign-desk

GET    /api/administrators
POST   /api/administrators
POST   /api/administrators/{id}/approve
PATCH  /api/administrators/{id}/status

GET    /api/reports/attendance
GET    /api/reports/by-gender
GET    /api/reports/by-ministry
GET    /api/reports/by-desk
GET    /api/reports/by-registrar

POST   /api/sms/send
GET    /api/sms/history


Adjust endpoint naming where appropriate to maintain REST consistency.

47. VALIDATION

Validate all incoming data on the backend.

Examples:

Full name:

Required.

Gender:

Required and must be one of:

male
female


Youth:

Boolean.

Phone:

Optional but must be validated if provided.

Email:

Optional but must be valid if provided.

Guest ministry:

Required when attendance type is GUEST.

Home ministry:

Automatically assigned to KPC.

48. DUPLICATE REGISTRATION

Design a strategy for duplicate detection.

Potential matching fields:

Phone number

Event

Name

Do not automatically reject someone solely because their name matches another attendee.

If a potential duplicate is detected, provide a warning where appropriate.

49. ADMIN DASHBOARD EXAMPLE

The dashboard should provide a visual overview:

KPC DASHBOARD

TOTAL ATTENDEES
1,248

MALE
532

FEMALE
716

YOUTH
387

HOME
542

GUESTS
706

ACTIVE DESKS
4

ACTIVE REGISTRARS
8


Then:

REGISTRATION BY DESK

Desk 01     312
Desk 02     287
Desk 03     341
Desk 04     308


And:

REGISTRATION BY HOUR

08:00 - 09:00
09:00 - 10:00
10:00 - 11:00
11:00 - 12:00


50. DEVELOPMENT PHASES

Do NOT generate the entire system at once.

Build incrementally.

PHASE 1 — FOUNDATION

Implement:

Laravel project

React frontend

PostgreSQL

Authentication foundation

Database migrations

Users

Roles

Events

Ministries

Registration desks

Registrar assignments

Attendees

PHASE 2 — REGISTRATION

Implement:

Registrar login

Desk assignment

Home registration

Guest registration

Validation

Registration number

Automatic timestamp

Registration success screen

PHASE 3 — ADMIN

Implement:

Admin login

Dashboard

Attendee management

Search

Filters

Registration desk management

Registrar management

Event management

Ministry management

PHASE 4 — SUPER ADMIN

Implement:

Administrator management

Approval workflow

Role management

Protected Super Admin accounts

Audit logs

PHASE 5 — REPORTING

Implement:

Dashboard analytics

CSV export

Excel export

PDF reports

Desk reports

Registrar reports

Ministry reports

Gender reports

Youth reports

PHASE 6 — SMS

Implement:

Africa's Talking integration

Registration confirmation SMS

Bulk SMS

Targeted SMS

SMS history

PHASE 7 — ADVANCED FEATURES

Future:

Check-out

Attendance duration

Offline registration

Advanced analytics

Repeat attendee tracking

QR registration

Event history

51. FIRST TASK — DO NOT START BY GENERATING EVERYTHING

Before generating the full application, first provide:

Complete system architecture

Database ERD

Database table definitions

Database relationships

User roles and permissions matrix

Registration workflow

Registrar workflow

Admin workflow

Super Admin workflow

Registration desk workflow

API architecture

Laravel folder structure

React folder structure

Authentication architecture

Deployment architecture

Local development setup

Production deployment strategy

After presenting the architecture, begin implementing Phase 1 only.

Do not generate all phases at once.

52. IMPORTANT DEVELOPMENT PRINCIPLES

Prioritize:

Security

Maintainability

Clean architecture

Database integrity

Role-based authorization

Mobile responsiveness

Performance

Scalability

Simple registration workflow

Clear separation between Registrar and Admin interfaces

Do not over-engineer Version 1.

The most important Version 1 workflow is:

Registrar Login
      ↓
Assigned Event
      ↓
Assigned Registration Desk
      ↓
Register Attendee
      ↓
Automatic Timestamp
      ↓
Unique Registration Number
      ↓
Save to PostgreSQL
      ↓
Registration Success
      ↓
Register Next Person


The most important administrative workflow is:

Super Admin
      ↓
Create Event
      ↓
Create Registration Desks
      ↓
Create/Approve Registrars
      ↓
Assign Registrars to Desks
      ↓
Registrars Begin Registration
      ↓
Admin Views Live Statistics
      ↓
Generate Reports


Build the system around these workflows first.

Do not sacrifice the registration experience by adding unnecessary complexity.

The final product should feel like a professional event registration platform, not a basic CRUD application.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/71253813-4e2b-4ba6-89a1-41535932330a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
