#!/usr/bin/env python3
"""
Database setup script for TaaskMaaster.

This script creates all database tables and sets up the initial schema.
"""

import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text
from app.db.config import get_database_url
from app.db.session import Base
from app.models.user import User, UserRole
from app.models.task import Task, TaskCategory, TaskTemplate, TaskList, TaskListAssociation
from app.models.gamification import Points, PointsType
from app.schemas.user import UserCreate
from app.services.user_service import UserService
from app.db.session import get_db_session


def setup_database():
    """Set up the database with all tables."""
    
    # Create database engine
    database_url = get_database_url()
    engine = create_engine(database_url)
    
    print("Creating database tables...")
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    print("✅ Database tables created successfully!")
    
    # Add role column to users table if it doesn't exist
    with engine.connect() as conn:
        try:
            # Check if role column exists
            result = conn.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result.fetchall()]
            
            if 'role' not in columns:
                print("Adding role column to users table...")
                conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'"))
                conn.commit()
                print("✅ Role column added successfully!")
            else:
                print("✅ Role column already exists!")
                
        except Exception as e:
            print(f"Warning: Could not add role column: {e}")
    
    # Create admin user
    print("Creating admin user...")
    try:
        db = next(get_db_session())
        user_service = UserService(db)
        
        # Check if admin user already exists
        existing_user = user_service.get_user_by_username("admin")
        if existing_user:
            print("✅ Admin user already exists!")
            # Update role if needed
            if not hasattr(existing_user, 'role') or existing_user.role is None:
                existing_user.role = UserRole.ADMIN
                db.commit()
                print("✅ Updated admin user role!")
        else:
            # Create admin user
            admin_data = UserCreate(
                username="admin",
                email="admin@taaskmaaster.com",
                full_name="Administrator",
                password="admin123",
                timezone="UTC",
            )
            
            user = user_service.create_user(admin_data)
            user.is_superuser = True
            user.is_active = True
            user.role = UserRole.ADMIN
            db.commit()
            
            print("✅ Admin user created successfully!")
            print(f"   Username: {user.username}")
            print(f"   Email: {user.email}")
            print(f"   Role: {user.role}")
            print(f"   Is Superuser: {user.is_superuser}")
            
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        sys.exit(1)
    finally:
        db.close()
    
    print("\n🎉 Database setup completed successfully!")
    print("You can now use these credentials to log in:")
    print("   Username: admin")
    print("   Password: admin123")


if __name__ == "__main__":
    setup_database()
