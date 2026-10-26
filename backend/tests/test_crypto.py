import pytest
from app.core.crypto import seal, unseal


def test_roundtrip_and_not_plaintext():
    t = seal("discord://abc/def")
    assert t != "discord://abc/def" and unseal(t) == "discord://abc/def"


def test_garbage_raises_value_error():
    with pytest.raises(ValueError):
        unseal("not-a-token")
