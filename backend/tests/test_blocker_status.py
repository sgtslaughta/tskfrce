from datetime import UTC, datetime, timedelta

from app.core.config import settings
from app.models.family import get_family

URL = "/api/v1/blocker"


def test_offline_until_box_checks_in_then_stale(client, db, parent_headers, kid_headers):
    assert client.get(URL, headers=kid_headers).status_code == 403
    assert client.get(URL, headers=parent_headers).json() == {"online": False, "last_seen": None}

    client.get("/api/v1/internal/state", headers={"X-Internal-Token": settings.INTERNAL_TOKEN})
    j = client.get(URL, headers=parent_headers).json()
    assert j["online"] is True and j["last_seen"].endswith("Z")

    fam = get_family(db)
    db.refresh(fam)
    fam.blocker_last_seen = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=5)
    db.commit()
    assert client.get(URL, headers=parent_headers).json()["online"] is False
