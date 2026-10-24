"""Family settings (single row, id=1)."""

from sqlalchemy import Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Session

from app.core.database import Base


class FamilySettings(Base):
    __tablename__ = "family_settings"
    __table_args__ = (
        CheckConstraint("gif_rating IN ('g','pg')", name="ck_family_gif_rating"),
        CheckConstraint(
            "accent IN ('neon','sun','tangerine','bubblegum','lilac','sky','aqua','mint','peach','ice')",
            name="ck_family_accent",
        ),
    )

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, default="My Family")
    timezone = Column(String(50), nullable=False, default="UTC")
    reset_time = Column(String(5), nullable=False, default="06:00")
    new_devices_blocked = Column(Boolean, nullable=False, default=True)
    points_unlock_early = Column(Boolean, nullable=False, default=False)
    early_bonus_cap = Column(Integer, nullable=False, default=5, server_default="5")
    screen_time_price = Column(Integer, nullable=False, default=20, server_default="20")
    gifs_enabled = Column(Boolean, nullable=False, default=False, server_default="0")
    giphy_api_key = Column(String(100), nullable=True)  # write-only through the API
    gif_rating = Column(String(2), nullable=False, default="g", server_default="g")
    accent = Column(String(12), nullable=True, default="neon", server_default="neon")
    last_reset_date = Column(Date, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    blocker_last_seen = Column(DateTime, nullable=True)  # naive UTC; home box heartbeat


def get_family(db: Session) -> FamilySettings:
    """Return the family row, creating it if missing."""
    try:
        fam = db.get(FamilySettings, 1)
        if fam is None:
            fam = FamilySettings(id=1, name="My Family")
            db.add(fam)
            db.flush()
    except Exception:
        # Handle case where accent column doesn't exist yet (pre-migration state)
        from sqlalchemy import text
        try:
            # Try to query without accent column
            result = db.execute(
                text("SELECT id, name, timezone, reset_time, new_devices_blocked, "
                     "points_unlock_early, early_bonus_cap, screen_time_price, "
                     "gifs_enabled, giphy_api_key, gif_rating, last_reset_date, "
                     "owner_id, blocker_last_seen FROM family_settings WHERE id = 1")
            ).first()
            if result:
                # Create FamilySettings without going through normal ORM to avoid INSERT with accent
                fam = FamilySettings()
                fam.id = result[0]
                fam.name = result[1]
                fam.timezone = result[2]
                fam.reset_time = result[3]
                fam.new_devices_blocked = result[4]
                fam.points_unlock_early = result[5]
                fam.early_bonus_cap = result[6]
                fam.screen_time_price = result[7]
                fam.gifs_enabled = result[8]
                fam.giphy_api_key = result[9]
                fam.gif_rating = result[10]
                fam.last_reset_date = result[11]
                fam.owner_id = result[12]
                fam.blocker_last_seen = result[13]
                fam.accent = "neon"
            else:
                # Create new family row without accent column
                db.execute(
                    text("INSERT INTO family_settings (id, name, timezone, reset_time, "
                         "new_devices_blocked, points_unlock_early, early_bonus_cap, "
                         "screen_time_price, gifs_enabled, giphy_api_key, gif_rating, "
                         "last_reset_date, owner_id, blocker_last_seen) "
                         "VALUES (1, 'My Family', 'UTC', '06:00', 1, 0, 5, 20, 0, NULL, 'g', NULL, NULL, NULL)")
                )
                db.commit()
                # Fetch it back
                result = db.execute(
                    text("SELECT id, name, timezone, reset_time, new_devices_blocked, "
                         "points_unlock_early, early_bonus_cap, screen_time_price, "
                         "gifs_enabled, giphy_api_key, gif_rating, last_reset_date, "
                         "owner_id, blocker_last_seen FROM family_settings WHERE id = 1")
                ).first()
                fam = FamilySettings()
                fam.id = result[0]
                fam.name = result[1]
                fam.timezone = result[2]
                fam.reset_time = result[3]
                fam.new_devices_blocked = result[4]
                fam.points_unlock_early = result[5]
                fam.early_bonus_cap = result[6]
                fam.screen_time_price = result[7]
                fam.gifs_enabled = result[8]
                fam.giphy_api_key = result[9]
                fam.gif_rating = result[10]
                fam.last_reset_date = result[11]
                fam.owner_id = result[12]
                fam.blocker_last_seen = result[13]
                fam.accent = "neon"
        except Exception:
            # If even the raw query fails, just create a new one
            fam = FamilySettings(id=1, name="My Family", accent="neon")
            db.add(fam)
            db.flush()

    db.info["family"] = fam  # strong ref: the identity map is weak, so repeat calls re-query
    return fam
