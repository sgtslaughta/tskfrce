# Test Data Generator for TaaskMaaster

This directory contains scripts to generate comprehensive test data for the TaaskMaaster application.

## Files

- `create_test_data.py` - Main Python script that generates test data
- `run_test_data_generator.sh` - Shell script to run the generator with proper environment setup
- `README.md` - This documentation file

## What Data is Generated

The test data generator creates the following:

### Users (5 users)
- **admin** - Superuser with full permissions
- **john_doe** - Regular user
- **jane_smith** - Regular user  
- **bob_wilson** - Regular user
- **alice_brown** - Regular user

All users have password: `password123`

### Categories (8 categories)
- **Chores** - Household chores and cleaning tasks
- **Homework** - Academic assignments and study tasks
- **Work** - Professional and work-related tasks
- **Shopping** - Shopping and errand tasks
- **Health** - Health and fitness activities
- **Social** - Social activities and events
- **Projects** - Personal and professional projects
- **Learning** - Learning and skill development

### Templates (8 templates)
- **Daily Chore Template** - Template for daily household chores
- **Homework Assignment** - Template for academic homework assignments
- **Shopping Trip** - Template for shopping and errand tasks
- **Work Meeting** - Template for work-related meetings
- **Exercise Routine** - Template for fitness and exercise activities
- **Project Milestone** - Template for project milestone tasks
- **Social Event** - Template for social activities and events
- **Learning Session** - Template for learning and skill development

### Tasks (13 tasks with various statuses)
- **Completed tasks** (3) - Tasks marked as done with completion times
- **In Progress tasks** (2) - Tasks currently being worked on
- **Pending tasks** (3) - Tasks not yet started
- **Overdue tasks** (2) - Tasks past their due date
- **Template-generated tasks** (3) - Tasks created from templates

### Task Lists (5 lists)
- **Daily Chores** - Routine daily household tasks
- **Weekly Goals** - Important weekly objectives
- **Shopping List** - Items to purchase
- **Home Projects** - Home improvement and maintenance tasks
- **Learning Goals** - Educational and skill development tasks

## Reward Types Included

The generated data includes all reward types:
- **Points** - Gamification points
- **Monetary** - Money rewards ($5.00, $20.00, $50.00)
- **Time** - Time-based rewards (30min, 1hr)
- **Custom** - Custom rewards (team lunch, programming book, birthday treat)

## Task Statuses Included

- **TODO** - Not started
- **IN_PROGRESS** - Currently being worked on
- **DONE** - Completed

## Priorities Included

- **LOW** - Low priority tasks
- **MEDIUM** - Medium priority tasks
- **HIGH** - High priority tasks
- **URGENT** - Urgent priority tasks

## How to Run

### Option 1: Using the shell script (Recommended)
```bash
# From the project root directory
./backend/scripts/run_test_data_generator.sh
```

### Option 2: Manual execution
```bash
# From the project root directory
cd backend
source venv/bin/activate  # or your virtual environment
python scripts/create_test_data.py
```

## Prerequisites

- Python 3.8+
- Virtual environment with project dependencies installed
- Database should be initialized and migrated
- Backend services should be running

## After Running

Once the script completes successfully:

1. Start the backend server
2. Start the frontend application
3. Navigate to the Templates tab to see the generated templates
4. Navigate to the Tasks tab to see the generated tasks
5. Navigate to the Lists tab to see the generated task lists

## Login Credentials

You can log in with any of the generated users:
- Username: `admin`, `john_doe`, `jane_smith`, `bob_wilson`, or `alice_brown`
- Password: `password123`

## Customization

To modify the generated data, edit the `create_test_data.py` file:

- Add more users in the `user_data` list
- Add more categories in the `category_data` list
- Add more templates in the `template_data` list
- Add more tasks in the `task_data` list
- Add more task lists in the `list_data` list

## Troubleshooting

### Common Issues

1. **Import errors**: Make sure you're running from the correct directory and the virtual environment is activated
2. **Database errors**: Ensure the database is properly initialized and migrated
3. **Permission errors**: Make sure the script files are executable (`chmod +x`)

### Error Messages

- **"Failed to generate test data"**: Check the database connection and ensure all required tables exist
- **"Module not found"**: Activate the virtual environment and install dependencies
- **"Permission denied"**: Make the script executable with `chmod +x`

## Data Cleanup

To remove all test data, you can:
1. Delete the database file (if using SQLite)
2. Run database migrations to reset the schema
3. Or manually delete records from the database

## Notes

- The script uses the first user (admin) as the creator for categories and templates
- Tasks are distributed among different users for realistic testing
- Some templates are marked as public, others as private
- Task lists include both public and private lists
- All data includes realistic timestamps and relationships
