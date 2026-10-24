# taaskMaaster

### A helpful way for parents to help children complete household tasks.

## Technical Features

- Containerized deployment using docker compose
- Modern, attractive and responsive web fontend using next.js
    - Security focused session management (JWT)
        - Rate limiting for API endpoints
        - Session management best practices
    - optional SSO integration using OAUTH (authentik)
    - 2fa support (OTP)
    - Mobile friendly
    - State management approach
    - Component library structure
    - Progressive Web App (PWA) support
    - Client-side caching strategy
- sqlite database with option for postgresql backend
- media and file storage in a MinIO container
- Python fastAPI middleware and public API
    - Job queue system for background tasks
- Optional network router integration
    - Tie completion of tasks to enable/disable of specific devices (phones, tablets, laptops, game systems, etc)

## Features

- Robust task framework allows flexible and creative options for task creation
    - Scoped RBAC (view, edit, etc)
    - Task (may contain some or all of the following)
        - Name (required)
        - Description
        - Notes
        - Assigned to
        - Completion by date/time (deadline)
        - Creation datetime
        - Completed datetime
        - Media (photos or video)
        - Value (For goal tracking)
            - Monitary (contributes to allowance)
            - Points
            - Time (minutes towards reward, i.e. time on game system)
            - custom
    - List
        - Name (required)
        - One or more tasks (required)
        - Can be assinged as a whole to individual, groups or peacemeal each task
        - Deadline (overall completion)
        - Reoccurance
    - Goals
        - Incentive based objectives to be defined by owners
        - Point objectives, monitary goals, etc
        - Custom, user defined
        - Goals assigned to inviduals or groups
    - Rewards
        - Custom defined reward
        - Name (required)
        - Description
        - Media
    - List templates
    - Task templates

- Gamification
    - Encourage user participation
    - Leaderboards with user flair
    - Predictive analytics for task completion (Optional by task)
        - Indicate likelihood of success, challenging user, option for higher reward if odds are beaten
    - Optional 'task snatching' to earn extra points, deduct points for missed deadline or poor performance (as deemed by task owner)
    - Achievment system
    - Streak rewards system
    - Team challenges
    - Seasonal challenges and events
    - Custom rewards marketplace
        - User defined "rewards" for success

- Task and user tracking metrics and customizable dashboards
    - export functionality for reports
    - User behavior analytics
    - Holistic views
        - Goal tracking
        - List completion
        - Task/deadline metrics
        - Performance monitoring (response times, error rates)
        - User behavior analytics (task completion patterns)

- Admin pages
    - User and group managment
    - System health monitoring
    - Backup and restore
        - DB -> JSON || JSON -> DB
    - Admin dashboards
        - Export functionality for reports
    - Device managment
        - Enroll devices for use with network traffic control feature
            - Name
            - Mac
            - Type/Description
            - Owning user

- Role based user system
    - User (Basic user)
    - Organizer (Create and manage lists, tasks, goals, etc)
    - Admin

## Integrations
- Integration system that permits future expansion to third party apps
    - Network device traffic controller
        - Connect to network router to enable/disable traffic to devices
    - Proposed
        - Calendar apps
        - Amazon Alexa, Google Assistant