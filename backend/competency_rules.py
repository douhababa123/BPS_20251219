"""Assessment roster scope; account permissions and matching stay independent."""

ASSESSMENT_ROSTER_EXCLUDED_EMAILS = (
    "zhifeng.tong@bshg.com",
    "tyler.tan@bshg.com",
)


def business_gap(current, target):
    return max(target - current, 0)
