from blocker.hits import HitCounter

MAC = "de:ad:be:ef:00:01"


def test_gap_dedupes():
    t = [100.0]
    h = HitCounter(lambda ip: MAC, clock=lambda: t[0])
    for _ in range(3):
        h.add("1.1.1.1")
        t[0] += 3
    assert h.drain() == {MAC: 1}
    t[0] += 10
    h.add("1.1.1.1")
    assert h.drain() == {MAC: 1}


def test_gap_counts_again_after_ten_seconds():
    t = [100.0]
    h = HitCounter(lambda ip: MAC, clock=lambda: t[0])
    h.add("1.1.1.1")
    t[0] += 10
    h.add("1.1.1.1")
    assert h.drain() == {MAC: 2}


def test_unknown_ip_ignored():
    h = HitCounter(lambda ip: None)
    h.add("9.9.9.9")
    assert h.drain() == {}


def test_drain_clears():
    h = HitCounter(lambda ip: MAC)
    h.add("1.1.1.1")
    assert h.drain() == {MAC: 1}
    assert h.drain() == {}
