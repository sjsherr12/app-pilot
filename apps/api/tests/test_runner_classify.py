from apppilot.engine.testrunner import classify


def _report(status, error=None, expected=0, unexpected=0):
    result = {"status": status}
    if error:
        result["error"] = {"message": error}
    return {
        "stats": {"expected": expected, "unexpected": unexpected, "duration": 1234},
        "suites": [{"specs": [{"tests": [{"results": [result]}]}]}],
    }


def test_assertion_failure_reproduces_bug():
    status, err, repro, _ = classify(_report("failed", "Error: expect(locator).toContainText(expected)\nExpected: $89.97\nReceived: $29.99", unexpected=1))
    assert status == "failed" and repro is True and "Expected" in err


def test_locator_timeout_is_broken_test():
    status, _, repro, _ = classify(_report("failed", "TimeoutError: locator.click: Timeout 8000ms exceeded.", unexpected=1))
    assert status == "failed" and repro is False


def test_passed():
    assert classify(_report("passed", expected=1))[0] == "passed"


def test_no_tests_is_error():
    assert classify({"stats": {"expected": 0, "unexpected": 0}, "suites": []})[0] == "error"
