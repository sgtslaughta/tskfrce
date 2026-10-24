from blocker.identity import friendly_name, vendor_for


def test_known_prefix_returns_vendor():
    assert vendor_for("B8:27:EB:12:34:56") == "Raspberry Pi Foundation"


def test_case_and_separators_tolerated():
    assert vendor_for("b8-27-eb-12-34-56") == "Raspberry Pi Foundation"
    assert vendor_for("b827.eb12.3456") == "Raspberry Pi Foundation"
    assert vendor_for("b827eb123456") == "Raspberry Pi Foundation"


def test_vendor_with_comma():
    assert vendor_for("F0:D1:A9:00:00:01") == "Apple, Inc."


def test_unknown_returns_none():
    assert vendor_for("00:00:00:00:00:00") is None
    assert vendor_for("zz") is None


def test_friendly_name_precedence():
    assert friendly_name("kid-laptop", "Apple, Inc.") == "kid-laptop"
    assert friendly_name(None, "Sony") == "Sony device"
    assert friendly_name("", "Sony") == "Sony device"
    assert friendly_name(None, None) == "Unknown device"


def test_friendly_name_clamped_to_100():
    assert len(friendly_name("a" * 300, None)) == 100
    assert len(friendly_name(None, "v" * 300)) == 100
